# KinShift

A React Native app for managing shift schedules across households with real-time sync, offline support, and smart pattern building.

## Features

- 📅 Real-time calendar synchronization
- 🔄 Custom shift pattern builder
- 👥 Multi-household management with RBAC
- 🔌 Offline-first with conflict resolution
- 🔔 Push notifications
- 💰 Subscription management

## Tech Stack

- React Native 0.81.5 + Expo 54
- TypeScript 5.9
- Firebase (Auth, Firestore, Messaging)
- RevenueCat & Sentry
- MVVM Architecture

## Quick Start

```bash
npm install
npm start
npm run ios     # or android
```

## Project Structure

```
src/
 screens/        # UI components
 viewmodels/     # Business logic
 services/       # Data & API layer
 components/     # Reusable UI
 contexts/       # React Context providers
 navigation/     # Route configuration
```

## Testing

```bash
npm test                 # Unit tests
npm run test:coverage    # Coverage report
npm run lint             # Linting
```

## Documentation

- [Payment & Sentry Setup](PAYMENT_AND_SENTRY_SETUP.md)

---

Built with  by [@joshy1990](https://github.com/joshy1990)
