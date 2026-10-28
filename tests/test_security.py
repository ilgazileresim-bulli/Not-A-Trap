from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_TEMP_ROOT = Path(__file__).resolve().parent / "_tmp"
TEST_TEMP_ROOT.mkdir(exist_ok=True)

from security import scan_package, validate_manifest_bytes, UnsafePackage


def manifest(**changes):
    value = {
        "schema_version": 1,
        "id": "test-paketi",
        "name": "Test Paketi",
        "version": "1.0.0",
        "author": "QA",
        "description": "Güvenli test paketi.",
        "rules": {"gravity": 0.75, "show_route": True},
    }
    value.update(changes)
    return json.dumps(value, ensure_ascii=False).encode()


class SecurityTests(unittest.TestCase):
    def test_valid_manifest(self):
        data, warnings = validate_manifest_bytes(manifest())
        self.assertEqual(data["id"], "test-paketi")
        self.assertEqual(data["target_levels"], "all")
        self.assertEqual(data["priority"], 0)
        self.assertEqual(warnings, [])

    def test_detailed_workshop_metadata_and_scope(self):
        data, warnings = validate_manifest_bytes(manifest(
            priority=25,
            target_levels="1, 5, 20-23",
            category="CHALLENGE",
            difficulty="NIGHTMARE",
            tags=["physics", "speedrun"],
            dependencies=["core.physics"],
            supported_input=["keyboard", "nintendo-controller"],
            estimated_minutes=45,
        ))
        self.assertEqual(data["target_levels"], [1, 5, 20, 21, 22, 23])
        self.assertEqual(data["priority"], 25)
        self.assertEqual(data["difficulty"], "NIGHTMARE")
        self.assertEqual(warnings, [])

    def test_empty_level_scope_is_rejected(self):
        with self.assertRaises(UnsafePackage):
            validate_manifest_bytes(manifest(target_levels=[]))

    def test_unknown_rule_is_rejected(self):
        with self.assertRaises(UnsafePackage):
            validate_manifest_bytes(manifest(rules={"run_shell": "calc.exe"}))

    def test_executable_signature_is_rejected(self):
        with self.assertRaises(UnsafePackage):
            validate_manifest_bytes(b"MZ" + b"0" * 200)

    @patch("security._external_antivirus", return_value=("clean", "TEST AV CLEAN"))
    def test_clean_natmod_passes(self, _scanner):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as folder:
            path = Path(folder) / "safe.natmod"
            path.write_bytes(manifest())
            report = scan_package(path, path.name)
            self.assertEqual(report.verdict, "clean")
            self.assertTrue(report.sha256)

    @patch("security._external_antivirus", return_value=("clean", "TEST AV CLEAN"))
    def test_zip_path_traversal_is_rejected(self, _scanner):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as folder:
            path = Path(folder) / "escape.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("../escape.natmod", manifest())
            report = scan_package(path, path.name)
            self.assertEqual(report.verdict, "rejected")


if __name__ == "__main__":
    unittest.main()
