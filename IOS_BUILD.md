# 🍎 iOS IPA Oluşturma Rehberi

## EAS Cloud Build (Önerilen)

iOS build için **Mac bilgisayar gerekmez!** EAS cloud üzerinde build alabilirsiniz.

### 1. Expo Hesabı ve EAS Kurulum
```bash
# Giriş yapın
cd kdm-mobile-app/mobile
npx eas login
```

### 2. iOS Build Alma Seçenekleri

#### A) Geliştirme (Simulator için)
```bash
npx eas build --platform ios --profile development
```
- Sadece simulator'de çalışır
- Apple Developer hesabı gerekmez

#### B) Preview (Test için)
```bash
npx eas build --platform ios --profile preview
```
- Fiziksel cihazda test edilebilir
- Apple Developer hesabı gerekir ($99/yıl)

#### C) Production (App Store için)
```bash
npx eas build --platform ios --profile production
```
- App Store'a yüklemeye hazır
- Apple Developer hesabı gerekir

---

## 🔐 Apple Developer Hesabı Gereksinimleri

Fiziksel cihazda çalıştırmak için:

1. **Apple Developer Program** üyeliği ($99/yıl)
   - https://developer.apple.com/programs/

2. **EAS'de Apple Hesabı Bağlama**
   ```bash
   npx eas credentials
   ```

3. **Otomatik veya Manuel Sertifika**
   - EAS otomatik oluşturabilir (önerilen)
   - Veya kendi sertifikalarınızı yükleyebilirsiniz

---

## 📱 Test Yöntemleri

### 1. Expo Go ile Test (En Hızlı)
```bash
npx expo start
# QR kodu iPhone kamerasıyla okutun
```
**Not:** Backend'in aynı ağda olması gerekir.

### 2. TestFlight ile Test (Dağıtım Öncesi)
```bash
npx eas build --platform ios --profile preview
# Build tamamlandığında TestFlight'a otomatik yükleyebilirsiniz
```

### 3. App Store Connect
```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios
```

---

## 🔧 iOS Özel Yapılandırma

### app.json Güncelleme
```json
{
  "expo": {
    "name": "KDM İş Kayıtları",
    "slug": "kdm-is-kayitlari",
    "ios": {
      "bundleIdentifier": "com.turksat.kdm",
      "buildNumber": "1.0.0",
      "supportsTablet": true
    }
  }
}
```

### Bundle Identifier Önemli!
- Eşsiz olmalı (örn: `com.sirket.uygulama`)
- Apple Developer hesabınızda kayıtlı olmalı

---

## 🚀 Build Komutları Özeti

| Amaç | Komut | Apple Dev Hesabı |
|------|-------|------------------|
| Simulator test | `eas build --platform ios --profile development` | ❌ Hayır |
| Cihaz test | `eas build --platform ios --profile preview` | ✅ Evet |
| App Store | `eas build --platform ios --profile production` | ✅ Evet |

---

## 📋 iOS vs Android Farkları

| Özellik | Android | iOS |
|---------|---------|-----|
| Hesap Gereksinimi | Ücretsiz Google Play | $99/yıl Apple Dev |
| Build Süresi | ~10 dk | ~15 dk |
| Cihaz Testi | APK direkt yüklenir | TestFlight gerekir |
| Simulator | Android Emulator | iOS Simulator |

---

## ❓ Sık Sorulan Sorular

**S: iPhone'umda test etmeden build alabilir miyim?**
C: Evet, build alabilirsiniz ama yüklemek için Apple Dev hesabı gerekir.

**S: Mac bilgisayarım yok, iOS build alabilir miyim?**
C: Evet! EAS Cloud'da build alabilirsiniz, Mac gerekmez.

**S: Android ve iOS için aynı kod kullanılıyor mu?**
C: Evet! React Native kodunuz her iki platformda da çalışır.

**S: Build tamamlandıktan sonra ne olur?**
C: E-posta ve Expo dashboard'dan indirme linki gelir.

---

## 🔗 Faydalı Linkler

- Expo iOS Build: https://docs.expo.dev/build/setup/
- Apple Developer: https://developer.apple.com/
- TestFlight: https://testflight.apple.com/
