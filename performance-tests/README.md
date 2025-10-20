# 🚀 LinkShift Performance Testing Suite

Complete performance testing framework to ensure the application can handle heavy user loads.

## 📋 Overview

This testing suite includes:
- **Load Testing** - API response times, concurrent operations, memory efficiency
- **React Native Profiling** - Frame rates, memory usage, component rendering
- **Firebase Stress Testing** - Database operations, batch writes, query performance
- **Cache Testing** - Hit rates, TTL expiration, LRU eviction
- **Network Testing** - Retry logic, timeout handling, concurrent requests
- **Database Testing** - Query optimization, indexing, aggregations

---

## 🎯 Quick Start

### Option 1: Run All Tests (Recommended)
```bash
npm run test:performance
```

### Option 2: Run Individual Tests

**Load Tests** (Simulates 500+ concurrent operations)
```bash
node performance-tests/load-test.js
```

**React Native Profiler** (Analyzes frame rates and memory)
```bash
node performance-tests/react-native-profiler.js
```

**Firebase Load Test** (Database stress testing)
```bash
bash performance-tests/firebase-load-test.sh [num_users] [shifts_per_user] [duration_minutes]
```

Examples:
```bash
# Default: 100 users, 10 shifts each, 5 minute test
bash performance-tests/firebase-load-test.sh

# Custom: 500 users, 20 shifts each, 10 minute test
bash performance-tests/firebase-load-test.sh 500 20 10
```

---

## 📊 Test Suites

### 1. Load Testing Suite (load-test.js)

**7 Test Categories:**

#### 1.1 API Response Time Tests
- Fast responses (< 100ms)
- Moderate responses (100-500ms)
- Slow responses (500-2000ms)

#### 1.2 Concurrent Operations Tests
- 10 concurrent operations
- 50 concurrent operations
- 100 concurrent operations
- 500 concurrent operations (stress test)

#### 1.3 Memory Efficiency Tests
- Array allocation (10,000 items)
- Object creation (1,000 objects)
- String operations (1MB total)
- Map operations (50,000 entries)

#### 1.4 Data Processing Tests
- JSON parsing (1MB data)
- Array filtering/mapping (10,000 items)
- Sorting large arrays
- Deep object traversal

#### 1.5 Network Latency Tests
- Good network (50ms)
- Fair network (200ms)
- Poor network (1000ms)
- Packet loss retry simulation

#### 1.6 Load Balancing Tests
- Sequential requests (baseline)
- Parallel requests (optimized)
- Burst traffic (100 concurrent)
- Rate-limited requests

#### 1.7 Cache Efficiency Tests
- Simple cache (1000 entries)
- LRU cache (100 max)
- Cache invalidation
- Cache warming

**Running:**
```bash
node performance-tests/load-test.js
```

**Expected Output:**
```
► API Response Time Tests
  ✓ Fast API Response (< 100ms) (87ms)
  ✓ Moderate API Response (100-500ms) (210ms)
  ✓ Slow API Response (500-2000ms) (1001ms)

► Concurrent Operations Tests
  ✓ Execute 10 Concurrent Operations (412ms)
  ✓ Execute 50 Concurrent Operations (780ms)
  ✓ Execute 100 Concurrent Operations (1842ms)
  ✓ Execute 500 Concurrent Operations (Stress) (2943ms)

[... more results ...]

TEST SUMMARY
═══════════════════════════════════════════════════════
Total Tests: 35
Total Passed: 35
Total Failed: 0
Pass Rate: 100%
Total Duration: 45000ms (45.00s)
```

---

### 2. React Native Profiler (react-native-profiler.js)

**Metrics Tracked:**

| Metric | Target | Alert |
|--------|--------|-------|
| Frame Rate | 60 FPS | < 50 FPS |
| Memory Usage | < 100MB | > 200MB |
| Component Render | < 16ms | > 20ms |
| Network Latency | < 200ms | > 1000ms |

**Running:**
```bash
node performance-tests/react-native-profiler.js
```

**Expected Output:**
```
► Frame Rate Performance
  Average FPS: 58 / 60 target
  Frame Range: 20 - 60 FPS
  Jank Events: 8 (8% of frames)
  Status: ✓ Smooth

► Memory Usage
  Average Heap: 95MB
  Peak Heap: 145MB
  Memory Range: 60 - 145MB
  ✓ Memory stable

► Component Rendering
  Components Tracked: 5
  Total Renders: 100
  Slowest Component: Calendar (19.5ms avg)

► Network Performance
  Average Latency: 245ms
  Latency Range: 85 - 432ms
  Slow Requests: 3 (6%)
  Success Rate: 100%
  Total Requests: 50
```

---

### 3. Firebase Load Test (firebase-load-test.sh)

**Tests Firebase Database Under Load:**

**Simulates:**
- Multiple concurrent users
- Shift creation operations
- Real-world network conditions

**Parameters:**
- `num_users`: Number of simulated users (default: 100)
- `shifts_per_user`: Shifts created per user (default: 10)
- `duration_minutes`: Test duration in minutes (default: 5)

**Running:**
```bash
# Default test (100 users, 10 shifts, 5 min)
bash performance-tests/firebase-load-test.sh

# Custom test (500 users, 20 shifts, 10 min)
bash performance-tests/firebase-load-test.sh 500 20 10

# Light test (50 users, 5 shifts, 2 min)
bash performance-tests/firebase-load-test.sh 50 5 2
```

**Expected Output:**
```
► Checking Firebase Connectivity
  ✓ Project found

► Collecting Baseline Metrics
  Firestore Collections:
  - users
  - households
  - shifts
  - messages
  ...

► Starting Load Test
  Duration: 5 minutes
  [5s] Processed 50 operations...
  [15s] Processed 200 operations...
  [30s] Processed 400 operations...

► Test Complete

Test Results:
  Total Requests: 1000
  Successful: 990
  Failed: 10
  Success Rate: 99%
  Average Latency: 245ms
  Throughput: 33 req/s

► Performance Assessment
  Latency: Good (245ms)
  Reliability: Excellent (99%)
  Throughput: Good (33 req/s)
```

---

### 4. Master Test Runner (test-runner.js)

**Orchestrates All Tests:**

Runs all test suites in sequence and generates comprehensive report.

**Running:**
```bash
node performance-tests/test-runner.js
```

**What It Does:**
1. ✓ Runs load tests (35 tests)
2. ✓ Runs React Native profiler
3. ✓ Runs cache efficiency tests
4. ✓ Runs network resilience tests
5. ✓ Runs database optimization tests
6. ✓ Generates final report with recommendations

---

## 📈 Performance Targets

### API Performance
| Metric | Target | Good | Acceptable | Poor |
|--------|--------|------|-----------|------|
| Response Time | < 200ms | < 100ms | 100-500ms | > 1000ms |
| Error Rate | < 1% | < 0.5% | < 1% | > 5% |
| P95 Latency | < 300ms | < 200ms | < 500ms | > 1000ms |
| Throughput | > 100 req/s | > 500 | > 100 | < 50 |

### Application Performance
| Metric | Target | Good | Acceptable | Poor |
|--------|--------|------|-----------|------|
| Frame Rate | 60 FPS | > 58 | > 50 | < 30 |
| Memory Usage | < 150MB | < 100MB | < 200MB | > 300MB |
| App Launch | < 2s | < 1s | < 2s | > 5s |
| List Scroll FPS | 60 FPS | > 58 | > 50 | < 30 |

### Database Performance
| Operation | Target | Good | Acceptable |
|-----------|--------|------|-----------|
| Single Read | < 50ms | < 30ms | < 100ms |
| Single Write | < 100ms | < 50ms | < 200ms |
| Batch Read (100) | < 500ms | < 300ms | < 1000ms |
| Query (1000 docs) | < 300ms | < 150ms | < 500ms |

---

## 🔍 Interpreting Results

### Load Test Results

**All Tests Pass (100%)**
```
✓ EXCELLENT - Application is production-ready
  • Can handle 500+ concurrent operations
  • Memory efficient under stress
  • No performance degradation
```

**Most Tests Pass (90-99%)**
```
✓ GOOD - Monitor specific areas
  • Investigate failed tests
  • Implement recommended optimizations
  • Ready for moderate load
```

**Some Tests Fail (70-89%)**
```
⚠ NEEDS ATTENTION - Plan improvements
  • Address performance bottlenecks
  • Optimize slow operations
  • Increase test infrastructure
```

**Many Tests Fail (< 70%)**
```
✗ CRITICAL - Requires optimization
  • Major performance issues detected
  • Not ready for production
  • Significant refactoring needed
```

### React Native Profiler Results

**Frame Rate Analysis:**
- **60 FPS** - Perfect smoothness
- **50-60 FPS** - Good, acceptable
- **30-50 FPS** - Fair, users may notice
- **< 30 FPS** - Poor, jank visible

**Memory Usage:**
- **< 100MB** - Excellent
- **100-150MB** - Good
- **150-200MB** - Acceptable
- **> 200MB** - High, risk of crashes

---

## 🛠️ Optimization Recommendations

### Based on Test Results

#### High Memory Usage (> 150MB)
```javascript
// Use React.memo for expensive components
const ShiftItem = React.memo(({ shift }) => {
  return <ShiftItemContent shift={shift} />;
});

// Use useMemo for heavy computations
const memoizedValue = useMemo(() => {
  return expensiveComputation(data);
}, [data]);

// Clean up listeners and timers
useEffect(() => {
  const unsubscribe = listener.on('event', handler);
  return () => unsubscribe();
}, []);
```

#### Slow API Responses (> 500ms)
```javascript
// Implement caching
const cachedFetch = (() => {
  const cache = new Map();
  return async (url) => {
    if (cache.has(url)) return cache.get(url);
    const data = await fetch(url);
    cache.set(url, data);
    return data;
  };
})();

// Batch requests
const batchFetch = async (urls) => {
  return Promise.all(urls.map(url => fetch(url)));
};

// Use query optimization
const optimizedQuery = query(collection, 
  where('active', '==', true),
  orderBy('createdAt', 'desc'),
  limit(50)
);
```

#### High Jank/Low Frame Rate
```javascript
// Virtualize long lists
import { FlatlList } from 'react-native';

<FlatList
  data={items}
  renderItem={({ item }) => <ShiftItem shift={item} />}
  keyExtractor={(item) => item.id}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
/>

// Defer expensive operations
import { InteractionManager } from 'react-native';

InteractionManager.runAfterInteractions(() => {
  // Heavy computation here
  expensiveOperation();
});
```

---

## 📊 Running in CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Install Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Check results
        run: |
          if grep -q "Pass Rate: 100%" performance-metrics.json; then
            echo "✓ All tests passed"
            exit 0
          else
            echo "✗ Some tests failed"
            exit 1
          fi
      
      - name: Upload metrics
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: performance-metrics
          path: performance-metrics.json
```

### package.json Scripts

```json
{
  "scripts": {
    "test:performance": "node performance-tests/test-runner.js",
    "test:load": "node performance-tests/load-test.js",
    "test:profiler": "node performance-tests/react-native-profiler.js",
    "test:firebase": "bash performance-tests/firebase-load-test.sh",
    "test:all": "npm run test:performance && npm run test:lint && npm run test:unit"
  }
}
```

---

## 🚨 Troubleshooting

### Tests Won't Run

**Error: "Node modules not found"**
```bash
npm install
npm run test:performance
```

**Error: "Firebase CLI not found"**
```bash
npm install -g firebase-tools
firebase login
```

### Slow Results

**Check system resources:**
```bash
# macOS/Linux
top -l 1 | head -20

# Windows PowerShell
Get-Process | Sort-Object -Property WorkingSet -Descending | Select-Object Name, WorkingSet | head -10
```

**Close unnecessary applications** and re-run tests

### Firebase Test Issues

**"Project not found"**
```bash
firebase projects:list
# Update performance-tests/firebase-load-test.sh with correct PROJECT_ID
```

**"Permission denied"**
```bash
firebase logout
firebase login
```

---

## 📚 Additional Resources

### Performance Optimization Guides
- [React Native Performance Optimization](https://reactnative.dev/docs/performance)
- [Firebase Firestore Performance](https://firebase.google.com/docs/firestore/best-practices)
- [Chrome DevTools Profiling](https://developer.chrome.com/docs/devtools/performance/)

### Monitoring & Analytics
- [Firebase Analytics](https://firebase.google.com/docs/analytics)
- [Sentry Error Tracking](https://sentry.io)
- [LogRocket Session Replay](https://logrocket.com)

### Load Testing Tools
- [K6 Load Testing](https://k6.io)
- [Apache JMeter](https://jmeter.apache.org)
- [Locust](https://locust.io)

---

## ✅ Continuous Improvement Process

### Weekly
- [ ] Run full performance test suite
- [ ] Review metrics from previous week
- [ ] Address any regressions

### Monthly
- [ ] Performance audit
- [ ] Update test scenarios
- [ ] Review user feedback on performance

### Quarterly
- [ ] Set new performance targets
- [ ] Plan optimizations
- [ ] Infrastructure review

---

## 📞 Support

For questions or issues:
1. Check test output for specific errors
2. Review optimization recommendations
3. Consult performance guides
4. Contact engineering team

---

**Last Updated**: October 20, 2025  
**Test Suite Version**: 1.0  
**Status**: ✅ Ready for Use
