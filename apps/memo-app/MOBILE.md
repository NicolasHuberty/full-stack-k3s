# Memo App - Mobile (iOS & Android)

The Memo App has been configured to run as a native mobile application on iOS and Android using Capacitor.

## Architecture

The mobile app loads the web application from the live server (https://dev.memo.docuralis.com) and wraps it in a native container with access to native device features like the microphone and camera.

## Prerequisites

### iOS
- macOS with Xcode installed
- iOS Simulator or physical iOS device
- CocoaPods installed (`sudo gem install cocoapods`)

### Android
- Android Studio installed
- Android SDK configured
- Android emulator or physical Android device

## Setup

All Capacitor dependencies are already installed. The project includes:

- `@capacitor/core` - Core Capacitor framework
- `@capacitor/ios` - iOS platform support
- `@capacitor/android` - Android platform support
- `@capacitor/camera` - Camera access plugin
- `@capacitor/filesystem` - File system access plugin

## Configuration

### capacitor.config.ts

The app is configured to load from the live server:

```typescript
{
  appId: 'com.huberty.memoapp',
  appName: 'Memo App',
  server: {
    url: 'https://dev.memo.docuralis.com',
    allowNavigation: [
      'https://dev.memo.docuralis.com',
      'https://staging.memo.docuralis.com',
      'https://memo.docuralis.com'
    ],
  }
}
```

### iOS Permissions (Info.plist)

The following permissions are configured:

- **NSMicrophoneUsageDescription**: Record audio memos
- **NSCameraUsageDescription**: Capture photos for memos
- **NSPhotoLibraryUsageDescription**: Save and retrieve images
- **NSPhotoLibraryAddUsageDescription**: Save images from memos

### Android Permissions (AndroidManifest.xml)

The following permissions are configured:

- `INTERNET` - Network access
- `RECORD_AUDIO` - Microphone access
- `CAMERA` - Camera access
- `READ_EXTERNAL_STORAGE` - Read files
- `WRITE_EXTERNAL_STORAGE` - Write files (API ≤32)
- `READ_MEDIA_IMAGES` - Read images (API 33+)

## Development Commands

### Sync Capacitor Config
```bash
npm run cap:sync          # Sync both iOS and Android
npm run cap:sync:ios      # Sync iOS only
npm run cap:sync:android  # Sync Android only
```

### Open in IDE
```bash
npm run cap:open:ios      # Open Xcode
npm run cap:open:android  # Open Android Studio
```

### Run on Device/Simulator
```bash
npm run cap:run:ios       # Build and run on iOS
npm run cap:run:android   # Build and run on Android
```

## Building for iOS

1. Open Xcode:
   ```bash
   npm run cap:open:ios
   ```

2. Select your target device (simulator or physical device)

3. Click the "Play" button or press `Cmd+R` to build and run

4. For App Store distribution:
   - Set up signing certificates in Xcode
   - Archive the app: `Product > Archive`
   - Upload to App Store Connect

## Building for Android

1. Open Android Studio:
   ```bash
   npm run cap:open:android
   ```

2. Wait for Gradle sync to complete

3. Select your target device (emulator or physical device)

4. Click the "Run" button to build and run

5. For Play Store distribution:
   - Build signed APK/AAB: `Build > Generate Signed Bundle / APK`
   - Upload to Google Play Console

## Testing

### iOS Simulator
The iOS project is already open in Xcode. You can:
- Select any iPhone simulator
- Press `Cmd+R` to run
- Test microphone access (may require physical device for actual recording)

### Android Emulator
1. Open Android Studio
2. Create/start an emulator in AVD Manager
3. Run the app
4. Test all features including microphone access

## Features Available in Mobile

- ✅ Full web app functionality
- ✅ Native microphone access for voice memos
- ✅ Native camera access for photos
- ✅ File system access for downloads
- ✅ Push notifications (can be added via @capacitor/push-notifications)
- ✅ Native sharing (can be added via @capacitor/share)
- ✅ Biometric authentication (can be added via @capacitor/biometric-auth)

## Switching Between Environments

To switch between dev/staging/production, update `capacitor.config.ts`:

```typescript
server: {
  url: 'https://memo.docuralis.com',  // Change to desired environment
}
```

Then run:
```bash
npm run cap:sync
```

## Troubleshooting

### iOS Build Issues

**CocoaPods not installed:**
```bash
sudo gem install cocoapods
cd ios/App
pod install
```

**Signing errors:**
- Open Xcode
- Select the project in navigator
- Go to "Signing & Capabilities"
- Select your development team

### Android Build Issues

**Gradle sync failed:**
- File > Invalidate Caches and Restart
- Ensure Android SDK is properly configured

**Permissions not working:**
- Ensure AndroidManifest.xml has all required permissions
- Request runtime permissions in Android 6.0+

## App Icons and Splash Screens

### iOS
Icons are located in: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Android
Icons are located in: `android/app/src/main/res/mipmap-*/`

Use tools like [Capacitor Assets](https://github.com/ionic-team/capacitor-assets) to generate icons:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#000000' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#000000'
```

## Next Steps

1. **Customize App Icon**: Replace default icons with your branding
2. **Add Splash Screen**: Create custom splash screen
3. **Test on Real Devices**: Test audio recording and camera features
4. **Set up CI/CD**: Automate builds with GitHub Actions or Fastlane
5. **App Store Setup**: Create app listings on App Store and Play Store
6. **Analytics**: Add analytics with @capacitor/analytics or third-party services
7. **Crash Reporting**: Add crash reporting with Sentry or Firebase Crashlytics

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://capacitorjs.com/docs/ios)
- [Android Development Guide](https://capacitorjs.com/docs/android)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
