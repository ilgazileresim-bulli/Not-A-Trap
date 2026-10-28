const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  mods: [],
  query: "",
  category: "",
  sort: "new",
  statusTimer: null,
  statusCredentials: null,
  player: null,
  authMode: "login",
  builderManifest: null,
  builderValidated: false,
  builderHistory: [],
  builderHistoryIndex: -1,
  builderHistoryTimer: null,
  builderRestoring: false,
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function formatNumber(value) {
  const locale = document.documentElement.lang === "en" ? "en-US" : "tr-TR";
  return new Intl.NumberFormat(locale, { notation: value > 9999 ? "compact" : "standard" }).format(value || 0);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(epoch) {
  const locale = document.documentElement.lang === "en" ? "en-US" : "tr-TR";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(epoch * 1000));
}

function toast(message, danger = false) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.toggle("danger", danger);
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 3400);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const type = response.headers.get("content-type") || "";
  const data = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || "İstek başarısız.");
  return data;
}

function setupReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("visible"); });
  }, { threshold: .12 });
  $$(".reveal").forEach(node => observer.observe(node));
}

async function loadStats() {
  try {
    const data = await api("/api/stats");
    const metrics = $("#hero-metrics");
    metrics.innerHTML = `
      <div><strong>220</strong><span>BÖLÜM</span></div>
      <div><strong>${formatNumber(data.mods)}</strong><span>ONAYLI MOD</span></div>
      <div><strong>24H</strong><span>ZORUNLU KARANTİNA</span></div>`;
  } catch (_) { /* landing page stays useful if API is temporarily offline */ }
}

function t(source) {
  return window.NATI18N?.t?.(source) || source;
}

function initials(username = "NA") {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : username.slice(0, 2)).toUpperCase();
}

function openAuth(mode = "login") {
  state.authMode = mode;
  const dialog = $("#auth-dialog");
  const registering = mode === "register";
  $("#auth-title").textContent = registering ? t("KAYIT OL") : t("GİRİŞ YAP");
  $("#auth-copy").textContent = registering
    ? t("Oyunda ve sitede kullanacağın yerel oyuncu dosyasını oluştur.")
    : t("Oyunda oluşturduğun hesapla devam et. Profil istatistiklerin aynı yerel dosyadan okunur.");
  $("#auth-confirm-row").hidden = !registering;
  $("#auth-confirm").required = registering;
  $("#auth-password").autocomplete = registering ? "new-password" : "current-password";
  $("#auth-submit").innerHTML = registering ? `${t("HESAP OLUŞTUR")} <span>→</span>` : `${t("GİRİŞ YAP")} <span>→</span>`;
  $("#auth-switch").textContent = registering ? t("ZATEN HESABIN VAR MI? GİRİŞ YAP") : t("HESABIN YOK MU? KAYIT OL");
  $("#auth-message").className = "auth-message";
  $("#auth-message").textContent = t("Parola düz metin olarak saklanmaz.");
  if (state.player && !registering) $("#auth-username").value = state.player.username;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  setTimeout(() => $("#auth-username").focus(), 80);
}

function renderPlayer(player) {
  state.player = player || null;
  const locked = $("#profile-locked");
  const dashboard = $("#profile-dashboard");
  const trigger = $("#account-trigger");
  if (!player) {
    locked.hidden = false;
    dashboard.hidden = true;
    trigger.classList.remove("authenticated");
    $("b", trigger).textContent = t("GİRİŞ YAP");
    $("small", trigger).textContent = t("OYUNCU HESABI");
    return;
  }
  locked.hidden = true;
  dashboard.hidden = false;
  trigger.classList.add("authenticated");
  $("b", trigger).textContent = player.username;
  $("small", trigger).textContent = t("DOSYA BAĞLI");
  $("#profile-avatar").textContent = initials(player.username);
  $("#profile-name").textContent = player.username;
  $("#profile-last-played").textContent = player.stats.last_played
    ? `${t("SON OYUN")} / ${formatDate(player.stats.last_played)}`
    : `${t("SON OYUN")} / —`;
  $("#profile-progress-text").textContent = `${player.stats.progress.toFixed(1)}%`;
  $("#profile-progress-fill").style.width = `${player.stats.progress}%`;
  $("#stat-level").textContent = String(player.stats.highest_unlocked).padStart(3, "0");
  $("#stat-completed").textContent = String(player.stats.completed_levels).padStart(3, "0");
  $("#stat-deaths").textContent = String(player.stats.deaths).padStart(3, "0");
  $("#stat-attempts").textContent = String(player.stats.attempts).padStart(3, "0");
  $("#achievement-count").textContent = `${player.achievements.length} ${t("AÇIK")}`;
  $("#achievement-list").innerHTML = player.achievements.map(item => `<span>${escapeHtml(t(item))}</span>`).join("");
  if ($("#builder-author").value === "Oyuncu" || !$("#builder-author").value.trim()) $("#builder-author").value = player.username;
  const uploadAuthor = $('#upload-form [name="author"]');
  if (uploadAuthor && !uploadAuthor.value.trim()) uploadAuthor.value = player.username;
}

async function refreshAuth() {
  try {
    const data = await api("/api/auth/status");
    renderPlayer(data.authenticated ? data.player : null);
  } catch (_) {
    renderPlayer(null);
  }
}

function setupAuth() {
  const dialog = $("#auth-dialog");
  $$('[data-open-auth]').forEach(button => button.addEventListener("click", () => openAuth("login")));
  $("#account-trigger").addEventListener("click", () => openAuth("login"));
  $("[data-close-auth]").addEventListener("click", () => closeDialog(dialog));
  $("#auth-switch").addEventListener("click", () => openAuth(state.authMode === "login" ? "register" : "login"));
  $("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const username = $("#auth-username").value.trim();
    const password = $("#auth-password").value;
    const message = $("#auth-message");
    if (state.authMode === "register" && password !== $("#auth-confirm").value) {
      message.className = "auth-message error";
      message.textContent = t("Şifreler aynı değil.");
      return;
    }
    const submit = $("#auth-submit");
    submit.disabled = true;
    message.className = "auth-message";
    message.textContent = t("Oyuncu dosyası doğrulanıyor…");
    try {
      const data = await api(`/api/auth/${state.authMode}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password}),
      });
      renderPlayer(data.player);
      message.className = "auth-message success";
      message.textContent = state.authMode === "register" ? t("Hesap oluşturuldu ve giriş yapıldı.") : t("Giriş başarılı.");
      $("#auth-password").value = "";
      $("#auth-confirm").value = "";
      setTimeout(() => closeDialog(dialog), 450);
      toast(t("Oyuncu dosyası bağlandı."));
    } catch (error) {
      message.className = "auth-message error";
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  $("#logout-button").addEventListener("click", async () => {
    await api("/api/auth/logout", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"});
    renderPlayer(null);
    toast(t("Oturum kapatıldı."));
  });
  document.addEventListener("natrap:language", () => {
    renderPlayer(state.player);
  });
}

async function loadMods() {
  const grid = $("#mod-grid");
  grid.innerHTML = '<div class="loading-card"></div><div class="loading-card"></div><div class="loading-card"></div>';
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category) params.set("category", state.category);
  params.set("sort", state.sort);
  try {
    const data = await api(`/api/mods?${params}`);
    state.mods = data.items;
    $("#result-count").textContent = data.total;
    if (!data.items.length) {
      grid.innerHTML = '<div class="empty-results"><div><strong>DOSYA YOK.</strong><span>Filtreyi değiştir veya ilk modu sen gönder.</span></div></div>';
      return;
    }
    grid.innerHTML = data.items.map(modCard).join("");
    $$(".mod-card", grid).forEach(card => card.addEventListener("click", event => {
      if (event.target.closest("a")) return;
      openMod(card.dataset.slug);
    }));
  } catch (error) {
    grid.innerHTML = `<div class="empty-results"><div><strong>BAĞLANTI KOPTU.</strong><span>${escapeHtml(error.message)}</span></div></div>`;
  }
}

function modCard(mod) {
  const tags = mod.tags.slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join("");
  return `<article class="mod-card" data-slug="${escapeHtml(mod.slug)}" tabindex="0">
    <div class="mod-banner">
      <img src="${escapeHtml(mod.banner || "/assets/mod-default.svg")}" alt="" loading="lazy">
      <span class="badge">${escapeHtml(mod.category)}</span>
      ${mod.official ? '<span class="badge official">◆ RESMÎ</span>' : ''}
    </div>
    <div class="mod-body">
      <div class="mod-meta"><span>V${escapeHtml(mod.version)}</span><span>${formatDate(mod.approved_at)}</span></div>
      <h3>${escapeHtml(mod.name)}</h3>
      <p>${escapeHtml(mod.summary)}</p>
      <div class="tag-list">${tags}</div>
      <div class="mod-footer"><span>↓ ${formatNumber(mod.downloads)} / ${escapeHtml(mod.author)}</span><button aria-label="Ayrıntıyı aç">↗</button></div>
    </div>
  </article>`;
}

async function openMod(slug) {
  const dialog = $("#mod-dialog");
  const host = $("#mod-detail");
  host.innerHTML = '<div class="modal-head"><div><span>DOSYA AÇILIYOR</span><h2>BEKLE…</h2></div><button class="close-button" data-close-mod>×</button></div>';
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  try {
    const mod = await api(`/api/mods/${encodeURIComponent(slug)}`);
    host.innerHTML = modDetail(mod);
    $("[data-close-mod]", host).addEventListener("click", () => closeDialog(dialog));
    $("#review-form", host).addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await api(`/api/reviews/${encodeURIComponent(slug)}`, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify(Object.fromEntries(form)),
        });
        toast("Yorum dosyaya işlendi.");
        openMod(slug);
      } catch (error) { toast(error.message, true); }
    });
    history.replaceState(null, "", `#mod/${slug}`);
  } catch (error) {
    host.innerHTML = `<div class="modal-head"><div><span>HATA</span><h2>DOSYA AÇILAMADI</h2></div><button class="close-button" data-close-mod>×</button></div><p class="status-summary">${escapeHtml(error.message)}</p>`;
    $("[data-close-mod]", host).addEventListener("click", () => closeDialog(dialog));
  }
}

function modDetail(mod) {
  const reviews = mod.reviews.length ? mod.reviews.map(review => `<article class="review"><header><span>${escapeHtml(review.nickname)}</span><span>${"★".repeat(review.rating)}${"☆".repeat(5-review.rating)}</span></header><p>${escapeHtml(review.body)}</p></article>`).join("") : '<p class="author">İLK YORUMU SEN YAZ.</p>';
  return `<div class="modal-head"><div><span>ONAYLI DOSYA / ${escapeHtml(mod.category)}</span><h2>MOD KAYDI</h2></div><button class="close-button" data-close-mod aria-label="Kapat">×</button></div>
    <div class="mod-detail-banner"><img src="${escapeHtml(mod.banner)}" alt=""></div>
    <div class="mod-detail-grid">
      <div class="mod-detail-main">
        <h2>${escapeHtml(mod.name)}</h2><p class="author">${escapeHtml(mod.author)} / V${escapeHtml(mod.version)} / ${mod.rating || "—"} ★ (${mod.review_count})</p>
        <p class="mod-description">${escapeHtml(mod.description)}</p>
        <div class="tag-list">${mod.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <h3>TOPLULUK NOTLARI</h3><div class="review-list">${reviews}</div>
        <form class="review-form" id="review-form"><input name="nickname" required maxlength="40" placeholder="RUMUZ"><select name="rating"><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select><textarea name="body" required maxlength="600" placeholder="Bu mod hakkında ne düşünüyorsun?"></textarea><button class="btn btn-solid" type="submit">YORUMU KAYDET</button></form>
      </div>
      <aside class="mod-detail-side">
        <div class="detail-stat"><span>OYUN SÜRÜMÜ</span><strong>${escapeHtml(mod.game_version)}</strong></div>
        <div class="detail-stat"><span>PAKET BOYUTU</span><strong>${formatBytes(mod.file_size)}</strong></div>
        <div class="detail-stat"><span>İNDİRME</span><strong>${formatNumber(mod.downloads)}</strong></div>
        <div class="detail-stat"><span>LİSANS</span><strong>${escapeHtml(mod.license)}</strong></div>
        <div class="detail-stat"><span>SHA-256</span><strong>${escapeHtml(mod.sha256.slice(0, 20))}…</strong></div>
        <a class="btn btn-solid btn-large download-button" href="${escapeHtml(mod.download_url)}">MODU İNDİR ↓</a>
        <div class="security-seal"><b>◆ 24H ONAYLI PAKET</b>${escapeHtml(mod.scan_summary)}<br><br>Yine de yalnızca NOT A TRAP Mod Manager ile aç.</div>
      </aside>
    </div>`;
}

function closeDialog(dialog) {
  dialog.close();
  document.body.classList.remove("modal-open");
  if (dialog.id === "mod-dialog" && location.hash.startsWith("#mod/")) history.replaceState(null, "", "#mods");
}

function setupUpload() {
  const dialog = $("#upload-dialog");
  const form = $("#upload-form");
  const fileInput = $("#mod-file");
  const dropZone = $("#drop-zone");
  $$('[data-open-upload]').forEach(button => button.addEventListener("click", () => {
    dialog.showModal(); document.body.classList.add("modal-open");
  }));
  $("[data-close-upload]").addEventListener("click", () => closeDialog(dialog));
  dialog.addEventListener("close", () => document.body.classList.remove("modal-open"));
  fileInput.addEventListener("change", () => { $("#file-name").textContent = fileInput.files[0]?.name || "DOSYA SEÇİLMEDİ"; });
  ["dragenter", "dragover"].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove("drag"); }));
  dropZone.addEventListener("drop", event => {
    if (event.dataTransfer.files.length) { fileInput.files = event.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = $("#upload-submit");
    const message = $("#upload-message");
    submit.disabled = true; submit.textContent = "DOSYA İZOLASYONA ALINIYOR…"; message.textContent = "Bağlantıyı kapatma; dosya karantina deposuna aktarılıyor.";
    try {
      const payload = await api("/api/upload", { method: "POST", body: new FormData(form) });
      const credentials = { ticket: payload.ticket, token: payload.token };
      localStorage.setItem("natrap-last-upload", JSON.stringify(credentials));
      dialog.close(); form.reset(); $("#file-name").textContent = "DOSYA SEÇİLMEDİ";
      toast("Karantina başladı. Takip kodun bu cihazda saklandı.");
      openStatus(credentials);
    } catch (error) {
      message.textContent = error.message; toast(error.message, true);
    } finally {
      submit.disabled = false; submit.innerHTML = 'KARANTİNAYI BAŞLAT <span>→</span>';
    }
  });
}

function openStatus(credentials) {
  state.statusCredentials = credentials;
  const dialog = $("#status-dialog");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  $("#ticket-code").textContent = credentials.ticket;
  refreshStatus();
  clearInterval(state.statusTimer);
  state.statusTimer = setInterval(refreshStatus, 3000);
}

async function refreshStatus() {
  const credentials = state.statusCredentials;
  if (!credentials) return;
  try {
    const data = await api(`/api/status/${encodeURIComponent(credentials.ticket)}?token=${encodeURIComponent(credentials.token)}`);
    renderStatus(data);
    if (["approved", "rejected"].includes(data.status)) clearInterval(state.statusTimer);
  } catch (error) { $("#status-summary").textContent = error.message; }
}

function renderStatus(data) {
  const titles = { scanning: "DOSYA TARANIYOR", quarantine: "KARANTİNA AKTİF", approved: "DOSYA ONAYLANDI", rejected: "DOSYA REDDEDİLDİ", review: "İNSAN İNCELEMESİ" };
  $("#status-title").textContent = titles[data.status] || "DOSYA İNCELENİYOR";
  $("#status-summary").textContent = data.summary;
  const remaining = Math.max(0, data.remaining_seconds);
  const h = Math.floor(remaining / 3600).toString().padStart(2, "0");
  const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, "0");
  const s = (remaining % 60).toString().padStart(2, "0");
  $("#countdown").textContent = data.status === "approved" ? "ONAYLANDI" : `${h}:${m}:${s}`;
  const total = Math.max(1, data.publish_at - data.submitted_at);
  $("#quarantine-progress").style.width = `${Math.min(100, Math.max(0, (total - remaining) / total * 100))}%`;
  const layers = data.layers.length ? data.layers : [{name:"TARAMA SIRASI", status:"queued", detail:"İşçi hazırlanıyor."}];
  $("#scan-layers").innerHTML = layers.map(layer => `<div class="scan-layer ${escapeHtml(layer.status)}"><i></i><b>${escapeHtml(layer.name)}</b><span>${escapeHtml(layer.detail)}</span></div>`).join("");
  if (data.status === "approved" && data.public_url) {
    $("#status-summary").innerHTML = `DOSYA YAYINDA. <a class="text-link" href="${escapeHtml(data.public_url)}">MOD SAYFASINI AÇ →</a>`;
  }
}

function setupStatus() {
  const dialog = $("#status-dialog");
  $("[data-close-status]").addEventListener("click", () => { closeDialog(dialog); clearInterval(state.statusTimer); });
  $("#copy-ticket").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#ticket-code").textContent); toast("Takip kodu kopyalandı.");
  });
}

function setupFilters() {
  let debounce;
  $("#mod-search").addEventListener("input", event => {
    clearTimeout(debounce); debounce = setTimeout(() => { state.query = event.target.value.trim(); loadMods(); }, 250);
  });
  $$("input[name=category]").forEach(input => input.addEventListener("change", event => { state.category = event.target.value; loadMods(); }));
  $("#sort-select").addEventListener("change", event => { state.sort = event.target.value; loadMods(); });
  $("#clear-filters").addEventListener("click", () => {
    state.query = ""; state.category = ""; $("#mod-search").value = ""; $('input[name=category][value=""]').checked = true; loadMods();
  });
}

const BUILDER_DRAFT_KEY = "natrap-builder-draft-v2";
const numericRules = ["player_speed", "jump_power", "gravity", "player_scale", "hazard_speed"];
const booleanRules = [
  "reverse_gravity", "invincible", "no_spikes", "no_saws", "no_lasers", "no_drops", "no_wind", "no_reverse",
  "no_portals", "no_blinks", "freeze_movers", "freeze_hazards", "show_hitboxes", "show_triggers", "show_route",
  "always_door", "air_jump", "auto_jump", "infinite_coyote", "no_fall", "noclip", "no_trail", "ghost",
  "no_crusher", "no_wall", "no_floor_fall", "no_gravity_flip", "slow_hazards", "show_velocity", "exit_aura",
];
const metadataFields = [
  "category", "difficulty", "audience", "release_channel", "language", "license", "homepage", "compatibility_notes",
  "content_warnings", "install_instructions", "changelog", "credits",
];
const listFields = ["tags", "dependencies", "conflicts", "supported_input"];
const ruleDefaults = {player_speed: 1, jump_power: 1, gravity: 1, player_scale: 1, hazard_speed: 1};

const builderPresets = {
  balanced: {category: "GAMEPLAY", difficulty: "NORMAL", rules: {player_speed: 1.15, jump_power: 1.08, gravity: .95, hazard_speed: 1.05}},
  nightmare: {category: "CHALLENGE", difficulty: "NIGHTMARE", rules: {player_speed: 1.1, jump_power: .9, gravity: 1.35, player_scale: .86, hazard_speed: 2.05, reverse_gravity: true}},
  accessible: {category: "ACCESSIBILITY", difficulty: "EASY", rules: {player_speed: .9, jump_power: 1.3, gravity: .7, hazard_speed: .45, infinite_coyote: true, show_route: true, exit_aura: true}},
  debug: {category: "DEBUG", difficulty: "NORMAL", rules: {show_hitboxes: true, show_triggers: true, show_route: true, show_velocity: true, invincible: true}},
  troll: {category: "EXPERIMENTAL", difficulty: "HARD", experimental: true, rules: {player_speed: 1.35, jump_power: .72, gravity: 1.45, player_scale: .72, hazard_speed: 1.6, reverse_gravity: true, auto_jump: true, ghost: true}},
};

const physicsPresets = {
  vanilla: {player_speed: 1, jump_power: 1, gravity: 1, player_scale: 1, hazard_speed: 1},
  float: {player_speed: .85, jump_power: 1.35, gravity: .45, player_scale: 1, hazard_speed: .7},
  heavy: {player_speed: .75, jump_power: .65, gravity: 1.85, player_scale: 1.15, hazard_speed: .9},
  rush: {player_speed: 2.15, jump_power: 1.08, gravity: 1.15, player_scale: .86, hazard_speed: 1.8},
};

function splitBuilderList(value) {
  return [...new Set(String(value || "").split(/[\n,;]+/).map(item => item.trim()).filter(Boolean))].slice(0, 40);
}

function parseTargetLevels(value) {
  const levels = new Set();
  String(value || "").replace(/[–—]/g, "-").split(/[\s,;]+/).filter(Boolean).forEach(token => {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const low = Math.max(1, Math.min(220, Number(range[1])));
      const high = Math.max(1, Math.min(220, Number(range[2])));
      for (let level = Math.min(low, high); level <= Math.max(low, high); level += 1) levels.add(level);
      return;
    }
    const level = Number(token);
    if (Number.isInteger(level) && level >= 1 && level <= 220) levels.add(level);
  });
  return [...levels].sort((a, b) => a - b);
}

function compressTargetLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) return "";
  const output = [];
  let start = levels[0];
  let previous = levels[0];
  for (let index = 1; index <= levels.length; index += 1) {
    const current = levels[index];
    if (current === previous + 1) { previous = current; continue; }
    output.push(start === previous ? String(start) : `${start}-${previous}`);
    start = current;
    previous = current;
  }
  return output.join(", ");
}

function collectTargetLevels(data) {
  const mode = String(data.get("target_mode") || "all");
  if (mode === "all") return "all";
  if (mode === "custom") return parseTargetLevels(data.get("target_custom"));
  const start = Math.max(1, Math.min(220, Number(data.get("target_start")) || 1));
  const end = Math.max(1, Math.min(220, Number(data.get("target_end")) || 220));
  const levels = [];
  for (let level = Math.min(start, end); level <= Math.max(start, end); level += 1) levels.push(level);
  return levels;
}

function collectBuilderManifest() {
  const data = new FormData($("#mod-builder-form"));
  const rules = {};
  numericRules.forEach(name => {
    const value = Number(data.get(name));
    if (Number.isFinite(value)) rules[name] = Number(value.toFixed(2));
  });
  booleanRules.forEach(name => { if (data.get(name) === "on") rules[name] = true; });
  const startMessage = String(data.get("start_message") || "").trim();
  if (startMessage) rules.start_message = startMessage;
  const manifest = {
    schema_version: 1,
    id: String(data.get("id") || "").trim(),
    name: String(data.get("name") || "").trim(),
    version: String(data.get("version") || "").trim(),
    author: String(data.get("author") || "").trim(),
    description: String(data.get("description") || "").trim(),
    priority: Math.max(-100, Math.min(100, Number(data.get("priority")) || 0)),
    target_levels: collectTargetLevels(data),
    experimental: data.get("experimental") === "on",
    rules,
  };
  metadataFields.forEach(name => {
    const value = String(data.get(name) || "").trim();
    if (value) manifest[name] = value;
  });
  listFields.forEach(name => {
    const values = splitBuilderList(data.get(name));
    if (values.length) manifest[name] = values;
  });
  const minutes = Number(data.get("estimated_minutes"));
  if (Number.isFinite(minutes)) manifest.estimated_minutes = Math.max(1, Math.min(999, Math.round(minutes)));
  return manifest;
}

function activeRuleCount(rules) {
  return numericRules.filter(name => Math.abs(Number(rules[name] ?? 1) - 1) > .001).length
    + booleanRules.filter(name => rules[name] === true).length
    + (rules.start_message ? 1 : 0);
}

function builderDifficulty(manifest) {
  const rules = manifest.rules || {};
  let score = 0;
  score += Math.abs(Number(rules.player_speed || 1) - 1) * 13;
  score += Math.abs(Number(rules.jump_power || 1) - 1) * 12;
  score += Math.abs(Number(rules.gravity || 1) - 1) * 14;
  score += Math.abs(Number(rules.player_scale || 1) - 1) * 18;
  score += Math.max(0, Number(rules.hazard_speed || 1) - 1) * 23;
  if (rules.reverse_gravity) score += 16;
  if (rules.auto_jump) score += 8;
  if (rules.ghost) score += 4;
  if (rules.invincible) score -= 25;
  if (rules.noclip) score -= 35;
  if (rules.air_jump) score -= 12;
  if (rules.infinite_coyote) score -= 8;
  if (rules.freeze_hazards) score -= 24;
  if (rules.slow_hazards) score -= 10;
  if (rules.show_route || rules.exit_aura) score -= 5;
  const disabled = ["no_spikes", "no_saws", "no_lasers", "no_drops", "no_crusher", "no_wall", "no_blinks", "no_floor_fall"].filter(name => rules[name]).length;
  score -= disabled * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function builderRank(score) {
  if (score < 8) return "VANILLA";
  if (score < 24) return "DENGELİ";
  if (score < 45) return "ZOR";
  if (score < 70) return "KÂBUS";
  return "İMKÂNSIZ";
}

function builderConflicts(manifest) {
  const rules = manifest.rules || {};
  const output = [];
  const hazardOff = ["no_spikes", "no_saws", "no_lasers", "no_drops", "no_crusher", "no_wall"].some(name => rules[name]);
  if (rules.freeze_hazards && rules.slow_hazards) output.push("Tuzaklar hem donduruluyor hem yavaşlatılıyor; dondurma baskın gelir.");
  if (rules.invincible && hazardOff) output.push("Tanrı modu açıkken kapatılan ölüm tuzakları gereksiz olabilir.");
  if (rules.noclip && rules.air_jump) output.push("Noclip açıkken hava zıplaması hareketi değiştirmez.");
  if (rules.reverse_gravity && rules.no_gravity_flip) output.push("Başlangıç yerçekimi ters; bölüm içi flip çizgileri devre dışı.");
  if (rules.always_door && rules.exit_aura) output.push("Çıkış hem zorlanıyor hem uzaktan etkinleşiyor; bölüm çok erken bitebilir.");
  if (manifest.target_levels !== "all" && !manifest.target_levels.length) output.push("Özel bölüm listesi boş; mod hiçbir bölümde çalışmaz.");
  if (!activeRuleCount(rules)) output.push("Vanilla değerlerinden farklı en az bir oyun kuralı seç.");
  return output;
}

function updateScopeMap(target) {
  const map = $("#scope-map");
  if (!map.children.length) {
    for (let index = 0; index < 22; index += 1) {
      const segment = document.createElement("span");
      segment.dataset.label = String(index * 10 + 1).padStart(3, "0");
      map.append(segment);
    }
  }
  const levels = target === "all" ? new Set(Array.from({length: 220}, (_, index) => index + 1)) : new Set(target);
  [...map.children].forEach((segment, index) => {
    const start = index * 10 + 1;
    segment.classList.toggle("active", Array.from({length: 10}, (_, offset) => start + offset).some(level => levels.has(level)));
  });
  $("#scope-count").textContent = `${levels.size} / 220`;
  return levels.size;
}

function updateBuilderAnalytics(manifest) {
  const rules = manifest.rules || {};
  const ruleCount = activeRuleCount(rules);
  const targetCount = updateScopeMap(manifest.target_levels);
  const score = builderDifficulty(manifest);
  const dangerous = Boolean(rules.noclip || rules.invincible);
  const risk = dangerous ? "YÜKSEK" : (manifest.experimental || rules.reverse_gravity ? "ORTA" : "DÜŞÜK");
  $("#audit-rule-count").textContent = String(ruleCount).padStart(2, "0");
  $("#audit-score").textContent = String(score).padStart(2, "0");
  $("#audit-rank").textContent = t(builderRank(score));
  $("#audit-target").textContent = String(targetCount).padStart(3, "0");
  $("#audit-risk").textContent = t(risk);
  $("#inspector-rules").textContent = String(ruleCount).padStart(2, "0");
  $("#inspector-scope").textContent = String(targetCount).padStart(3, "0");
  $("#inspector-score").textContent = String(score).padStart(2, "0");
  $("#telemetry-run").textContent = `${Math.round(Number(rules.player_speed || 1) * 100)}%`;
  $("#telemetry-air").textContent = `${Math.round((Number(rules.jump_power || 1) / Number(rules.gravity || 1)) * 100)}%`;
  $("#telemetry-hazard").textContent = `${Math.round(Number(rules.hazard_speed || 1) * 100)}%`;
  const conflicts = builderConflicts(manifest);
  $("#builder-conflicts").innerHTML = conflicts.length
    ? conflicts.map(message => `<li class="warning">${escapeHtml(t(message))}</li>`).join("")
    : `<li class="ok">${escapeHtml(t("Çakışma bulunmadı; kurallar birlikte çalışabilir."))}</li>`;
  const checks = {
    identity: Boolean(manifest.id && manifest.name && manifest.version && manifest.author && manifest.description),
    scope: targetCount > 0,
    rules: ruleCount > 0,
    release: Boolean(manifest.category && manifest.difficulty && manifest.release_channel),
  };
  Object.entries(checks).forEach(([name, ok]) => {
    const item = $(`[data-check="${name}"]`);
    item?.classList.toggle("ok", ok);
    item?.classList.toggle("warning", !ok);
  });
}

function renderBuilderManifest() {
  state.builderManifest = collectBuilderManifest();
  const text = JSON.stringify(state.builderManifest, null, 2);
  $("#manifest-preview").textContent = text;
  $("#manifest-size").textContent = formatBytes(new Blob([text]).size);
  numericRules.forEach(name => {
    const input = $(`[name="${name}"]`);
    const output = $(`[data-output="${name}"]`);
    if (input && output) output.textContent = `${Number(input.value).toFixed(2)}×`;
  });
  updateBuilderAnalytics(state.builderManifest);
  state.builderValidated = false;
  $("#builder-download").disabled = true;
  $("#builder-health").textContent = t("DEĞİŞTİRİLDİ");
  $(".builder-health").classList.remove("valid", "invalid");
  const diagnostics = $("#builder-diagnostics");
  diagnostics.className = "builder-diagnostics";
  $("p", diagnostics).textContent = t("Değişikliklerden sonra yeniden doğrula.");
}

function switchBuilderTab(tab) {
  $$(".builder-tab").forEach(button => button.classList.toggle("active", button.dataset.builderTab === tab));
  $$(".builder-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.builderPanel === tab));
}

function setBuilderResult(valid, message) {
  const health = $(".builder-health");
  const diagnostics = $("#builder-diagnostics");
  health.classList.toggle("valid", valid);
  health.classList.toggle("invalid", !valid);
  diagnostics.classList.toggle("valid", valid);
  diagnostics.classList.toggle("invalid", !valid);
  $("#builder-health").textContent = valid ? t("GEÇERLİ") : t("HATALI");
  $("p", diagnostics).textContent = message;
}

async function validateBuilder() {
  if (!state.player) {
    openAuth("login");
    setBuilderResult(false, t("Manifesti doğrulamak ve indirmek için giriş yap."));
    return false;
  }
  const form = $("#mod-builder-form");
  if (!form.reportValidity()) {
    setBuilderResult(false, t("Kimlik alanlarında eksik veya geçersiz değer var."));
    switchBuilderTab("identity");
    return false;
  }
  renderBuilderManifest();
  try {
    const data = await api("/api/mod-builder/validate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({manifest: state.builderManifest}),
    });
    state.builderManifest = data.manifest;
    state.builderValidated = true;
    $("#manifest-preview").textContent = JSON.stringify(data.manifest, null, 2);
    $("#builder-download").disabled = false;
    setBuilderResult(true, data.warnings.length ? data.warnings.join(" • ") : t("Şema güvenli. Paket indirilmeye hazır."));
    return true;
  } catch (error) {
    state.builderValidated = false;
    $("#builder-download").disabled = true;
    setBuilderResult(false, error.message);
    return false;
  }
}

function downloadBuilderManifest() {
  if (!state.builderValidated || !state.builderManifest) return;
  const text = `${JSON.stringify(state.builderManifest, null, 2)}\n`;
  const blob = new Blob([text], {type: "application/json;charset=utf-8"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.builderManifest.id || "not-a-trap-mod"}.natmod`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast(t("Güvenli .natmod dosyası oluşturuldu."));
}

async function copyBuilderManifest() {
  const text = JSON.stringify(state.builderManifest || collectBuilderManifest(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast(t("Manifest JSON panoya kopyalandı."));
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast(t("Manifest JSON panoya kopyalandı."));
  }
}

function setBuilderField(name, value) {
  const field = $("#mod-builder-form").elements.namedItem(name);
  if (field) field.value = value;
}

function applyManifestToBuilder(manifest) {
  const form = $("#mod-builder-form");
  state.builderRestoring = true;
  ["id", "name", "version", "author", "description", "priority", "estimated_minutes", ...metadataFields].forEach(name => {
    if (manifest[name] != null) setBuilderField(name, manifest[name]);
  });
  listFields.forEach(name => setBuilderField(name, Array.isArray(manifest[name]) ? manifest[name].join(", ") : ""));
  const target = manifest.target_levels ?? "all";
  if (target === "all") {
    setBuilderField("target_mode", "all");
  } else {
    const levels = Array.isArray(target) ? target.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : parseTargetLevels(target);
    setBuilderField("target_mode", "custom");
    setBuilderField("target_custom", compressTargetLevels(levels));
    if (levels.length) { setBuilderField("target_start", levels[0]); setBuilderField("target_end", levels.at(-1)); }
  }
  numericRules.forEach(name => setBuilderField(name, manifest.rules?.[name] ?? ruleDefaults[name]));
  booleanRules.forEach(name => { const input = form.elements.namedItem(name); if (input) input.checked = Boolean(manifest.rules?.[name]); });
  setBuilderField("start_message", manifest.rules?.start_message || "");
  form.elements.namedItem("experimental").checked = Boolean(manifest.experimental);
  renderBuilderManifest();
  state.builderRestoring = false;
}

function updateBuilderHistoryButtons() {
  $("#builder-undo").disabled = state.builderHistoryIndex <= 0;
  $("#builder-redo").disabled = state.builderHistoryIndex >= state.builderHistory.length - 1;
}

function pushBuilderHistory() {
  if (state.builderRestoring) return;
  const snapshot = JSON.stringify(collectBuilderManifest());
  if (state.builderHistory[state.builderHistoryIndex] === snapshot) return;
  state.builderHistory = state.builderHistory.slice(0, state.builderHistoryIndex + 1);
  state.builderHistory.push(snapshot);
  if (state.builderHistory.length > 40) state.builderHistory.shift();
  state.builderHistoryIndex = state.builderHistory.length - 1;
  localStorage.setItem(BUILDER_DRAFT_KEY, snapshot);
  $("#builder-autosave").textContent = t("TASLAK KAYDEDİLDİ");
  updateBuilderHistoryButtons();
}

function scheduleBuilderHistory() {
  clearTimeout(state.builderHistoryTimer);
  $("#builder-autosave").textContent = t("KAYDEDİLİYOR…");
  state.builderHistoryTimer = setTimeout(pushBuilderHistory, 240);
}

function stepBuilderHistory(direction) {
  const next = state.builderHistoryIndex + direction;
  if (next < 0 || next >= state.builderHistory.length) return;
  state.builderHistoryIndex = next;
  applyManifestToBuilder(JSON.parse(state.builderHistory[next]));
  localStorage.setItem(BUILDER_DRAFT_KEY, state.builderHistory[next]);
  $("#builder-autosave").textContent = direction < 0 ? t("GERİ ALINDI") : t("İLERİ ALINDI");
  updateBuilderHistoryButtons();
}

function applyBuilderPreset(name) {
  const preset = builderPresets[name];
  if (!preset) return;
  const form = $("#mod-builder-form");
  numericRules.forEach(rule => setBuilderField(rule, ruleDefaults[rule]));
  booleanRules.forEach(rule => { form.elements.namedItem(rule).checked = false; });
  Object.entries(preset.rules).forEach(([rule, value]) => {
    if (numericRules.includes(rule)) setBuilderField(rule, value);
    else if (form.elements.namedItem(rule)) form.elements.namedItem(rule).checked = Boolean(value);
  });
  if (preset.category) setBuilderField("category", preset.category);
  if (preset.difficulty) setBuilderField("difficulty", preset.difficulty);
  form.elements.namedItem("experimental").checked = Boolean(preset.experimental);
  $$("[data-builder-preset]").forEach(button => button.classList.toggle("active", button.dataset.builderPreset === name));
  renderBuilderManifest();
  pushBuilderHistory();
  toast(t("Hazır reçete uygulandı; bütün değerleri değiştirebilirsin."));
}

function applyPhysicsPreset(name) {
  const preset = physicsPresets[name];
  if (!preset) return;
  Object.entries(preset).forEach(([rule, value]) => setBuilderField(rule, value));
  renderBuilderManifest();
  pushBuilderHistory();
}

function resetBuilder() {
  const form = $("#mod-builder-form");
  form.reset();
  if (state.player) $("#builder-author").value = state.player.username;
  $$("[data-builder-preset]").forEach(button => button.classList.remove("active"));
  switchBuilderTab("identity");
  renderBuilderManifest();
  pushBuilderHistory();
  $("#builder-health").textContent = t("BEKLİYOR");
  $("p", $("#builder-diagnostics")).textContent = t("Doğrulama bekleniyor.");
}

function loadBuilderFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyManifestToBuilder(JSON.parse(String(reader.result)));
      pushBuilderHistory();
      toast(t("Manifest atölyeye yüklendi."));
    } catch (_) {
      setBuilderResult(false, t("Dosya geçerli JSON değil."));
    }
  };
  reader.readAsText(file);
}

function setupBuilder() {
  const form = $("#mod-builder-form");
  $$(".builder-tab").forEach(button => button.addEventListener("click", () => switchBuilderTab(button.dataset.builderTab)));
  form.addEventListener("input", () => { renderBuilderManifest(); scheduleBuilderHistory(); });
  form.addEventListener("change", () => { renderBuilderManifest(); scheduleBuilderHistory(); });
  $$("[data-builder-preset]").forEach(button => button.addEventListener("click", () => applyBuilderPreset(button.dataset.builderPreset)));
  $$("[data-physics-preset]").forEach(button => button.addEventListener("click", () => applyPhysicsPreset(button.dataset.physicsPreset)));
  $("#builder-validate").addEventListener("click", validateBuilder);
  $("#builder-audit-run").addEventListener("click", validateBuilder);
  $("#builder-copy").addEventListener("click", copyBuilderManifest);
  $("#builder-download").addEventListener("click", downloadBuilderManifest);
  $("#builder-reset").addEventListener("click", resetBuilder);
  $("#builder-undo").addEventListener("click", () => stepBuilderHistory(-1));
  $("#builder-redo").addEventListener("click", () => stepBuilderHistory(1));
  $("#builder-load").addEventListener("click", () => $("#builder-file").click());
  $("#builder-file").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) loadBuilderFile(file);
    event.target.value = "";
  });
  try {
    const draft = localStorage.getItem(BUILDER_DRAFT_KEY);
    if (draft) applyManifestToBuilder(JSON.parse(draft));
    else renderBuilderManifest();
  } catch (_) { renderBuilderManifest(); }
  pushBuilderHistory();
}

function setupMenus() {
  const header = $(".site-header");
  $("#menu-button").addEventListener("click", event => {
    header.classList.toggle("menu-open"); event.currentTarget.setAttribute("aria-expanded", header.classList.contains("menu-open"));
  });
  $$(".site-header nav a").forEach(link => link.addEventListener("click", () => header.classList.remove("menu-open")));
  $$("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(dialog); }));
  $$(".mod-card").forEach(card => card.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) openMod(card.dataset.slug); }));
}

async function init() {
  setupReveal(); setupMenus(); setupFilters(); setupUpload(); setupStatus(); setupAuth(); setupBuilder();
  await Promise.all([loadStats(), loadMods(), refreshAuth()]);
  const last = localStorage.getItem("natrap-last-upload");
  if (last && location.hash === "#karantina") { try { openStatus(JSON.parse(last)); } catch (_) {} }
  if (location.hash.startsWith("#mod/")) openMod(location.hash.slice(5));
  if (new URLSearchParams(location.search).has("upload")) $("[data-open-upload]").click();
}

document.addEventListener("DOMContentLoaded", init);
