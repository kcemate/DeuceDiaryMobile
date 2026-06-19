# Deuce Diary

Deuce Diary Mobile is an Expo/React Native companion app for DeuceDiary.

It demonstrates mobile product work across authentication, tab navigation, squad workflows, logging flows, push notification opt-ins, premium/paywall UI, offline/error states, and App Store preparation.

## What It Shows

- Expo Router navigation with tabbed and modal flows.
- Mobile-first logging, profile, squad, invite, referral, onboarding, and premium screens.
- API client modules for auth, logging, and squads.
- Clerk-ready authentication path plus development sign-in.
- Push notification opt-in and notification settings.
- Offline/error/skeleton states for resilient mobile UX.
- App Store metadata and EAS build configuration.
- Jest test setup for React Native components.

## Quickstart

```bash
# Install dependencies
npm install

# Copy env and fill in values
cp .env.example .env

# Start dev server
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API URL (Railway) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | Clerk auth key (leave blank for dev username auth) |

## EAS Build (Production)

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo
eas login

# Run pre-build checks
bash scripts/pre-build-check.sh

# Build for App Store
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios
```

### Build Profiles

- **development** — Internal build with simulator support
- **preview** — Internal distribution (TestFlight-style)
- **production** — App Store submission (auto-incrementing build number)

## Project Structure

```
app/              # Expo Router screens
  (tabs)/         # Tab navigation
  auth/           # Auth screens
api/              # API client modules
hooks/            # Custom React hooks
lib/              # Shared utilities
constants/        # Theme, config
assets/           # Icons, splash, fonts
app-store/        # App Store metadata & screenshot instructions
scripts/          # Build & CI scripts
```

## Backend

See [DEPLOY.md](./DEPLOY.md) for backend deployment on Railway.
