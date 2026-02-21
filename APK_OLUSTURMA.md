# 📱 Android APK Oluşturma Rehberi

## Seçenek 1: EAS Cloud Build (Önerilen - En Kolay)

### 1. Expo Hesabı Oluşturun
- https://expo.dev/ adresine gidin
- Ücretsiz hesap oluşturun

### 2. EAS CLI ile Giriş Yapın
```bash
cd kdm-mobile-app/mobile
npx eas login
# Email ve şifrenizi girin
```

### 3. Bağımlılıkları Yükleyin
```bash
cd kdm-mobile-app/mobile
rm -rf node_modules package-lock.json
npm install
```

### 4. APK Build Alın
```bash
npx eas build --platform android --profile preview
```

### 5. APK'yi İndirin
- Build tamamlandığında terminalde link verilecek
- Veya https://expo.dev/accounts/[USERNAME]/projects/mobile/builds adresinden indirin
- **Süre:** ~10-15 dakika

---

## Seçenek 2: Yerel Build (Android Studio Gerekli)

### Gereksinimler
- Android Studio kurulu olmalı
- Android SDK kurulu olmalı
- Java JDK 17+ kurulu olmalı

### Build Adımları
```bash
cd kdm-mobile-app/mobile

# Bağımlılıkları yükle
npm install

# Prebuild oluştur
npx expo prebuild --platform android

# Android klasörüne git
cd android

# Release build al
./gradlew assembleRelease

# APK konumu: android/app/build/outputs/apk/release/app-release.apk
```

---

## Seçenek 3: Expo Go ile Test (En Hızlı - APK Gerekmez)

Telefonunuzda Expo Go uygulaması ile hızlıca test edebilirsiniz:

1. Telefona **Expo Go** uygulamasını yükleyin (Google Play Store)
2. PC'de backend çalışsın:
   ```bash
   cd kdm-mobile-app/backend
   python3 main.py
   ```
3. Mobil projeyi başlatın:
   ```bash
   cd kdm-mobile-app/mobile
   npx expo start
   ```
4. QR kodu telefon kamerasıyla okutun veya Expo Go'dan bağlanın

---

## 🔧 IP Adresi Ayarı

APK oluşturmadan önce `mobile/api.js` dosyasındaki IP adresini kendi bilgisayarınızın IP'siyle değiştirin:

```javascript
const API_BASE_URL = 'http://192.168.1.XXX:8000'; // Kendi IP'nizi yazın
```

IP adresinizi öğrenmek için:
- **Linux/Mac:** `ip addr show` veya `ifconfig`
- **Windows:** `ipconfig`

---

## ⚠️ Bilinen Sorunlar ve Çözümleri

### 1. Build Hatası: `react-native-reanimated`
**Hata:** C++ derleme hatası (Ninja build failed)

**Çözüm:** Bu proje artık `react-native-reanimated` kullanmıyor. Eğer eski versiyonlarda hata alırsanız:
```bash
rm -rf node_modules package-lock.json
npm install
```

### 2. Gradle / Java Uyumsuzluğu
**Hata:** Gradle version mismatch

**Çözüm:** 
```bash
cd android
./gradlew clean
rm -rf .gradle
```

### 3. Expo SDK Uyumluluk
**Hata:** `expo` paketi uyumsuz

**Çözüm:**
```bash
npx expo doctor --fix-dependencies
```

---

## 📋 Özet

| Yöntem | Avantaj | Dezavantaj | Süre |
|--------|---------|------------|------|
| **EAS Cloud** | Kurulum gerektirmez | Expo hesabı gerekli | ~10-15 dk |
| **Yerel Build** | Tam kontrol | Android Studio gerekli | ~5-10 dk |
| **Expo Go** | Anında test | APK gerekmez | Anında |

**Önerim:** 
- Hızlı test için: **Expo Go**
- Dağıtım için: **EAS Cloud Build**
