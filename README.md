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
- Clean Architecture with MVVM

## Architecture Highlights

### 🏗️ Clean Architecture
- **Presentation Layer**: Pure UI components with minimal logic
- **Business Logic Layer**: ViewModels orchestrate operations
- **Data Layer**: Services abstract Firebase and API access
- **Clear separation** enables testability and maintainability

### 🎯 Design Patterns
- **MVVM Pattern**: ViewModels separate business logic from UI
- **Repository Pattern**: Services provide consistent data access
- **Observer Pattern**: Real-time subscriptions via Firebase
- **Singleton Pattern**: Shared service instances
- **Command Pattern**: Offline queue with conflict resolution

### 🧪 Testability
- **Unit Tests**: ViewModels and utilities (pure TypeScript)
- **Integration Tests**: Service layer with Firebase
- **Component Tests**: React Testing Library
- **E2E Tests**: Critical user flows

### 🔌 Offline-First
- Optimistic UI updates
- Command queue for offline operations
- Automatic sync when connection restored
- Conflict resolution with audit trail

### 📊 State Management
- **ViewModels**: Screen-specific business state
- **Custom Hooks**: Reusable UI logic patterns
- **React Context**: Global app state (Auth, Household)
- **Type-safe**: End-to-end TypeScript with strict mode

## Quick Start

```bash
npm install
npm start
npm run ios     # or android
```

## Project Structure

```
src/
 screens/        # Pure UI components (Views)
 viewmodels/     # Business logic orchestration (MVVM)
 services/       # Data access & Firebase integration
 components/     # Reusable UI building blocks
 contexts/       # Global state (Auth, Household, Subscription)
 hooks/          # Custom React hooks for shared logic
 navigation/     # Route configuration & deep linking
 types/          # TypeScript interfaces & types
 utils/          # Pure utility functions
```

### Data Flow
```
Screen → ViewModel → Service → Firebase → Service → ViewModel → Screen
```

### Key Architectural Decisions
- **ViewModels**: Pure TypeScript classes, framework-agnostic, easily testable
- **Services**: Singleton instances with retry logic and error handling
- **Custom Hooks**: Extract reusable UI patterns (e.g., `useDoubleTap`, `useDataSubscription`)
- **Type Safety**: Strict TypeScript with no implicit `any`
- **Error Handling**: Centralized via `BaseService` with Sentry integration

## Testing

```bash
npm test                 # Unit tests
npm run test:coverage    # Coverage report
npm run lint             # Linting
```

## Documentation

- [Architecture Guide](ARCHITECTURE.md) - Complete architectural overview
- [Payment & Sentry Setup](PAYMENT_AND_SENTRY_SETUP.md) - Integration docs

## Code Quality

- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier for consistent style
- **Error Monitoring**: Sentry integration
- **Performance**: React memoization, virtual lists, code splitting
- **Accessibility**: WCAG 2.1 AA compliance

## Performance Optimizations

- Memoized expensive computations with `useMemo`
- Stable function references with `useCallback`
- Paginated queries with cursor-based loading
- Real-time subscriptions limited to visible data
- Firestore composite indexes for complex queries

---

Built with ❤️ by [@joshy1990](https://github.com/joshy1990)
