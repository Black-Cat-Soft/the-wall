# iOS development build and physical-device testing

The BLE bump flow uses a local Swift/CoreBluetooth module. It is not available in Expo Go, so each
iPhone needs a signed development build.

## Requirements

- macOS with Xcode and Xcode Command Line Tools
- an Apple ID added to Xcode
- a data-capable USB cable
- an iPhone with Developer Mode enabled
- the Mac and iPhones on the same Wi-Fi network
- two different app accounts for the two-phone bump test

## 1. Configure the local API address

From the repository root, find the Mac's active Wi-Fi address:

```bash
ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1
```

Create the ignored local environment file:

```bash
cp mobile/.env.example mobile/.env
```

Replace the placeholder in `mobile/.env` with the address returned above. For example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

Never commit `mobile/.env`; IP addresses and future secrets belong in local environment files.

## 2. Start the API and Metro

Use two terminals and leave both processes running.

Terminal 1:

```bash
cd backend
mkdir -p data
go run .
```

Terminal 2:

```bash
cd mobile
npm ci
npx expo start --dev-client --lan
```

The API should be available at port `3000` and Metro at port `8081`.

## 3. Prepare each iPhone

1. Connect the unlocked iPhone directly to the Mac with a data-capable cable.
2. Tap **Trust This Computer** on the iPhone and enter its passcode.
3. Open **Settings → Privacy & Security → Developer Mode**.
4. Enable Developer Mode, restart, and confirm **Turn On** after the restart.
5. Keep the phone unlocked while Xcode registers and installs the build.

Confirm that Apple sees the device:

```bash
xcrun devicectl list devices
```

If the phone does not appear in Finder or show that it is charging, fix the cable/port connection
before troubleshooting Expo. If Finder sees it but Xcode does not, check Trust and Developer Mode.

## 4. Generate and install the native build

Generate the ignored iOS project after installing dependencies:

```bash
cd mobile
npx expo prebuild --platform ios --clean
```

The easiest installation path is:

```bash
npx expo run:ios --device
```

Select the connected phone when prompted. If Xcode needs to create or refresh provisioning:

1. Open `mobile/ios/TheWall.xcworkspace` in Xcode.
2. Select the **TheWall** project and target.
3. Open **Signing & Capabilities**.
4. Enable automatic signing and select the Apple Development Team.
5. Select the connected iPhone as the run destination and press **Run**.

On a new phone, the first launch may say the developer is untrusted. Open
**Settings → General → VPN & Device Management**, select the Apple Development identity, and tap
**Trust**. Then launch The Wall and allow Local Network and Bluetooth access.

## 5. Run the BLE bump test

1. Install the same development build on two physical iPhones.
2. Connect both phones to the same Wi-Fi network as the Mac.
3. Log in as two different users.
4. Open **Bump** on both phones.
5. Bring the phones close together.
6. Confirm that each phone discovers the peer and displays changing RSSI.
7. When the signal is at least `-70 dBm`, press **Bump**.
8. Confirm the success state and verify that the users are connected in the app/backend.

## Troubleshooting map

| Symptom | Check first |
| --- | --- |
| Phone does not charge or appear in Finder | Cable, Mac port, adapter/hub, and iPhone Lightning port |
| Finder sees the phone but Xcode does not | Trust This Computer and Developer Mode |
| Signing or provisioning fails | Unique bundle ID, Apple Team, and automatic signing |
| App opens but cannot load JavaScript | Metro is running, both devices are on Wi-Fi, and the embedded Mac IP is current |
| Login/feed requests fail | Go API is running and `EXPO_PUBLIC_API_URL` points to the Mac's LAN address |
| BLE is unavailable | Use the native development build, allow Bluetooth, and test on physical iPhones |
