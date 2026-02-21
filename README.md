# KDM Mobile

SHGM KDM sistemine hızlı iş kaydı girişi için React Native uygulaması.

## Özellikler

- **Hızlı Giriş**: Kayıtlı kullanıcı bilgileriyle otomatik giriş
- **İş Kaydı**: Günlük işleri yarım saatlik dilimler halinde kaydetme
- **İzin Günü**: Tek tıkla izin günü işaretleme
- **Planlama**: Gelecek işleri planlama
- **Salla & Doldur**: Telefonu sallayarak boş slotları otomatik doldurma
- **Geçmiş Görünüm**: Kayıtlı işleri görüntüleme ve silme

## Ekran Görüntüleri

| Login | İş Kaydı | Salla Özelliği |
|:-----:|:--------:|:--------------:|
| ![login](assets/screenshots/login.jpeg) | ![kayit](assets/screenshots/kayıt.jpeg) | ![salla](assets/screenshots/salla.jpeg) |

## Kurulum

```bash
npm install
npx expo start
```

## Build

```bash
# Android APK
npx eas build --platform android --profile preview

# iOS (Apple Developer gerektirir)
npx eas build --platform ios --profile preview
```

## Teknolojiler

- React Native
- Expo
- expo-sensors (accelerometer)

## Sürüm Geçmişi

### v1.0.4
- Salla özelliği eklendi
- Dark mode input renkleri düzeltildi
- Modal metin renkleri düzeltildi

### v1.0.3
- İlk kararlı sürüm
- SHGM API entegrasyonu

## İndir

📱 **[Son APK İndir](https://expo.dev/artifacts/eas/rskquMubb8xXHBimA3Ppre.apk)**
