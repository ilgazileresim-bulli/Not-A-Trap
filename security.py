from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any


MAX_ARCHIVE_ENTRIES = 80
MAX_ARCHIVE_UNPACKED = 48 * 1024 * 1024
MAX_SINGLE_ENTRY = 12 * 1024 * 1024
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_NESTING = 12

NUMBER_RULES = {
    "player_speed": (0.35, 4.0),
    "jump_power": (0.35, 3.0),
    "gravity": (0.15, 3.0),
    "player_scale": (0.58, 1.25),
    "hazard_speed": (0.10, 3.0),
}

BOOL_RULES = {
    "reverse_gravity", "invincible", "no_spikes", "no_saws", "no_lasers",
    "no_drops", "no_wind", "no_reverse", "no_portals", "no_blinks",
    "freeze_movers", "freeze_hazards", "show_hitboxes", "show_triggers",
    "show_route", "always_door", "air_jump", "auto_jump", "infinite_coyote",
    "no_fall", "noclip", "no_trail", "ghost", "no_crusher", "no_wall",
    "no_floor_fall", "no_gravity_flip", "slow_hazards", "show_velocity",
    "exit_aura",
}

PASSIVE_ARCHIVE_SUFFIXES = {
    ".natmod", ".json", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".md"
}

DANGEROUS_SUFFIXES = {
    ".exe", ".dll", ".com", ".scr", ".msi", ".msp", ".bat", ".cmd",
    ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".hta",
    ".jar", ".py", ".pyw", ".sh", ".so", ".dylib", ".app", ".lnk"
}

CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
SAFE_VERSION = re.compile(r"^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][A-Za-z0-9.-]+)?$")

OPTIONAL_TEXT_FIELDS = {
    "category": 32,
    "license": 40,
    "homepage": 200,
    "changelog": 1000,
    "credits": 500,
    "difficulty": 24,
    "audience": 32,
    "language": 12,
    "release_channel": 24,
    "compatibility_notes": 800,
    "content_warnings": 500,
    "install_instructions": 800,
}

OPTIONAL_LIST_FIELDS = {"tags", "dependencies", "conflicts", "supported_input"}


@dataclass
class ScanReport:
    verdict: str
    summary: str
    sha256: str
    manifest: dict[str, Any] | None = None
    layers: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class UnsafePackage(ValueError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _depth(value: Any, current: int = 0) -> int:
    if current > MAX_NESTING:
        return current
    if isinstance(value, dict):
        return max((_depth(v, current + 1) for v in value.values()), default=current)
    if isinstance(value, list):
        return max((_depth(v, current + 1) for v in value), default=current)
    return current


def _walk_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield str(key)
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)


def validate_manifest_bytes(raw: bytes) -> tuple[dict[str, Any], list[str]]:
    if len(raw) > MAX_JSON_BYTES:
        raise UnsafePackage("Manifest 2 MB sınırını aşıyor.")
    if raw.startswith((b"MZ", b"\x7fELF", b"#!")):
        raise UnsafePackage("Çalıştırılabilir dosya imzası tespit edildi.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UnsafePackage("Manifest UTF-8 metni değil.") from exc
    if CONTROL_CHARACTERS.search(text):
        raise UnsafePackage("Manifest içinde yasaklı kontrol karakteri var.")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise UnsafePackage(f"Geçersiz JSON: satır {exc.lineno}, sütun {exc.colno}.") from exc
    if not isinstance(data, dict):
        raise UnsafePackage("Manifest kökü bir JSON nesnesi olmalı.")
    if _depth(data) > MAX_NESTING:
        raise UnsafePackage("JSON iç içe geçme sınırı aşıldı.")

    required = {"schema_version", "id", "name", "version", "author", "description", "rules"}
    missing = sorted(required.difference(data))
    if missing:
        raise UnsafePackage("Eksik alanlar: " + ", ".join(missing))
    if data.get("schema_version") != 1:
        raise UnsafePackage("Yalnızca .natmod şema sürümü 1 destekleniyor.")
    if not SAFE_ID.fullmatch(str(data.get("id", ""))):
        raise UnsafePackage("Mod kimliği 2-64 karakter ve yalnızca küçük harf/rakam/._- içermeli.")
    if not SAFE_VERSION.fullmatch(str(data.get("version", ""))):
        raise UnsafePackage("Sürüm numarası geçerli değil (örnek: 1.2.0).")
    for key, limit in (("name", 80), ("author", 60), ("description", 800)):
        value = data.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise UnsafePackage(f"{key} alanı boş veya {limit} karakterden uzun.")

    priority = data.get("priority", 0)
    if isinstance(priority, bool) or not isinstance(priority, (int, float)) or int(priority) != priority or not -100 <= int(priority) <= 100:
        raise UnsafePackage("priority -100 ile 100 arasında bir tam sayı olmalı.")
    data["priority"] = int(priority)
    if "experimental" in data and not isinstance(data["experimental"], bool):
        raise UnsafePackage("experimental true/false olmalı.")
    minutes = data.get("estimated_minutes", 15)
    if isinstance(minutes, bool) or not isinstance(minutes, (int, float)) or int(minutes) != minutes or not 1 <= int(minutes) <= 999:
        raise UnsafePackage("estimated_minutes 1 ile 999 arasında bir tam sayı olmalı.")
    data["estimated_minutes"] = int(minutes)

    for key, limit in OPTIONAL_TEXT_FIELDS.items():
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, str) or len(value) > limit:
            raise UnsafePackage(f"{key} metin olmalı ve {limit} karakteri aşmamalı.")
    for key in OPTIONAL_LIST_FIELDS:
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, list) or len(value) > 40 or any(not isinstance(item, str) or not item.strip() or len(item) > 100 for item in value):
            raise UnsafePackage(f"{key} en fazla 40 kısa metinden oluşan bir liste olmalı.")

    target_levels = data.get("target_levels", "all")
    if isinstance(target_levels, str):
        if target_levels.strip().lower() == "all":
            data["target_levels"] = "all"
        else:
            parsed_levels: set[int] = set()
            for token in re.split(r"[\s,;]+", target_levels.replace("–", "-").replace("—", "-")):
                if not token:
                    continue
                match = re.fullmatch(r"(\d+)-(\d+)", token)
                if match:
                    low, high = sorted((int(match.group(1)), int(match.group(2))))
                    if low < 1 or high > 220:
                        raise UnsafePackage("target_levels yalnızca 1-220 arasındaki bölümleri içerebilir.")
                    parsed_levels.update(range(low, high + 1))
                elif token.isdigit() and 1 <= int(token) <= 220:
                    parsed_levels.add(int(token))
                else:
                    raise UnsafePackage("target_levels 'all', bölüm listesi veya aralık olmalı.")
            if not parsed_levels:
                raise UnsafePackage("target_levels boş olamaz.")
            data["target_levels"] = sorted(parsed_levels)
    elif isinstance(target_levels, list):
        if not target_levels or len(target_levels) > 220 or any(isinstance(level, bool) or not isinstance(level, int) or not 1 <= level <= 220 for level in target_levels):
            raise UnsafePackage("target_levels 1-220 arasında en az bir bölüm içermeli.")
        data["target_levels"] = sorted(set(target_levels))
    else:
        raise UnsafePackage("target_levels 'all' veya bölüm listesi olmalı.")

    rules = data.get("rules")
    if not isinstance(rules, dict) or not rules:
        raise UnsafePackage("rules en az bir oyun kuralı içermeli.")
    unknown_rules = sorted(set(rules).difference(NUMBER_RULES).difference(BOOL_RULES).difference({"start_message"}))
    if unknown_rules:
        raise UnsafePackage("Oyunun tanımadığı kurallar: " + ", ".join(unknown_rules))
    for key, (low, high) in NUMBER_RULES.items():
        if key not in rules:
            continue
        value = rules[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= float(value) <= high:
            raise UnsafePackage(f"{key} {low} ile {high} arasında bir sayı olmalı.")
    for key in BOOL_RULES:
        if key in rules and not isinstance(rules[key], bool):
            raise UnsafePackage(f"{key} true/false olmalı.")
    if "start_message" in rules and (not isinstance(rules["start_message"], str) or len(rules["start_message"]) > 100):
        raise UnsafePackage("start_message en fazla 100 karakter olmalı.")

    for value in _walk_strings(data):
        if len(value) > 16_000:
            raise UnsafePackage("Aşırı uzun metin alanı tespit edildi.")

    warnings: list[str] = []
    if data.get("experimental"):
        warnings.append("Paket deneysel olarak işaretlenmiş.")
    if rules.get("noclip") or rules.get("invincible"):
        warnings.append("Oynanışı büyük ölçüde değiştiren geliştirici kuralı içeriyor.")
    return data, warnings


def _validate_zip(path: Path) -> tuple[dict[str, Any], list[str]]:
    manifest_payload: bytes | None = None
    total_unpacked = 0
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_ARCHIVE_ENTRIES:
            raise UnsafePackage(f"Arşiv 1-{MAX_ARCHIVE_ENTRIES} dosya içermeli.")
        for entry in entries:
            normalized = entry.filename.replace("\\", "/")
            pure = PurePosixPath(normalized)
            if pure.is_absolute() or ".." in pure.parts or not pure.name:
                raise UnsafePackage("Arşivde klasör dışına çıkmaya çalışan yol var.")
            mode = entry.external_attr >> 16
            if mode and stat.S_ISLNK(mode):
                raise UnsafePackage("Arşivde sembolik bağlantı yasaktır.")
            suffix = pure.suffix.lower()
            if suffix in DANGEROUS_SUFFIXES or suffix not in PASSIVE_ARCHIVE_SUFFIXES:
                raise UnsafePackage(f"Arşivde izin verilmeyen dosya türü: {suffix or '(uzantısız)'}")
            if entry.file_size > MAX_SINGLE_ENTRY:
                raise UnsafePackage("Arşivde tekil dosya boyutu sınırı aşıldı.")
            total_unpacked += entry.file_size
            if total_unpacked > MAX_ARCHIVE_UNPACKED:
                raise UnsafePackage("Arşiv açılmış boyut sınırını aşıyor.")
            if entry.compress_size and entry.file_size / entry.compress_size > 120:
                raise UnsafePackage("Şüpheli sıkıştırma oranı (zip bombası riski).")
            if suffix == ".natmod":
                if manifest_payload is not None:
                    raise UnsafePackage("Arşiv tam olarak bir .natmod manifesti içermeli.")
                manifest_payload = archive.read(entry)
    if manifest_payload is None:
        raise UnsafePackage("Arşivde .natmod manifesti bulunamadı.")
    return validate_manifest_bytes(manifest_payload)


def _defender_path() -> Path | None:
    candidates: list[Path] = []
    found = shutil.which("MpCmdRun.exe")
    if found:
        candidates.append(Path(found))
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    candidates.append(Path(program_files) / "Windows Defender" / "MpCmdRun.exe")
    platform_root = Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Microsoft" / "Windows Defender" / "Platform"
    if platform_root.is_dir():
        candidates.extend(sorted(platform_root.glob("*/MpCmdRun.exe"), reverse=True))
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def _external_antivirus(path: Path) -> tuple[str, str]:
    custom = os.environ.get("NAT_TRAP_SCANNER_COMMAND", "").strip()
    if custom:
        parts = [part.replace("{file}", str(path)) for part in shlex.split(custom)]
        if all("{file}" not in part for part in shlex.split(custom)):
            parts.append(str(path))
        try:
            result = subprocess.run(parts, capture_output=True, text=True, timeout=180, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return "error", f"Özel tarayıcı çalışmadı: {exc}"
        output = (result.stdout + "\n" + result.stderr).strip()[-1200:]
        return ("clean", output or "Özel tarayıcı temiz bildirdi.") if result.returncode == 0 else ("threat", output or "Özel tarayıcı paketi reddetti.")

    defender = _defender_path()
    if defender:
        try:
            result = subprocess.run(
                [str(defender), "-Scan", "-ScanType", "3", "-File", str(path), "-DisableRemediation"],
                capture_output=True, text=True, timeout=180, check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return "error", f"Windows Defender çalışmadı: {exc}"
        output = (result.stdout + "\n" + result.stderr).strip()[-1200:]
        if result.returncode == 0:
            return "clean", "Microsoft Defender taraması temiz."
        if result.returncode == 2:
            return "threat", output or "Microsoft Defender tehdit bildirdi."
        return "error", output or f"Microsoft Defender çıkış kodu: {result.returncode}"

    clamscan = shutil.which("clamscan")
    if clamscan:
        try:
            result = subprocess.run([clamscan, "--no-summary", str(path)], capture_output=True, text=True, timeout=180, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return "error", f"ClamAV çalışmadı: {exc}"
        output = (result.stdout + "\n" + result.stderr).strip()[-1200:]
        if result.returncode == 0:
            return "clean", "ClamAV taraması temiz."
        if result.returncode == 1:
            return "threat", output or "ClamAV tehdit bildirdi."
        return "error", output or f"ClamAV çıkış kodu: {result.returncode}"
    return "unavailable", "Harici antivirüs bulunamadı. Katı veri şeması denetimi uygulandı."


def scan_package(path: Path, original_name: str) -> ScanReport:
    digest = sha256_file(path)
    layers: list[dict[str, str]] = [
        {"name": "SHA-256 KİMLİK", "status": "passed", "detail": digest[:20] + "…"},
    ]
    suffix = Path(original_name).suffix.lower()
    try:
        if suffix == ".natmod":
            manifest, warnings = validate_manifest_bytes(path.read_bytes())
            layers.append({"name": "NATMOD ŞEMA 01", "status": "passed", "detail": "JSON veri modeli ve oyun kuralları doğrulandı."})
        elif suffix == ".zip":
            manifest, warnings = _validate_zip(path)
            layers.append({"name": "ARŞİV İZOLASYONU", "status": "passed", "detail": "Yol kaçışı, çalıştırılabilir dosya ve zip bombası yok."})
        else:
            raise UnsafePackage("Yalnızca .natmod veya güvenli .zip paketleri kabul edilir.")
    except (UnsafePackage, zipfile.BadZipFile, OSError) as exc:
        layers.append({"name": "YAPISAL DENETİM", "status": "failed", "detail": str(exc)})
        return ScanReport("rejected", str(exc), digest, layers=layers)

    av_state, av_detail = _external_antivirus(path)
    layers.append({"name": "ZARARLI YAZILIM", "status": "passed" if av_state == "clean" else av_state, "detail": av_detail})
    if av_state == "threat":
        return ScanReport("rejected", "Antivirüs tehdidi tespit edildi.", digest, manifest, layers, warnings)
    if suffix == ".zip" and av_state in {"unavailable", "error"}:
        return ScanReport("manual_review", "Arşiv yapısal olarak güvenli; harici antivirüs/onay bekliyor.", digest, manifest, layers, warnings)

    layers.append({"name": "24 SAAT KARANTİNA", "status": "waiting", "detail": "Temiz paket yayın saatine kadar kilitli tutulacak."})
    summary = "Tüm otomatik katmanlar temiz; 24 saatlik karantina başladı."
    if av_state in {"unavailable", "error"}:
        summary = "Çalıştırılamayan veri-only .natmod katı şema denetiminden geçti; 24 saatlik karantina başladı."
    return ScanReport("clean", summary, digest, manifest, layers, warnings)
