# KinShift Architecture

## Overview

KinShift follows **Clean Architecture** principles with a clear separation of concerns across presentation, business logic, and data layers. The architecture is designed for scalability, testability, and maintainability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Screens    │  │  Components  │  │  Navigation  │     │
│  │   (Views)    │  │   (Reusable) │  │   (Routes)   │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  ViewModels  │  │Custom Hooks  │                        │
│  │ (Logic Layer)│  │ (Shared UI)  │                        │
│  └──────┬───────┘  └──────┬───────┘                        │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
┌─────────┼──────────────────┼────────────────────────────────┐
│         ▼                  ▼      APPLICATION LAYER         │
│  ┌──────────────────────────────────────────┐              │
│  │            React Contexts                │              │
│  │   (Auth, Household, Subscription)        │              │
│  └──────┬───────────────────────────────────┘              │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────────────┐
│         ▼               DATA LAYER                          │
│  ┌──────────────────────────────────────────┐              │
│  │              Services                    │              │
│  │  (Firebase, API, Business Operations)    │              │
│  └──────┬───────────────────────────────────┘              │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────┐              │
│  │         External Services                │              │
│  │  (Firebase, RevenueCat, Sentry)          │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. Presentation Layer

**Responsibility**: UI rendering and user interactions

#### Screens (`src/screens/`)
- Pure UI components focused on rendering
- Minimal business logic
- Delegate to ViewModels or custom hooks for state management
- Handle user input and navigation

**Example**:
```typescript
export const CalendarViewScreen: React.FC<Props> = ({navigation}) => {
  const viewModel = useCalendarViewModel(userId, householdId);
  
  return (
    <View>
      {viewModel.state.loading ? <Spinner /> : <Calendar />}
    </View>
  );
};
```

#### Components (`src/components/`)
- Reusable UI building blocks
- Stateless when possible
- Accept props for configuration
- No direct service/API calls

#### Navigation (`src/navigation/`)
- Route configuration
- Stack navigators, tab navigators
- Deep linking configuration

---

### 2. Business Logic Layer

**Responsibility**: Application logic and state orchestration

#### ViewModels (`src/viewmodels/`)
- Orchestrate business operations
- Manage screen-specific state
- Transform data for UI consumption
- Pure TypeScript (framework-agnostic)
- Easily testable with unit tests

**Pattern**:
```typescript
export function useCalendarViewModel(userId: string, householdId: string) {
  const [state, setState] = useViewModelState<CalendarState>({
    // ... initial state
  });
  
  // Business logic methods
  const loadShifts = async () => {
    // Orchestrate service calls
  };
  
  const validateShift = (shift: Shift) => {
    // Business rules validation
  };
  
  return { state, loadShifts, validateShift };
}
```

**Benefits**:
- ✅ Testable without React components
- ✅ Reusable across different UI frameworks
- ✅ Clear separation of concerns
- ✅ Type-safe state management

#### Custom Hooks (`src/hooks/`)
- Reusable UI logic shared across components
- State management patterns
- Side effects handling
- Form validation, data fetching patterns

**Examples**:
- `useDoubleTap` - Gesture detection
- `useDataSubscription` - Real-time data patterns
- `useHouseholdMembers` - Data loading logic
- `useShifts` - Shift management operations

---

### 3. Application Layer

**Responsibility**: Global state and cross-cutting concerns

#### Contexts (`src/contexts/`)
- Application-wide state (Auth, Household, Subscription)
- Provider pattern for dependency injection
- Authentication state management
- Feature flags and configuration

**Pattern**:
```typescript
export const AuthContext = createContext<AuthContextType>();

export const AuthProvider: React.FC = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    return authService.onAuthStateChanged(setUser);
  }, []);
  
  return (
    <AuthContext.Provider value={{user, signIn, signOut}}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

### 4. Data Layer

**Responsibility**: Data access and external integrations

#### Services (`src/services/`)
- Data persistence (Firebase Firestore)
- API communication
- Business operations (CRUD)
- Error handling and retry logic
- Offline queue management

**Base Service Pattern**:
```typescript
export class BaseService {
  protected handleError(error: any): ServiceError {
    // Centralized error handling
  }
  
  protected async retry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    // Retry logic for failed operations
  }
}

export class ShiftService extends BaseService {
  async getShifts(filters: ShiftFilters): Promise<Shift[]> {
    return this.retry(() => {
      // Firebase query logic
    });
  }
}
```

**Service Categories**:
- **Data Services**: `shift.service.ts`, `household.service.ts`, `dayNote.service.ts`
- **Auth Services**: `auth.service.ts`, `rbac.service.ts`
- **Integration Services**: `revenueCat.service.ts`, `notification.service.ts`
- **Utility Services**: `network.service.ts`, `audit.service.ts`

---

## Design Patterns

### 1. MVVM (Model-View-ViewModel)
- **Model**: Data types (`src/types/`)
- **View**: React components (`src/screens/`, `src/components/`)
- **ViewModel**: Business logic orchestration (`src/viewmodels/`)

**Benefits**: Testable business logic, clear separation, reusable across platforms

### 2. Repository Pattern
- Services act as repositories abstracting data access
- Consistent interface for data operations
- Easy to mock for testing
- Swappable data sources

### 3. Observer Pattern
- Real-time data subscriptions via Firebase
- React Context for state propagation
- Event-driven notification system

### 4. Singleton Pattern
- Service instances exported as singletons
- Ensures consistent state across app
- Example: `export const shiftService = new ShiftService()`

### 5. Factory Pattern
- View model creation via custom hooks
- Service instantiation
- Component factories for dynamic rendering

### 6. Command Pattern (Offline Queue)
- `offlineEditQueue.service.ts` implements command queue
- Supports undo/redo
- Conflict resolution on sync

---

## Data Flow

### Read Operations (Query)
```
Screen → ViewModel → Service → Firebase → Service → ViewModel → Screen
```

### Write Operations (Command)
```
User Action → ViewModel → Service → [Offline Queue] → Firebase
                                           ↓
                                    Local Optimistic Update
```

### Real-time Subscriptions
```
Firebase Change → Service Listener → ViewModel → State Update → Screen Re-render
```

---

## State Management Strategy

### Local Component State
- UI-specific state (modals, form inputs)
- `useState` for simple state
- `useReducer` for complex state machines

### ViewModel State
- Screen-specific business state
- Managed by custom hooks
- `useViewModelState` utility

### Global Application State
- React Context for auth, household, subscription
- Zustand for complex global state (future enhancement)

### Server State
- Firebase real-time listeners
- Optimistic updates for better UX
- Offline queue for resilience

---

## Testing Strategy

### Unit Tests
- **ViewModels**: Business logic validation
- **Utilities**: Pure function testing
- **Services**: Mocked Firebase operations

```typescript
describe('CalendarViewModel', () => {
  it('should load shifts for current month', async () => {
    const viewModel = useCalendarViewModel(userId, householdId);
    await viewModel.loadShifts(new Date());
    expect(viewModel.state.shifts.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests
- **Service interactions**: Real Firebase (emulator)
- **Data flow**: End-to-end data operations
- **Offline scenarios**: Queue and sync testing

### Component Tests
- **React Testing Library**: Component rendering
- **User interactions**: Button clicks, form submissions
- **Navigation**: Screen transitions

### E2E Tests
- **Critical flows**: Login, create shift, sync
- **Platform-specific**: iOS/Android behaviors

---

## Error Handling

### Centralized Error Management
```typescript
// BaseService provides consistent error handling
protected handleError(error: any): ServiceError {
  if (error.code?.startsWith('auth/')) {
    return this.handleAuthError(error);
  }
  if (error.code?.startsWith('firestore/')) {
    return this.handleFirestoreError(error);
  }
  return { code: 'unknown', message: error.message };
}
```

### Error Boundaries
- React Error Boundary wraps app
- Sentry integration for crash reporting
- Graceful degradation

### Retry Logic
- Automatic retry for transient failures
- Exponential backoff
- User notification on persistent failures

---

## Offline Support

### Offline-First Architecture
1. **Optimistic Updates**: UI updates immediately
2. **Command Queue**: Operations queued when offline
3. **Automatic Sync**: Queue processed when online
4. **Conflict Resolution**: Last-write-wins with audit trail

### Implementation
```typescript
// offlineEditQueue.service.ts
export class OfflineEditQueueService {
  async queueOperation(operation: QueuedOperation) {
    await this.saveToLocalStorage(operation);
    if (isOnline) {
      await this.processQueue();
    }
  }
  
  async processQueue() {
    const operations = await this.getQueuedOperations();
    for (const op of operations) {
      await this.executeOperation(op);
    }
  }
}
```

---

## Performance Optimizations

### React Performance
- `useMemo` for expensive computations
- `useCallback` for stable function references
- `React.memo` for expensive components
- Virtual lists for long data sets

### Data Fetching
- Paginated queries with cursors
- Incremental loading (load more)
- Real-time subscriptions limited to visible data
- Firestore composite indexes

### Bundle Size
- Code splitting with `React.lazy`
- Tree shaking with ES modules
- Optimized assets and images

---

## Security

### Authentication
- Firebase Authentication
- Token-based session management
- Automatic token refresh

### Authorization (RBAC)
- Role-Based Access Control
- Household-level permissions
- Admin vs Member roles
- Action-level permission checks

### Data Protection
- Firestore Security Rules
- Server-side validation
- Input sanitization
- Audit logging for sensitive operations

---

## Scalability Considerations

### Current Architecture Supports
- Multiple households per user
- Real-time collaboration
- Offline editing with sync
- Multi-platform (iOS, Android, Web)

### Future Enhancements
- **State Management**: Migrate to Zustand for complex state
- **API Layer**: GraphQL for flexible queries
- **Caching**: Advanced caching strategies
- **Microservices**: Backend service extraction
- **Event Sourcing**: Complete audit trail

---

## Development Guidelines

### Adding New Features

1. **Define Types** (`src/types/`)
2. **Create Service** (`src/services/`)
3. **Build ViewModel** (`src/viewmodels/`)
4. **Design Screen** (`src/screens/`)
5. **Add Tests** (unit, integration)
6. **Update Navigation**

### Code Organization Rules

- **One concern per file**: Single responsibility
- **Type everything**: Strict TypeScript
- **Test coverage**: Minimum 70% for business logic
- **Documentation**: JSDoc for public APIs
- **Naming conventions**: Clear, descriptive names

### Best Practices

✅ **Do**:
- Use ViewModels for complex business logic
- Extract reusable logic into custom hooks
- Mock services in tests
- Handle errors gracefully
- Log errors to Sentry

❌ **Don't**:
- Put business logic in screens
- Make direct Firebase calls from components
- Ignore TypeScript errors
- Skip error handling
- Leave console.logs in production

---

## Technology Stack

### Core
- **React Native 0.81.5**: Mobile framework
- **Expo 54**: Development platform
- **TypeScript 5.9**: Type safety

### State & Data
- **React Context**: Global state
- **Firebase Firestore**: Real-time database
- **Firebase Auth**: Authentication
- **AsyncStorage**: Local persistence

### Navigation & UI
- **React Navigation 7**: Navigation library
- **React Native Calendars**: Calendar components
- **react-native-vector-icons**: Icon library

### Quality & Monitoring
- **Jest**: Unit testing
- **React Testing Library**: Component testing
- **Sentry**: Error monitoring
- **ESLint**: Code linting
- **Prettier**: Code formatting

### Integrations
- **RevenueCat**: Subscription management
- **Firebase Messaging**: Push notifications
- **Expo Notifications**: Local notifications

---

## Deployment

### Build Process
```bash
npm run ios       # iOS development build
npm run android   # Android development build
eas build         # Production builds via EAS
```

### Environments
- **Development**: Local Firebase emulator
- **Staging**: Separate Firebase project
- **Production**: Production Firebase project

### CI/CD
- GitHub Actions for automated testing
- EAS Build for app builds
- Automated deployment to TestFlight/Play Store

---

## Migration Path (Future)

### Phase 1: Enhanced State Management ✅ (Current)
- MVVM with ViewModels
- Custom hooks for reusable logic
- Clean separation of concerns

### Phase 2: Advanced Patterns (Next)
- Zustand for global state
- Repository pattern with interfaces
- Dependency injection container

### Phase 3: Backend Services (Future)
- Cloud Functions for complex operations
- GraphQL API layer
- Microservices architecture

---

## Contributing

When contributing to KinShift:

1. **Follow the architecture**: Use ViewModels for business logic
2. **Write tests**: Unit tests for ViewModels, integration for services
3. **Type everything**: No `any` types without justification
4. **Document complex logic**: JSDoc comments for public APIs
5. **Run linting**: `npm run lint` before committing
6. **Update docs**: Keep ARCHITECTURE.md current

---

## Resources

- [React Native Best Practices](https://reactnative.dev/docs/performance)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [MVVM Pattern](https://docs.microsoft.com/en-us/xamarin/xamarin-forms/enterprise-application-patterns/mvvm)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Last Updated**: December 2025  
**Maintainer**: [@joshy1990](https://github.com/joshy1990)
