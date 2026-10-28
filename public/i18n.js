(() => {
  "use strict";

  const STORAGE_KEY = "natrap-language";
  const SUPPORTED = new Set(["tr", "en"]);

  const EN = Object.freeze({
    "NOT A TRAP // Community Vault": "NOT A TRAP // Community Vault",
    "NOT A TRAP modlarını keşfet, güvenli karantinadan geçir ve toplulukla paylaş.": "Discover NOT A TRAP mods, quarantine them safely, and share them with the community.",

    "Ana menü": "Main navigation",
    "OYUN": "GAME",
    "MODLAR": "MODS",
    "GÜVENLİK": "SECURITY",
    "MOD YÜKLE": "UPLOAD MOD",
    "Dil / Language": "Language / Dil",

    "DOSYA 220 / TOPLULUK BAĞLANTISI AÇIK": "FILE 220 / COMMUNITY LINK ONLINE",
    "OYUN SANA": "THE GAME",
    "YALAN SÖYLER.": "LIES TO YOU.",
    "MODLAR DA.": "SO DO MODS.",
    "220 bölümlük siyah-beyaz ultra troll platformer. Kuralları boz, başkasının hatasına gir, ama hiçbir pakete körü körüne güvenme.": "A 220-level black-and-white ultra-troll platformer. Break the rules, enter someone else's mistake, but never trust a package blindly.",
    "MODLARI KEŞFET": "DISCOVER MODS",
    "KENDİ HATANI YÜKLE": "UPLOAD YOUR MISTAKE",
    "BÖLÜM": "LEVELS",
    "ONAYLI MOD": "APPROVED MODS",
    "ZORUNLU KARANTİNA": "MANDATORY QUARANTINE",
    "NAT://RUN/LEVEL_220": "NAT://RUN/LEVEL_220",
    "DOĞRULANMIŞ OYUN GÖRÜNTÜSÜ": "VERIFIED GAME CAPTURE",
    "← ÇIKIŞ BURADA": "← EXIT IS HERE",
    "şimdilik": "for now",
    "PERDE 44/44": "ACT 44/44",
    "SCROLL": "SCROLL",

    "ULTRA TROLL PLATFORMER": "ULTRA TROLL PLATFORMER",
    "CREATE STUDIO": "CREATE STUDIO",
    "NINTENDO CONTROLLER": "NINTENDO CONTROLLER",
    "220 BÖLÜM": "220 LEVELS",
    "MOD STUDIO PRO 5": "MOD STUDIO PRO 5",

    "01 / PROTOKOL": "01 / PROTOCOL",
    "OYUNUN KURALI": "THE RULE OF THE GAME",
    "HİÇBİR ŞEYE": "TRUST",
    "GÜVENME.": "NOTHING.",
    "NOT A TRAP zemini, kontrolü, boyutu ve yerçekimini senden önce değiştirir. Topluluk modları bunu daha da ileri götürür: yeni fizik deneyleri, erişilebilirlik paketleri, yapımcı araçları ve kabus rotaları.": "NOT A TRAP changes the floor, controls, scale, and gravity before you can react. Community mods push it further with physics experiments, accessibility packs, creator tools, and nightmare routes.",
    "Her mod veri olarak okunur. Kod çalıştırılmaz. Dosya temiz görünse bile tam 24 saat indirmeye kapalı kalır.": "Every mod is read as data. No code is executed. Even a clean-looking file remains locked from downloads for a full 24 hours.",
    "GÜVENLİK KATMANLARINI İNCELE": "INSPECT THE SECURITY LAYERS",
    "ZEMİN": "FLOOR",
    "YALAN": "FALSE",
    "YERÇEKİMİ": "GRAVITY",
    "ŞÜPHELİ": "SUSPICIOUS",
    "ÇIKIŞ": "EXIT",
    "KAÇIYOR": "ESCAPING",
    "MOD DOSYASI": "MOD FILE",
    "TARANIYOR": "SCANNING",

    "02 / OYUN DOSYALARI": "02 / GAME FILES",
    "İÇERİDEN GÖRÜNTÜLER": "CAPTURES FROM INSIDE",
    "Monokrom laboratuvar. Hareket eden kurallar. Seni hatırlayan bir oyun.": "A monochrome laboratory. Rules that move. A game that remembers you.",
    "ANA DOSYA / 00": "MAIN FILE / 00",
    "OYUN SANA YALAN SÖYLER": "THE GAME LIES TO YOU",
    "CREATE / 01": "CREATE / 01",
    "KENDİ TUZAĞINI KUR": "BUILD YOUR OWN TRAP",
    "MOD MANAGER / 01": "MOD MANAGER / 01",
    "HER KURALI GÖR": "SEE EVERY RULE",

    "03 / TOPLULUK ARŞİVİ": "03 / COMMUNITY ARCHIVE",
    "ONAYLANMIŞ HATALAR": "APPROVED MISTAKES",
    "Yalnızca taramadan geçmiş ve 24 saatlik karantinasını tamamlamış paketler.": "Only packages that passed scanning and completed their 24-hour quarantine.",
    "FİLTRE / 01": "FILTER / 01",
    "TEMİZLE": "CLEAR",
    "ARAMA": "SEARCH",
    "Mod, yapımcı, etiket...": "Mod, creator, tag...",
    "KATEGORİ": "CATEGORY",
    "TÜM DOSYALAR": "ALL FILES",
    "DEBUG / CREATOR": "DEBUG / CREATOR",
    "Her indirme SHA-256 kimliğiyle teslim edilir.": "Every download is delivered with a SHA-256 identity.",
    "DOSYA BULUNDU": "FILES FOUND",
    "SIRALA": "SORT",
    "YENİ": "NEWEST",
    "EN ÇOK İNDİRİLEN": "MOST DOWNLOADED",
    "ADA GÖRE": "BY NAME",
    "RESMÎ": "OFFICIAL",
    "DOSYA YOK.": "NO FILES.",
    "Filtreyi değiştir veya ilk modu sen gönder.": "Change the filter or submit the first mod.",
    "BAĞLANTI KOPTU.": "CONNECTION LOST.",

    "04 / GÜVENLİK LABORATUVARI": "04 / SECURITY LAB",
    "24 SAAT / DEĞİŞMEZ KURAL": "24 HOURS / IMMUTABLE RULE",
    "TEMİZSE BİLE": "EVEN IF CLEAN,",
    "HEMEN YAYINLANMAZ.": "IT IS NOT PUBLISHED AT ONCE.",
    "Onay saati, yükleme anından tam 24 saat sonradır. Herhangi bir katman şüphe üretirse otomatik yayın durur ve insan incelemesine geçer.": "Approval time is exactly 24 hours after upload. If any layer raises suspicion, automatic release stops and human review begins.",
    "KARANTİNA": "QUARANTINE",
    "Dosya rastgele adla izole depoya alınır. Doğrudan indirilemez.": "The file is stored under a random name in isolation. It cannot be downloaded directly.",
    "ŞEMA + ARŞİV": "SCHEMA + ARCHIVE",
    "İzinli kurallar, JSON sınırları, yol kaçışı ve zip bombası denetlenir.": "Allowed rules, JSON limits, path traversal, and zip-bomb risks are checked.",
    "ANTİVİRÜS": "ANTIVIRUS",
    "Microsoft Defender, ClamAV veya sunucuda tanımlı tarayıcı paketi inceler.": "Microsoft Defender, ClamAV, or the server-configured scanner inspects the package.",
    "YAYIN": "RELEASE",
    "Yalnızca temiz sonuç, süre kilidi açıldığında topluluğa çıkar.": "Only a clean result reaches the community when the time lock opens.",
    "GÜVENLİK NOTU / 01": "SECURITY NOTE / 01",
    "Hiçbir antivirüs yüzde yüz garanti vermez. Bu sistem riski azaltır; `.natmod` paketleri oyun tarafından veri olarak okunur ve içindeki kod çalıştırılmaz.": "No antivirus provides a 100% guarantee. This system reduces risk; `.natmod` packages are read by the game as data and their code is never executed.",

    "05 / SENİN HATAN": "05 / YOUR MISTAKE",
    "KURALI BOZDUN MU?": "DID YOU BREAK THE RULE?",
    "Mod Studio Pro 5 ile ürettiğin paketi gönder. Tarama raporunu ve 24 saatlik geri sayımı canlı izle.": "Submit the package you built with Mod Studio Pro 5. Watch its scan report and 24-hour countdown live.",
    "MODU KARANTİNAYA GÖNDER": "SEND MOD TO QUARANTINE",

    "GEZİN": "EXPLORE",
    "Oyun": "Game",
    "Modlar": "Mods",
    "Güvenlik": "Security",
    "YAPIMCI": "CREATOR",
    "Mod yükle": "Upload mod",
    "Paket kuralları": "Package rules",
    "Sistem durumu": "System status",
    "SİSTEM AKTİF": "SYSTEM ONLINE",
    "OYUN SANA YALAN SÖYLER.": "THE GAME LIES TO YOU.",

    "YENİ DOSYA / KARANTİNA": "NEW FILE / QUARANTINE",
    "MOD ADI": "MOD NAME",
    "Örn. Ters Koridor": "E.g. Reverse Corridor",
    "SÜRÜM": "VERSION",
    "YAPIMCI": "CREATOR",
    "Rumuzun": "Your handle",
    "OYUN SÜRÜMÜ": "GAME VERSION",
    "KISA AÇIKLAMA": "SHORT SUMMARY",
    "Kartta görünecek tek cümle": "One sentence shown on the card",
    "AYRINTILI AÇIKLAMA": "DETAILED DESCRIPTION",
    "Mod neyi değiştiriyor? Nasıl oynanmalı?": "What does the mod change? How should it be played?",
    "LİSANS": "LICENSE",
    "ETİKETLER": "TAGS",
    "DOSYAYI BURAYA BIRAK": "DROP FILE HERE",
    ".NATMOD veya güvenli .ZIP / EN FAZLA 32 MB": ".NATMOD or safe .ZIP / MAX 32 MB",
    "DOSYA SEÇİLMEDİ": "NO FILE SELECTED",
    "JSON / ŞEMA DENETİMİ": "JSON / SCHEMA CHECK",
    "ARŞİV İZOLASYONU": "ARCHIVE ISOLATION",
    "ANTİVİRÜS TARAMASI": "ANTIVIRUS SCAN",
    "24 SAAT SÜRE KİLİDİ": "24-HOUR TIME LOCK",
    "Dosyanın bana ait olduğunu ve güvenlik incelemesini kabul ediyorum.": "I own this file and accept the security review.",
    "Yükleme başladığında bu pencereyi kapatabilirsiniz; takip kodun cihazda saklanır.": "You may close this window after upload begins; your tracking code is stored on this device.",
    "KARANTİNAYI BAŞLAT": "START QUARANTINE",
    "DOSYA İZOLASYONA ALINIYOR…": "ISOLATING FILE…",
    "Bağlantıyı kapatma; dosya karantina deposuna aktarılıyor.": "Do not close the connection; the file is moving into quarantine storage.",

    "CANLI TARAMA / 24H": "LIVE SCAN / 24H",
    "DOSYA İNCELENİYOR": "FILE UNDER REVIEW",
    "YAYINA KALAN": "TIME TO RELEASE",
    "TAKİP KODU": "TRACKING CODE",
    "KOPYALA": "COPY",
    "Tarama sırasına alındı.": "Queued for scanning.",
    "DOSYA TARANIYOR": "SCANNING FILE",
    "KARANTİNA AKTİF": "QUARANTINE ACTIVE",
    "DOSYA ONAYLANDI": "FILE APPROVED",
    "DOSYA REDDEDİLDİ": "FILE REJECTED",
    "İNSAN İNCELEMESİ": "HUMAN REVIEW",
    "ONAYLANDI": "APPROVED",
    "TARAMA SIRASI": "SCAN QUEUE",
    "İşçi hazırlanıyor.": "Scanner worker is getting ready.",
    "DOSYA YAYINDA.": "FILE IS LIVE.",
    "MOD SAYFASINI AÇ": "OPEN MOD PAGE",

    "DOSYA AÇILIYOR": "OPENING FILE",
    "BEKLE…": "WAIT…",
    "HATA": "ERROR",
    "DOSYA AÇILAMADI": "FILE COULD NOT OPEN",
    "ONAYLI DOSYA": "APPROVED FILE",
    "MOD KAYDI": "MOD RECORD",
    "TOPLULUK NOTLARI": "COMMUNITY NOTES",
    "İLK YORUMU SEN YAZ.": "WRITE THE FIRST REVIEW.",
    "Bu mod hakkında ne düşünüyorsun?": "What do you think about this mod?",
    "YORUMU KAYDET": "SAVE REVIEW",
    "PAKET BOYUTU": "PACKAGE SIZE",
    "İNDİRME": "DOWNLOADS",
    "MODU İNDİR ↓": "DOWNLOAD MOD ↓",
    "24H ONAYLI PAKET": "24H APPROVED PACKAGE",
    "Yine de yalnızca NOT A TRAP Mod Manager ile aç.": "Still, open it only with the NOT A TRAP Mod Manager.",

    "Yorum dosyaya işlendi.": "Review added to the file.",
    "Karantina başladı. Takip kodun bu cihazda saklandı.": "Quarantine started. Your tracking code is stored on this device.",
    "Takip kodu kopyalandı.": "Tracking code copied.",
    "İstek başarısız.": "Request failed.",
    "Dosya yükleniyor…": "Loading file…",

    "PROFİL": "PROFILE",
    "ATÖLYE": "WORKSHOP",
    "MOD YAP": "BUILD MOD",
    "GİRİŞ YAP": "SIGN IN",
    "OYUNCU HESABI": "PLAYER ACCOUNT",
    "01 / OYUNCU DOSYASI": "01 / PLAYER FILE",
    "OYUN SENİ": "THE GAME",
    "HATIRLIYOR.": "REMEMBERS YOU.",
    "Oyunda kullandığın hesapla giriş yap. İlerlemen, ölüm sayın, denemelerin ve açtığın başarımlar tek dosyada görünür.": "Sign in with the account you use in the game. Your progress, deaths, attempts, and unlocked achievements appear in one file.",
    "DOSYA ŞİFRELİ / OTURUM YOK": "FILE ENCRYPTED / NO SESSION",
    "İSTATİSTİKLERİ AÇ": "UNLOCK STATISTICS",
    "Oyundaki kullanıcı adın ve şifrenle giriş yap veya yeni bir yerel hesap oluştur.": "Sign in with your in-game username and password or create a new local account.",
    "GİRİŞ YAP / KAYIT OL": "SIGN IN / REGISTER",
    "AKTİF OYUNCU": "ACTIVE PLAYER",
    "SON OYUN": "LAST PLAYED",
    "OTURUMU KAPAT →": "SIGN OUT →",
    "OYUN İLERLEMESİ": "GAME PROGRESS",
    "ULAŞILAN BÖLÜM": "LEVEL REACHED",
    "TAMAMLANAN": "COMPLETED",
    "DOSYA": "FILES",
    "ÖLÜM": "DEATHS",
    "TEKRAR": "RETRIES",
    "DENEME": "ATTEMPTS",
    "TOPLAM": "TOTAL",
    "BAŞARIMLAR": "ACHIEVEMENTS",
    "AÇIK": "UNLOCKED",
    "DOSYA BAĞLI": "FILE LINKED",
    "İLK HATA": "FIRST MISTAKE",
    "İLK PERDE": "FIRST ACT",
    "CREATE AÇILDI": "CREATE UNLOCKED",
    "KAOS USTASI": "CHAOS MASTER",
    "HİÇBİR ŞEYE GÜVENMEDİ": "TRUSTED NOTHING",
    "100 KERE YİNE": "ONE HUNDRED RETRIES",

    "02 / PROTOKOL": "02 / PROTOCOL",
    "03 / OYUN DOSYALARI": "03 / GAME FILES",
    "04 / MOD ATÖLYESİ": "04 / MOD WORKSHOP",
    "KURALI": "REWRITE",
    "YENİDEN YAZ.": "THE RULE.",
    "Tarayıcıdan güvenli `.natmod` üret. Fizik değerlerini ayarla, tuzak davranışlarını seç, hedef bölümleri belirle ve paketi anında doğrula.": "Build a safe `.natmod` in your browser. Tune physics, choose hazard behavior, set target levels, and validate the package instantly.",
    "YENİ DOSYA": "NEW FILE",
    "DOSYA AÇ": "OPEN FILE",
    "KİMLİK": "IDENTITY",
    "FİZİK": "PHYSICS",
    "TUZAKLAR": "HAZARDS",
    "GELİŞMİŞ": "ADVANCED",
    "ŞEMA DURUMU": "SCHEMA STATUS",
    "BEKLİYOR": "WAITING",
    "Kod çalıştırmaz; yalnızca doğrulanmış JSON üretir.": "Runs no code; produces validated JSON only.",
    "MOD KİMLİĞİ": "MOD IDENTITY",
    "Oyunda ve topluluk arşivinde görünen temel bilgiler.": "Core information shown in the game and community archive.",
    "küçük harf / nokta / tire": "lowercase / dot / dash",
    "SÜRÜM": "VERSION",
    "MOD ADI": "MOD NAME",
    "YAPIMCI": "CREATOR",
    "AÇIKLAMA": "DESCRIPTION",
    "HEDEF BÖLÜMLER": "TARGET LEVELS",
    "BAŞLANGIÇ MESAJI": "START MESSAGE",
    "all veya 1,5,20-30": "all or 1,5,20-30",
    "Bu bölüm artık farklı.": "This level is different now.",
    "KURAL MATRİSİ": "RULE MATRIX",
    "FİZİK MOTORU": "PHYSICS ENGINE",
    "Sayısal değerler güvenli aralıkların dışına çıkamaz.": "Numeric values cannot leave their safe ranges.",
    "OYUNCU HIZI": "PLAYER SPEED",
    "ZIPLAMA GÜCÜ": "JUMP POWER",
    "OYUNCU BOYUTU": "PLAYER SCALE",
    "TUZAK HIZI": "HAZARD SPEED",
    "BOOLEAN GRID": "BOOLEAN GRID",
    "TUZAK VE DÜNYA": "HAZARDS AND WORLD",
    "Bir anahtarı açtığında manifest yalnızca o değişikliği içerir.": "When you enable a switch, the manifest includes only that change.",
    "TERS YERÇEKİMİ": "REVERSE GRAVITY",
    "Tavana düş": "Fall toward the ceiling",
    "DİKENLERİ KAPAT": "DISABLE SPIKES",
    "Diken hasarı yok": "No spike damage",
    "TESTERELERİ KAPAT": "DISABLE SAWS",
    "Testere hasarı yok": "No saw damage",
    "LAZERLERİ KAPAT": "DISABLE LASERS",
    "Lazer hasarı yok": "No laser damage",
    "DÜŞENLERİ KAPAT": "DISABLE DROPS",
    "Düşen bloklar yok": "No falling blocks",
    "RÜZGÂRI KAPAT": "DISABLE WIND",
    "İtme kuvveti yok": "No push force",
    "TERS KONTROL YOK": "NO REVERSED CONTROLS",
    "Ayna bölgeleri kapanır": "Mirror zones are disabled",
    "PORTALLARI KAPAT": "DISABLE PORTALS",
    "Geri atma yok": "No teleporting back",
    "PLATFORMLARI DONDUR": "FREEZE PLATFORMS",
    "Hareket durur": "Movement stops",
    "TUZAKLARI DONDUR": "FREEZE HAZARDS",
    "Zaman durur": "Hazard time stops",
    "Geliştirici ve erişilebilirlik seçenekleri. Çalıştırılabilir kod eklenmez.": "Developer and accessibility options. No executable code is added.",
    "HAVA ZIPLAMASI": "AIR JUMP",
    "Sınırsız hava zıplaması": "Unlimited air jumps",
    "OTOMATİK ZIPLA": "AUTO JUMP",
    "Temasta zıpla": "Jump on contact",
    "SONSUZ COYOTE": "INFINITE COYOTE",
    "Geç zıplama açık": "Late jumping enabled",
    "TANRI MODU": "GOD MODE",
    "Ölüm devre dışı": "Deaths disabled",
    "Çarpışma devre dışı": "Collision disabled",
    "HITBOX GÖSTER": "SHOW HITBOXES",
    "Fizik sınırlarını çiz": "Draw physics boundaries",
    "TETİKLERİ GÖSTER": "SHOW TRIGGERS",
    "Gizli alanları çiz": "Draw hidden zones",
    "ROTAYI GÖSTER": "SHOW ROUTE",
    "Çıkış yolunu çiz": "Draw the exit route",
    "ÇIKIŞI ZORLA": "FORCE EXIT",
    "Kapı hep görünür": "Door always visible",
    "DENEYSEL PAKET": "EXPERIMENTAL PACKAGE",
    "Uyarı etiketi ekle": "Add warning label",
    "CANLI MANIFEST": "LIVE MANIFEST",
    "Doğrulama bekleniyor.": "Waiting for validation.",
    "ŞEMAYI DOĞRULA": "VALIDATE SCHEMA",
    ".NATMOD İNDİR": "DOWNLOAD .NATMOD",
    "DEĞİŞTİRİLDİ": "MODIFIED",
    "Değişikliklerden sonra yeniden doğrula.": "Validate again after making changes.",
    "GEÇERLİ": "VALID",
    "HATALI": "INVALID",
    "Manifesti doğrulamak ve indirmek için giriş yap.": "Sign in to validate and download the manifest.",
    "Kimlik alanlarında eksik veya geçersiz değer var.": "Identity fields contain missing or invalid values.",
    "Şema güvenli. Paket indirilmeye hazır.": "Schema is safe. The package is ready to download.",
    "Güvenli .natmod dosyası oluşturuldu.": "Safe .natmod file created.",
    "Manifest atölyeye yüklendi.": "Manifest loaded into the workshop.",
    "Dosya geçerli JSON değil.": "The file is not valid JSON.",
    "Oyunun gerçekten okuyabildiği ayrıntılı `.natmod` paketleri üret. 31 güvenli kuralı, bölüm kapsamını, sürüm bilgisini ve uyumluluk notlarını tek stüdyoda yönet.": "Build detailed `.natmod` packages the game can actually read. Manage 31 safe rules, level scope, release data, and compatibility notes in one studio.",
    "TASLAK HAZIR": "DRAFT READY",
    "GERİ": "UNDO",
    "İLERİ": "REDO",
    "KAPSAM": "SCOPE",
    "DÜNYA": "WORLD",
    "OYUNCU": "PLAYER",
    "YAYIN": "RELEASE",
    "TEST": "TEST",
    "Yerel taslak otomatik kaydedilir. Paket hiçbir çalıştırılabilir kod içermez.": "The local draft is saved automatically. The package contains no executable code.",
    "Sıfırdan başla veya oyun tarzına göre hazırlanmış bir reçeteyi düzenle.": "Start from scratch or edit a recipe prepared for a play style.",
    "Hazır mod reçeteleri": "Mod recipe presets",
    "DENGELİ+": "BALANCED+",
    "Akıcı, adil fizik": "Smooth, fair physics",
    "KÂBUS": "NIGHTMARE",
    "Hızlı ve acımasız": "Fast and merciless",
    "ERİŞİLEBİLİR": "ACCESSIBLE",
    "Rota ve tolerans": "Route and tolerance",
    "Bütün veriyi göster": "Show all data",
    "ULTRA TROLL": "ULTRA TROLL",
    "Kurallar yalan söyler": "The rules lie",
    "BÖLÜM KAPSAMI": "LEVEL SCOPE",
    "Modun hangi bölümlerde çalışacağını belirle. Aralıklar oyun için gerçek bölüm listesine çevrilir.": "Choose which levels run this mod. Ranges are converted into a real level list for the game.",
    "TÜM OYUN": "WHOLE GAME",
    "1–220 bölüm": "Levels 1–220",
    "TEK ARALIK": "ONE RANGE",
    "Başlangıç / bitiş": "Start / end",
    "ÖZEL LİSTE": "CUSTOM LIST",
    "İLK BÖLÜM": "FIRST LEVEL",
    "SON BÖLÜM": "LAST LEVEL",
    "ÖZEL BÖLÜMLER": "CUSTOM LEVELS",
    "virgül ve aralık kullanılabilir": "commas and ranges supported",
    "BÖLÜM BAŞLANGIÇ MESAJI": "LEVEL START MESSAGE",
    "MOD AKTİF": "MOD ACTIVE",
    "NORMAL OYUN": "NORMAL GAME",
    "HIZLI PROFİL": "QUICK PROFILE",
    "AY YÜRÜYÜŞÜ": "MOON WALK",
    "AĞIRLIK": "HEAVY",
    "KOŞU PROFİLİ": "RUN PROFILE",
    "Temel hıza göre": "Compared with base speed",
    "HAVADA KALIŞ": "AIR TIME",
    "Zıplama / yerçekimi": "Jump / gravity",
    "TEHLİKE TEMPOSU": "DANGER TEMPO",
    "Tuzak devri": "Hazard cycle",
    "Ölüm mekaniklerini tek tek yönet; zamanı, platformları ve sahne kurallarını değiştir.": "Control death mechanics one by one; alter time, platforms, and scene rules.",
    "ÖLÜMCÜL NESNELER": "LETHAL OBJECTS",
    "EZİCİYİ KAPAT": "DISABLE CRUSHER",
    "Tavan ezicisi durur": "Ceiling crusher stops",
    "KOVALAYAN DUVAR YOK": "NO CHASING WALL",
    "Takip duvarı durur": "Chasing wall stops",
    "ZEMİN KAYBOLMAZ": "FLOOR NEVER BLINKS",
    "Faz platformları sabit": "Phase platforms stay solid",
    "ZEMİN ÇÖKMEZ": "FLOOR NEVER FALLS",
    "Çöken platformlar sabit": "Falling platforms stay solid",
    "DÜNYA SİSTEMLERİ": "WORLD SYSTEMS",
    "FLIP ÇİZGİLERİ KAPALI": "FLIP LINES OFF",
    "Zorunlu dönüş yok": "No forced gravity flip",
    "YAVAŞ ZAMAN": "SLOW TIME",
    "Tuzaklar %28 hızda": "Hazards run at 28% speed",
    "OYUNCU MODÜLLERİ": "PLAYER MODULES",
    "Hareket, erişilebilirlik, görünüm ve geliştirici verilerini birlikte tasarla.": "Design movement, accessibility, appearance, and developer data together.",
    "HAREKET VE ERİŞİLEBİLİRLİK": "MOVEMENT AND ACCESSIBILITY",
    "BOŞLUK ÖLDÜRMEZ": "FALLS DO NOT KILL",
    "Düşünce geri dön": "Return after falling",
    "ÇIKIŞ AURASI": "EXIT AURA",
    "Kapıyı uzaktan etkinleştir": "Activate the door remotely",
    "HAYALET GÖRÜNÜM": "GHOST APPEARANCE",
    "Karakter yarı saydam": "Character becomes translucent",
    "İZİ KAPAT": "DISABLE TRAIL",
    "Koşu gölgeleri gizli": "Hide running afterimages",
    "GELİŞTİRİCİ GÖRÜNÜMÜ": "DEVELOPER VIEW",
    "CANLI FİZİK VERİSİ": "LIVE PHYSICS DATA",
    "Hız ve konumu yaz": "Display velocity and position",
    "YAYIN DOSYASI": "RELEASE FILE",
    "Mod yöneticisinin göstereceği sınıflandırma, bağımlılık ve sürüm notlarını tamamla.": "Complete the classification, dependencies, and release notes shown by the mod manager.",
    "KATEGORİ": "CATEGORY",
    "ZORLUK": "DIFFICULTY",
    "HEDEF KİTLE": "AUDIENCE",
    "YAYIN KANALI": "RELEASE CHANNEL",
    "DİL": "LANGUAGE",
    "TAHMİNİ SÜRE": "ESTIMATED TIME",
    "dakika": "minutes",
    "ÖNCELİK": "PRIORITY",
    "LİSANS": "LICENSE",
    "Belirtilmedi": "Not specified",
    "ETİKETLER": "TAGS",
    "virgülle ayır": "comma separated",
    "DESTEKLENEN GİRİŞLER": "SUPPORTED INPUTS",
    "BAĞIMLILIKLAR": "DEPENDENCIES",
    "mod kimlikleri": "mod identifiers",
    "ÇAKIŞAN MODLAR": "CONFLICTING MODS",
    "ANA SAYFA": "HOMEPAGE",
    "UYUMLULUK NOTLARI": "COMPATIBILITY NOTES",
    "İÇERİK UYARILARI": "CONTENT WARNINGS",
    "KURULUM NOTLARI": "INSTALLATION NOTES",
    "DEĞİŞİKLİK GÜNLÜĞÜ": "CHANGELOG",
    "EMEĞİ GEÇENLER": "CREDITS",
    "Mod yöneticisinde açık uyarı etiketi gösterir.": "Shows a clear warning label in the mod manager.",
    "PAKET TESTİ": "PACKAGE TEST",
    "Dosyayı indirmeden önce kapsamı, zorluğu, çakışmaları ve güvenli şemayı incele.": "Inspect scope, difficulty, conflicts, and the safe schema before downloading.",
    "ETKİN KURAL": "ACTIVE RULES",
    "Değiştirilen parametre": "Changed parameters",
    "ZORLUK SKORU": "DIFFICULTY SCORE",
    "HEDEF": "TARGET",
    "RİSK SINIFI": "RISK CLASS",
    "Veri paketi": "Data package",
    "ÇAKIŞMA DENETİMİ": "CONFLICT CHECK",
    "Henüz çakışma bulunmadı.": "No conflict found yet.",
    "PAKET KONTROL LİSTESİ": "PACKAGE CHECKLIST",
    "Kimlik alanları": "Identity fields",
    "Bölüm kapsamı": "Level scope",
    "Oyun kuralı": "Game rule",
    "Yayın bilgileri": "Release information",
    "TAM ŞEMA TESTİNİ ÇALIŞTIR": "RUN FULL SCHEMA TEST",
    "Sunucu doğrulaması + güvenlik kuralları": "Server validation + security rules",
    "KURAL": "RULES",
    "SKOR": "SCORE",
    "JSON KOPYALA": "COPY JSON",
    "TASLAK KAYDEDİLDİ": "DRAFT SAVED",
    "KAYDEDİLİYOR…": "SAVING…",
    "GERİ ALINDI": "UNDONE",
    "İLERİ ALINDI": "REDONE",
    "Manifest JSON panoya kopyalandı.": "Manifest JSON copied to clipboard.",
    "Hazır reçete uygulandı; bütün değerleri değiştirebilirsin.": "Recipe applied; every value remains editable.",
    "Çakışma bulunmadı; kurallar birlikte çalışabilir.": "No conflicts found; these rules can work together.",
    "DÜŞÜK": "LOW",
    "ORTA": "MEDIUM",
    "YÜKSEK": "HIGH",
    "DENGELİ": "BALANCED",
    "ZOR": "HARD",
    "İMKÂNSIZ": "IMPOSSIBLE",
    "Tuzaklar hem donduruluyor hem yavaşlatılıyor; dondurma baskın gelir.": "Hazards are both frozen and slowed; freezing takes precedence.",
    "Tanrı modu açıkken kapatılan ölüm tuzakları gereksiz olabilir.": "Disabled death hazards may be redundant while God mode is active.",
    "Noclip açıkken hava zıplaması hareketi değiştirmez.": "Air jump does not affect movement while noclip is active.",
    "Başlangıç yerçekimi ters; bölüm içi flip çizgileri devre dışı.": "Starting gravity is reversed while in-level flip lines are disabled.",
    "Çıkış hem zorlanıyor hem uzaktan etkinleşiyor; bölüm çok erken bitebilir.": "The exit is forced and remotely activated; the level may end too early.",
    "Özel bölüm listesi boş; mod hiçbir bölümde çalışmaz.": "The custom level list is empty; the mod will run nowhere.",
    "Vanilla değerlerinden farklı en az bir oyun kuralı seç.": "Choose at least one game rule that differs from vanilla.",

    "05 / TOPLULUK ARŞİVİ": "05 / COMMUNITY ARCHIVE",
    "06 / GÜVENLİK LABORATUVARI": "06 / SECURITY LAB",
    "07 / SENİN HATAN": "07 / YOUR MISTAKE",
    "Mod yap": "Build mod",
    "Profil": "Profile",
    "Atölye": "Workshop",

    "OYUNCU DOSYASI / YEREL HESAP": "PLAYER FILE / LOCAL ACCOUNT",
    "Oyunda oluşturduğun hesapla devam et. Profil istatistiklerin aynı yerel dosyadan okunur.": "Continue with the account you created in the game. Profile statistics are read from the same local file.",
    "Oyunda ve sitede kullanacağın yerel oyuncu dosyasını oluştur.": "Create the local player file you will use in both the game and website.",
    "KULLANICI ADI": "USERNAME",
    "Oyuncu adın": "Your player name",
    "ŞİFRE": "PASSWORD",
    "ŞİFRE TEKRAR": "REPEAT PASSWORD",
    "Parola düz metin olarak saklanmaz.": "Your password is never stored as plain text.",
    "HESAP OLUŞTUR": "CREATE ACCOUNT",
    "HESABIN YOK MU? KAYIT OL": "NO ACCOUNT? REGISTER",
    "ZATEN HESABIN VAR MI? GİRİŞ YAP": "ALREADY HAVE AN ACCOUNT? SIGN IN",
    "Şifreler aynı değil.": "Passwords do not match.",
    "Oyuncu dosyası doğrulanıyor…": "Verifying player file…",
    "Hesap oluşturuldu ve giriş yapıldı.": "Account created and signed in.",
    "Giriş başarılı.": "Signed in successfully.",
    "Oyuncu dosyası bağlandı.": "Player file linked.",
    "Oturum kapatıldı.": "Signed out."
  });

  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let currentLanguage = "tr";
  let mutationQueued = false;

  function detectInitialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.has(saved)) return saved;
    return String(navigator.language || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  }

  function translateValue(value) {
    if (currentLanguage === "tr") return value;
    return EN[value] || value;
  }

  function preserveWhitespace(source, replacement) {
    const left = source.match(/^\s*/)?.[0] || "";
    const right = source.match(/\s*$/)?.[0] || "";
    return left + replacement + right;
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return ["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(parent.tagName);
  }

  function applyText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (shouldSkipTextNode(node)) continue;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue || "");
      const source = originalText.get(node);
      const trimmed = source.trim();
      if (!trimmed) continue;
      node.nodeValue = preserveWhitespace(source, translateValue(trimmed));
    }
  }

  function applyAttributes(root) {
    const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const element of elements) {
      if (!originalAttributes.has(element)) originalAttributes.set(element, {});
      const saved = originalAttributes.get(element);
      for (const attribute of ["placeholder", "title", "aria-label"]) {
        if (!element.hasAttribute(attribute)) continue;
        if (!(attribute in saved)) saved[attribute] = element.getAttribute(attribute);
        element.setAttribute(attribute, translateValue(saved[attribute]));
      }
    }
  }

  function updateLanguageButtons() {
    document.querySelectorAll("[data-language]").forEach(button => {
      const active = button.dataset.language === currentLanguage;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    });
  }

  function apply(root = document.body) {
    if (!root) return;
    applyText(root);
    applyAttributes(root);
    document.documentElement.lang = currentLanguage;
    document.title = translateValue("NOT A TRAP // Community Vault");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = translateValue("NOT A TRAP modlarını keşfet, güvenli karantinadan geçir ve toplulukla paylaş.");
    updateLanguageButtons();
  }

  function setLanguage(language) {
    if (!SUPPORTED.has(language)) return;
    currentLanguage = language;
    localStorage.setItem(STORAGE_KEY, language);
    apply(document.body);
    document.dispatchEvent(new CustomEvent("natrap:language", { detail: { language } }));
  }

  function scheduleMutationApply() {
    if (mutationQueued) return;
    mutationQueued = true;
    queueMicrotask(() => {
      mutationQueued = false;
      apply(document.body);
    });
  }

  currentLanguage = detectInitialLanguage();
  window.NATI18N = Object.freeze({
    apply,
    setLanguage,
    getLanguage: () => currentLanguage,
    t: value => translateValue(value)
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-language]").forEach(button => {
      button.addEventListener("click", () => setLanguage(button.dataset.language));
    });
    apply(document.body);
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.addedNodes.length > 0)) scheduleMutationApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
