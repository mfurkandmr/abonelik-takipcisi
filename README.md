# Abonelik Takipçisi

## Problem ve kullanıcı
Öğrenciler ve genç çalışanlar Netflix, Spotify, bulut depolama gibi pek çok aylık
aboneliğe sahip. Ödemeler farklı günlerde yenilendiği için toplam aylık maliyet
bilinmiyor ve yenilenme günleri unutuluyor. Bu uygulama tüm abonelikleri tek
yerde toplar, aylık toplam maliyeti hesaplar ve yaklaşan ödemeleri gösterir.

Hedef kullanıcı: birden fazla dijital aboneliği olan öğrenciler ve genç çalışanlar.

## İş panosu
GitHub Projects panosu (Todo / In Progress / Done sütunları):
**https://github.com/users/mfurkandmr/projects/1**

Her kartta kısa açıklama ve kabul kriteri var. Tamamlanan kartlarda ilgili commit
bağlantısı yorum olarak eklidir ve kabul kriteri kutuları işaretlidir.

| Kart | Görev | Durum |
|---|---|---|
| [#1](https://github.com/mfurkandmr/abonelik-takipcisi/issues/1) | Abonelik ekleme (**Özellik 1**) | Tamamlandı |
| [#2](https://github.com/mfurkandmr/abonelik-takipcisi/issues/2) | Aylık toplam ve yaklaşan ödemeler (**Özellik 2**) | Tamamlandı |
| [#3](https://github.com/mfurkandmr/abonelik-takipcisi/issues/3) | Abonelik silme | Tamamlandı |
| [#4](https://github.com/mfurkandmr/abonelik-takipcisi/issues/4) | Abonelik düzenleme | Tamamlandı |
| [#5](https://github.com/mfurkandmr/abonelik-takipcisi/issues/5) | Kategoriye göre filtreleme | Tamamlandı |
| [#6](https://github.com/mfurkandmr/abonelik-takipcisi/issues/6) | Yıllık maliyet görünümü | Tamamlandı |

Ödev iki görev istiyordu: #1 ve #2 ana özelliklerdir. Kalan dört kart da aynı
kart, commit ve doğrulama düzeniyle ek olarak tamamlandı.

## Projeyi çalıştırma
Kurulum gerekmez, uygulama düz HTML/CSS/JavaScript'tir. Veriler tarayıcının
`localStorage` alanında saklanır.

1. Depoyu klonlayın:
   ```
   git clone https://github.com/mfurkandmr/abonelik-takipcisi.git
   cd abonelik-takipcisi
   ```
2. `index.html` dosyasını tarayıcıda açın (çift tıklamak yeterli).
   Alternatif olarak yerel sunucu ile: `python -m http.server 8000` komutunu çalıştırıp
   http://localhost:8000 adresine gidin.

Testleri çalıştırmak için (Node.js 20 veya üzeri gerekir):
```
node --test
```

## Özellikleri deneme

### Özellik 1: Abonelik ekleme ([#1](https://github.com/mfurkandmr/abonelik-takipcisi/issues/1))
1. "Abonelik ekle" formunda ad (örn. `Netflix`), aylık ücret (örn. `150`) ve yenilenme günü (örn. `15`) girin.
2. **Ekle**'ye basın: abonelik "Aboneliklerim" listesinde görünür.
3. Sayfayı yenileyin: abonelik listede kalır.
4. Adı boş bırakıp ya da negatif ücret girip **Ekle**'ye basın: hata mesajı çıkar, kayıt eklenmez.

### Özellik 2: Aylık toplam ve yaklaşan ödemeler ([#2](https://github.com/mfurkandmr/abonelik-takipcisi/issues/2))
1. İki abonelik ekleyin: ücretleri `100` ve `50` olsun. Sayfanın üstündeki mavi alanda **150 TL her ay** görünür.
2. Yenilenme günü bugünden itibaren 7 gün içinde olan bir abonelik ekleyin (örn. bugün ayın 21'i ise `23`).
   "Yaklaşan ödemeler" listesinde "2 gün sonra" olarak çıkar, ay takviminde de o gün dolu görünür.
3. Yenilenme günü 7 günden uzak olan abonelik bu listede görünmez (takvimde yine işaretlidir).
4. Hiç abonelik yokken toplam `0 TL` görünür.

### Ek özellikler (#3-#6)
- **Silme:** satırdaki **Sil**'e basın, toplam otomatik güncellenir.
- **Düzenleme:** **Düzenle**'ye basın, form dolar, değiştirip **Kaydet**'e basın.
- **Kategori filtresi:** forma kategori seçin, "Aboneliklerim" üstündeki kategori düğmeleriyle listeyi süzün.
- **Yıllık maliyet:** mavi alanda "Yılda ... eder" olarak aylık toplamın 12 katı gösterilir (150 TL ise 1800 TL).
- **Ay takvimi:** ödeme günleri mevcut ayın takviminde mercan renkle dolu görünür, bugün çerçevelidir.

## Proje yapısı
| Dosya | Açıklama |
|---|---|
| `index.html` | Sayfa yapısı |
| `style.css` | Görünüm |
| `app.js` | İş mantığı (ekleme, toplam, yaklaşan ödemeler, filtre...) ve arayüz bağlantısı |
| `app.test.js` | Kabul kriterlerini doğrulayan birim testleri (`node --test`) |
