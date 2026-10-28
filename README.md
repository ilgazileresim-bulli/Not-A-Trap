# NOT A TRAP — Community Vault

NOT A TRAP modlarını tanıtan, yükleyen, karantinada tarayan ve güvenli paketleri topluluğa açan yerel web uygulaması. Ön yüz ve arka uç birlikte gelir; harici Python paketi gerektirmez.

## Hızlı başlangıç

1. `start.bat` dosyasına çift tıklayın.
2. Tarayıcıda `http://127.0.0.1:8765` açılır.
3. Siteyi kapatmak için siyah sunucu penceresinde `Ctrl+C` kullanın.

Python 3.11 veya daha yeni bir sürüm önerilir. `check.bat` sözdizimi ve güvenlik testlerini çalıştırır.

Arayüz Türkçe ve İngilizce çalışır. Sağ üstteki `TR / EN` seçimi tarayıcıda saklanır; sonradan yüklenen mod kartları, tarama durumları ve hata mesajları da seçilen dile göre anında yenilenir. `polish.css` masaüstü, dar pencere, tablet ve telefon düzenlerini ayrı ayrı yönetir; oyun görselleri kırpılmadan özgün oranlarında gösterilir.

## Oyuncu hesabı ve profil istatistikleri

Oyun ile web sitesi `%APPDATA%/Godot/app_userdata/NOT A TRAP/not_a_trap_accounts.json` dosyasındaki aynı yerel oyuncu profilini kullanır. İlk oyun açılışında hesap oluşturma/giriş ekranı gösterilir. Kullanıcı adı açık tutulur; parola ise rastgele tuz ve 4096 turluk SHA-256 özetiyle saklanır, düz metin parola diske yazılmaz.

Web sitesindeki giriş HttpOnly, SameSite oturum çerezi kullanır. Girişten sonra ulaşılan bölüm, tamamlanan dosya, ölüm, deneme, son oynama ve başarımlar profil panelinde görünür. Bu sistem yerel sürüm içindir; internet üretimine taşınırsa hesap verileri merkezi veritabanına ve HTTPS arkasındaki daha güçlü parola türetme altyapısına geçirilmelidir.

## Tarayıcı Mod Atölyesi

`MOD ATÖLYESİ` yedi çalışma alanına ayrılır: kimlik, 220 bölümlük kapsam, fizik, dünya/tuzak, oyuncu modülleri, yayın bilgileri ve paket testi. Oyunun desteklediği 31 güvenli kuralın tamamı; kategori, zorluk, öncelik, lisans, bağımlılık, çakışma, sürüm notu ve giriş aygıtı bilgileriyle birlikte düzenlenebilir. Hazır reçeteler, fizik profilleri, canlı zorluk skoru, çakışma uyarıları, geri al/ileri al ve tarayıcıda otomatik taslak kaydı bulunur. Geçerli dosya doğrudan `.natmod` olarak indirilebilir veya mevcut bir `.natmod` yeniden açılıp düzenlenebilir. Atölye çalıştırılabilir kod üretmez.

## 24 saatlik onay akışı

1. Dosya `uploads/quarantine` içine rastgele adla yazılır.
2. SHA-256 kimliği hesaplanır.
3. `.natmod` şema 1, izinli NOT A TRAP kuralları, metin sınırları ve veri türleri doğrulanır.
4. `.zip` paketlerinde yol kaçışı, sembolik bağlantı, çalıştırılabilir dosya, aşırı boyut ve sıkıştırma bombası kontrol edilir.
5. Sunucuda Microsoft Defender, ClamAV veya `NAT_TRAP_SCANNER_COMMAND` varsa paket ayrıca antivirüsten geçirilir.
6. Sonuç temiz olsa bile `submitted_at + 86400` saniyeden önce yayınlanmaz.
7. Süre dolunca dosya `uploads/approved` klasörüne taşınır ve indirme açılır.
8. Şüpheli arşivler otomatik yayınlanmaz; `review` durumuna geçer.

Sunucu kapalıyken sayaç zamanı kaybolmaz. Yeniden açıldığında SQLite kaydı okunur ve süresi dolmuş temiz paketler yayımlanır.

## Desteklenen paketler

- `.natmod`: JSON tabanlı, kod çalıştırmayan ana format.
- `.zip`: Tek bir `.natmod` ve yalnızca pasif görsel/metin dosyaları içerebilir. Harici antivirüs kullanılamıyorsa insan incelemesi gerekir.
- En fazla 32 MB yükleme.
- Yalnızca oyunun desteklediği sayı, boolean ve `start_message` kuralları kabul edilir.

## Moderasyon API'si

Üretim ortamında `NAT_TRAP_ADMIN_KEY` tanımlayın. Anahtar HTTP gövdesine veya URL'ye yazılmaz; `X-Admin-Key` başlığında gönderilir.

```text
GET  /api/admin/queue
POST /api/admin/decision/{public_id}
Body: {"decision":"clean"} veya {"decision":"reject"}
```

İnsan tarafından `clean` verilen paket de kalan 24 saatlik süre kilidini atlayamaz.

## Önemli güvenlik notu

Hiçbir antivirüs dosyanın yüzde yüz zararsız olduğunu garanti edemez. Bu uygulama riski katmanlarla azaltır. Üretimde ayrıca şu önlemleri kullanın:

- Uygulamayı yönetici/root hesabıyla çalıştırmayın.
- `uploads` klasöründe çalıştırma iznini kapatın.
- Nginx/Caddy arkasında HTTPS, istek sınırı ve IP hız sınırı kullanın.
- Microsoft Defender veya güncel ClamAV imzalarını etkin tutun.
- SQLite ve yükleme klasörlerini düzenli yedekleyin.
- Kullanıcı hesabı/e-posta doğrulaması eklemeden internete açık anonim yüklemeye izin vermeyin.
- Rapor kuyruğunu insan moderatörlerin düzenli incelemesini sağlayın.

## İnternete yayınlama

Bu klasör doğrudan çalışan yerel sürümdür. Topluluğun gerçekten kullanabilmesi için 7/24 açık bir VPS/Windows sunucusu, alan adı, HTTPS ve kalıcı yedek gerekir. Paylaşımlı yalnız-statik HTML hosting dosya tarama/SQLite/24 saatlik görev çalıştıramaz. Sunucuda:

```powershell
$env:NAT_TRAP_HOST="0.0.0.0"
$env:NAT_TRAP_ADMIN_KEY="uzun-rastgele-gizli-anahtar"
python server.py
```

Ardından 8765 portunu doğrudan açmak yerine Caddy veya Nginx üzerinden HTTPS reverse proxy kullanın.

## Dosya yapısı

```text
public/                 HTML, CSS, JavaScript ve oyun görselleri
data/community.db       SQLite mod/yorum/rapor veritabanı (ilk çalıştırmada oluşur)
uploads/quarantine/     24 saat kilitli dosyalar
uploads/approved/       İndirilebilir onaylı dosyalar
uploads/rejected/       Reddedilen izole dosyalar
security.py             Paket ve antivirüs denetimleri
server.py               HTTP API, SQLite, kuyruk ve statik site sunucusu
```

## API özeti

```text
GET  /api/health
GET  /api/stats
GET  /api/mods?q=&category=&sort=
GET  /api/mods/{slug}
GET  /api/download/{slug}
GET  /api/status/{ticket}?token={secret}
POST /api/upload                multipart/form-data
POST /api/reviews/{slug}        JSON
POST /api/report/{slug}         JSON
```

Takip tokenı yalnızca yükleyen kişiye döner ve veritabanında SHA-256 özeti tutulur.
