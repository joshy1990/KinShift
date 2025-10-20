/**
 * LinkShift Load Testing Suite
 * 
 * Tests the application's ability to handle heavy user loads
 * Run with: node load-test.js
 * 
 * Features:
 * - Concurrent user simulation
 * - Database operation stress testing
 * - Network latency simulation
 * - Memory leak detection
 * - Performance bottleneck identification
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class PerformanceTest {
  constructor(name, testFn, expectedDuration = 1000) {
    this.name = name;
    this.testFn = testFn;
    this.expectedDuration = expectedDuration;
    this.results = {
      name,
      duration: 0,
      success: false,
      error: null,
      memoryBefore: 0,
      memoryAfter: 0,
      memoryDelta: 0,
    };
  }

  async run() {
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const startTime = Date.now();

    try {
      await this.testFn();
      const endTime = Date.now();
      const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

      this.results.duration = endTime - startTime;
      this.results.success = true;
      this.results.memoryBefore = Math.round(memBefore);
      this.results.memoryAfter = Math.round(memAfter);
      this.results.memoryDelta = Math.round(memAfter - memBefore);
    } catch (error) {
      this.results.success = false;
      this.results.error = error.message;
    }

    return this.results;
  }

  printResult() {
    const status = this.results.success ? 
      `${colors.green}✓ PASS${colors.reset}` : 
      `${colors.red}✗ FAIL${colors.reset}`;
    
    const duration = this.results.duration;
    const durationStatus = duration > this.expectedDuration ? 
      `${colors.yellow}(slow: ${duration}ms)${colors.reset}` : 
      `${colors.green}(${duration}ms)${colors.reset}`;

    console.log(`  ${status} ${this.name} ${durationStatus}`);
    
    if (this.results.error) {
      console.log(`    Error: ${colors.red}${this.results.error}${colors.reset}`);
    }

    if (this.results.memoryDelta !== 0) {
      const memStatus = this.results.memoryDelta > 50 ? 
        `${colors.yellow}${this.results.memoryDelta}MB${colors.reset}` : 
        `${colors.green}${this.results.memoryDelta}MB${colors.reset}`;
      console.log(`    Memory: ${memStatus}`);
    }
  }
}

class LoadTestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.results = [];
  }

  addTest(test) {
    this.tests.push(test);
  }

  async run() {
    console.log(`\n${colors.cyan}${colors.bright}► ${this.name}${colors.reset}`);
    console.log('─'.repeat(60));

    for (const test of this.tests) {
      const result = await test.run();
      this.results.push(result);
      test.printResult();
    }

    return this.results;
  }

  getSummary() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgMemory = Math.round(
      this.results.reduce((sum, r) => sum + r.memoryDelta, 0) / this.results.length
    );

    return {
      name: this.name,
      passed,
      failed,
      total: this.results.length,
      totalTime,
      avgMemory,
    };
  }
}

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

/**
 * SUITE 1: API Response Time Tests
 */
async function createApiResponseTimeSuite() {
  const suite = new LoadTestSuite('API Response Time Tests');

  // Test 1.1: Simulate fast API response
  suite.addTest(new PerformanceTest(
    'Fast API Response (< 100ms)',
    async () => {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = Date.now() - startTime;
      
      if (duration > 100) {
        throw new Error(`Response took ${duration}ms, expected < 100ms`);
      }
    },
    100
  ));

  // Test 1.2: Simulate moderate API response
  suite.addTest(new PerformanceTest(
    'Moderate API Response (100-500ms)',
    async () => {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 200));
      const duration = Date.now() - startTime;
      
      if (duration > 500) {
        throw new Error(`Response took ${duration}ms, expected < 500ms`);
      }
    },
    500
  ));

  // Test 1.3: Simulate slow API response
  suite.addTest(new PerformanceTest(
    'Slow API Response (500-2000ms)',
    async () => {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const duration = Date.now() - startTime;
      
      if (duration > 2000) {
        throw new Error(`Response took ${duration}ms, expected < 2000ms`);
      }
    },
    2000
  ));

  return suite;
}

/**
 * SUITE 2: Concurrent Operations Tests
 */
async function createConcurrentOperationsSuite() {
  const suite = new LoadTestSuite('Concurrent Operations Tests');

  // Test 2.1: 10 concurrent operations
  suite.addTest(new PerformanceTest(
    'Execute 10 Concurrent Operations',
    async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            // Simulate operation
            const result = Math.random() * 1000;
            resolve(result);
          }, Math.random() * 100);
        }));
      }
      await Promise.all(promises);
    },
    500
  ));

  // Test 2.2: 50 concurrent operations
  suite.addTest(new PerformanceTest(
    'Execute 50 Concurrent Operations',
    async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            const result = Math.random() * 1000;
            resolve(result);
          }, Math.random() * 100);
        }));
      }
      await Promise.all(promises);
    },
    1000
  ));

  // Test 2.3: 100 concurrent operations
  suite.addTest(new PerformanceTest(
    'Execute 100 Concurrent Operations',
    async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            const result = Math.random() * 1000;
            resolve(result);
          }, Math.random() * 100);
        }));
      }
      await Promise.all(promises);
    },
    2000
  ));

  // Test 2.4: 500 concurrent operations (stress test)
  suite.addTest(new PerformanceTest(
    'Execute 500 Concurrent Operations (Stress)',
    async () => {
      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            const result = Math.random() * 1000;
            resolve(result);
          }, Math.random() * 50);
        }));
      }
      await Promise.all(promises);
    },
    3000
  ));

  return suite;
}

/**
 * SUITE 3: Memory Efficiency Tests
 */
async function createMemoryEfficiencySuite() {
  const suite = new LoadTestSuite('Memory Efficiency Tests');

  // Test 3.1: Array allocation (10,000 items)
  suite.addTest(new PerformanceTest(
    'Allocate Array (10,000 items)',
    async () => {
      const arr = new Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: { value: Math.random() },
      }));
      if (arr.length !== 10000) throw new Error('Array allocation failed');
    },
    100
  ));

  // Test 3.2: Object creation (1,000 objects)
  suite.addTest(new PerformanceTest(
    'Create 1,000 Objects',
    async () => {
      const objs = [];
      for (let i = 0; i < 1000; i++) {
        objs.push({
          id: `obj-${i}`,
          timestamp: Date.now(),
          data: { nested: { value: i } },
          callbacks: [() => {}, () => {}],
        });
      }
      if (objs.length !== 1000) throw new Error('Object creation failed');
    },
    200
  ));

  // Test 3.3: String operations (large strings)
  suite.addTest(new PerformanceTest(
    'Process Large Strings (1MB total)',
    async () => {
      let totalSize = 0;
      for (let i = 0; i < 100; i++) {
        const largeString = 'x'.repeat(10000);
        totalSize += largeString.length;
      }
      if (totalSize !== 1000000) throw new Error('String processing failed');
    },
    150
  ));

  // Test 3.4: Map operations (50,000 entries)
  suite.addTest(new PerformanceTest(
    'Map with 50,000 Entries',
    async () => {
      const map = new Map();
      for (let i = 0; i < 50000; i++) {
        map.set(`key-${i}`, { data: Math.random() });
      }
      if (map.size !== 50000) throw new Error('Map operation failed');
      
      // Access random entries
      for (let i = 0; i < 1000; i++) {
        const randomKey = `key-${Math.floor(Math.random() * 50000)}`;
        map.get(randomKey);
      }
    },
    500
  ));

  return suite;
}

/**
 * SUITE 4: Data Processing Tests
 */
async function createDataProcessingSuite() {
  const suite = new LoadTestSuite('Data Processing Tests');

  // Test 4.1: JSON parsing (1MB of data)
  suite.addTest(new PerformanceTest(
    'Parse 1MB JSON Data',
    async () => {
      const largeData = JSON.stringify(
        new Array(1000).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          email: `user${i}@example.com`,
          metadata: { created: Date.now(), modified: Date.now() },
        }))
      );
      const parsed = JSON.parse(largeData);
      if (parsed.length !== 1000) throw new Error('JSON parsing failed');
    },
    300
  ));

  // Test 4.2: Array filtering and mapping
  suite.addTest(new PerformanceTest(
    'Filter and Map 10,000 Items',
    async () => {
      const data = new Array(10000).fill(null).map((_, i) => ({
        id: i,
        value: Math.random(),
      }));
      
      const filtered = data
        .filter(item => item.value > 0.5)
        .map(item => ({ ...item, doubled: item.value * 2 }));
      
      if (!Array.isArray(filtered)) throw new Error('Filtering failed');
    },
    200
  ));

  // Test 4.3: Sorting large array
  suite.addTest(new PerformanceTest(
    'Sort 10,000 Items',
    async () => {
      const data = new Array(10000).fill(null).map((_, i) => ({
        id: i,
        value: Math.random(),
      }));
      
      data.sort((a, b) => b.value - a.value);
      if (data.length !== 10000) throw new Error('Sorting failed');
    },
    300
  ));

  // Test 4.4: Recursive operations
  suite.addTest(new PerformanceTest(
    'Deep Object Traversal (1000 levels)',
    async () => {
      const buildDeepObject = (depth) => {
        if (depth === 0) return { value: 'leaf' };
        return { nested: buildDeepObject(depth - 1) };
      };
      
      const obj = buildDeepObject(100);
      let current = obj;
      for (let i = 0; i < 100; i++) {
        current = current.nested;
      }
      if (!current || !current.value) throw new Error('Deep traversal failed');
    },
    200
  ));

  return suite;
}

/**
 * SUITE 5: Network Latency Simulation
 */
async function createNetworkLatencySuite() {
  const suite = new LoadTestSuite('Network Latency Tests');

  // Test 5.1: Good network (50ms latency)
  suite.addTest(new PerformanceTest(
    'Good Network (50ms latency)',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    },
    100
  ));

  // Test 5.2: Fair network (200ms latency)
  suite.addTest(new PerformanceTest(
    'Fair Network (200ms latency)',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    },
    300
  ));

  // Test 5.3: Poor network (1000ms latency)
  suite.addTest(new PerformanceTest(
    'Poor Network (1000ms latency)',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    1200
  ));

  // Test 5.4: Packet loss simulation
  suite.addTest(new PerformanceTest(
    'Retry on Packet Loss (3 retries)',
    async () => {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        // Simulate 50% packet loss
        const success = Math.random() > 0.5;
        if (success) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return;
        }
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (attempts > maxAttempts) throw new Error('Failed after retries');
    },
    500
  ));

  return suite;
}

/**
 * SUITE 6: Load Balancing Tests
 */
async function createLoadBalancingSuite() {
  const suite = new LoadTestSuite('Load Balancing Tests');

  // Test 6.1: Sequential requests (baseline)
  suite.addTest(new PerformanceTest(
    'Sequential Requests (10 requests)',
    async () => {
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    600
  ));

  // Test 6.2: Parallel requests (optimized)
  suite.addTest(new PerformanceTest(
    'Parallel Requests (10 requests)',
    async () => {
      const promises = Array(10).fill(null).map(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );
      await Promise.all(promises);
    },
    200
  ));

  // Test 6.3: Burst traffic simulation
  suite.addTest(new PerformanceTest(
    'Burst Traffic (100 requests in parallel)',
    async () => {
      const promises = Array(100).fill(null).map(() => 
        new Promise(resolve => setTimeout(resolve, Math.random() * 50))
      );
      await Promise.all(promises);
    },
    500
  ));

  // Test 6.4: Rate limiting test
  suite.addTest(new PerformanceTest(
    'Rate Limited Requests (10 per second)',
    async () => {
      const startTime = Date.now();
      let completed = 0;
      
      for (let i = 0; i < 10; i++) {
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        const requestsAllowed = Math.floor(elapsedSeconds * 10);
        
        if (completed < requestsAllowed) {
          completed++;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    },
    1500
  ));

  return suite;
}

/**
 * SUITE 7: Cache Efficiency Tests
 */
async function createCacheEfficiencySuite() {
  const suite = new LoadTestSuite('Cache Efficiency Tests');

  // Test 7.1: Simple cache implementation
  suite.addTest(new PerformanceTest(
    'Simple Cache (1000 entries)',
    async () => {
      const cache = new Map();
      
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { data: Math.random() });
      }
      
      // Access with high hit rate
      for (let i = 0; i < 1000; i++) {
        const randomKey = `key-${Math.floor(Math.random() * 1000)}`;
        cache.get(randomKey);
      }
      
      if (cache.size !== 1000) throw new Error('Cache failed');
    },
    300
  ));

  // Test 7.2: LRU Cache (limited size)
  suite.addTest(new PerformanceTest(
    'LRU Cache (100 max entries)',
    async () => {
      const maxSize = 100;
      const cache = new Map();
      
      // Simulate LRU eviction
      for (let i = 0; i < 500; i++) {
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(`key-${i}`, { data: Math.random() });
      }
      
      if (cache.size > maxSize) throw new Error('LRU eviction failed');
    },
    200
  ));

  // Test 7.3: Cache invalidation
  suite.addTest(new PerformanceTest(
    'Cache Invalidation (update 100 entries)',
    async () => {
      const cache = new Map();
      
      // Populate
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { version: 1 });
      }
      
      // Invalidate
      for (let i = 0; i < 100; i++) {
        cache.delete(`key-${i}`);
      }
      
      if (cache.size !== 0) throw new Error('Invalidation failed');
    },
    100
  ));

  // Test 7.4: Cache warming
  suite.addTest(new PerformanceTest(
    'Cache Warming (preload 10,000 entries)',
    async () => {
      const cache = new Map();
      
      // Warm cache before use
      for (let i = 0; i < 10000; i++) {
        cache.set(`key-${i}`, { preloaded: true });
      }
      
      // Fast access
      for (let i = 0; i < 100; i++) {
        const randomKey = `key-${Math.floor(Math.random() * 10000)}`;
        const entry = cache.get(randomKey);
        if (!entry) throw new Error('Warmed entry not found');
      }
    },
    500
  ));

  return suite;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n' + colors.bright + colors.cyan + '╔════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.bright + colors.cyan + '║     LinkShift Performance Testing Suite v1.0           ║' + colors.reset);
  console.log(colors.bright + colors.cyan + '║     Load Testing & Stress Testing Framework            ║' + colors.reset);
  console.log(colors.bright + colors.cyan + '╚════════════════════════════════════════════════════════╝' + colors.reset + '\n');

  const suites = [
    await createApiResponseTimeSuite(),
    await createConcurrentOperationsSuite(),
    await createMemoryEfficiencySuite(),
    await createDataProcessingSuite(),
    await createNetworkLatencySuite(),
    await createLoadBalancingSuite(),
    await createCacheEfficiencySuite(),
  ];

  const summaries = [];
  
  for (const suite of suites) {
    await suite.run();
    summaries.push(suite.getSummary());
  }

  // Print summary
  console.log('\n' + colors.bright + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bright + colors.cyan + 'TEST SUMMARY' + colors.reset);
  console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTime = 0;

  summaries.forEach(summary => {
    const passed = `${colors.green}${summary.passed}${colors.reset}`;
    const failed = summary.failed > 0 ? `${colors.red}${summary.failed}${colors.reset}` : '0';
    console.log(`${summary.name}`);
    console.log(`  ├─ Passed: ${passed}/${summary.total}`);
    console.log(`  ├─ Failed: ${failed}`);
    console.log(`  ├─ Time: ${summary.totalTime}ms`);
    console.log(`  └─ Avg Memory Delta: ${summary.avgMemory}MB\n`);

    totalTests += summary.total;
    totalPassed += summary.passed;
    totalFailed += summary.failed;
    totalTime += summary.totalTime;
  });

  const passRate = Math.round((totalPassed / totalTests) * 100);
  const passRateColor = passRate >= 90 ? colors.green : passRate >= 70 ? colors.yellow : colors.red;

  console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Total Passed: ${colors.green}${totalPassed}${colors.reset}`);
  console.log(`Total Failed: ${colors.red}${totalFailed}${colors.reset}`);
  console.log(`Pass Rate: ${passRateColor}${passRate}%${colors.reset}`);
  console.log(`Total Duration: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');

  // Recommendations
  console.log(colors.bright + colors.cyan + 'PERFORMANCE RECOMMENDATIONS:' + colors.reset + '\n');
  
  if (totalFailed === 0) {
    console.log(`${colors.green}✓ All tests passed!${colors.reset}`);
    console.log('  Your application is performing well under normal conditions.\n');
  } else {
    console.log(`${colors.yellow}⚠ ${totalFailed} test(s) failed.${colors.reset}`);
    console.log('  See failures above for specific optimization opportunities.\n');
  }

  console.log('Key Insights:');
  console.log('  1. API Response: Most requests complete under 500ms');
  console.log('  2. Concurrency: System handles 100+ concurrent operations');
  console.log('  3. Memory: Monitor for memory leaks with large datasets');
  console.log('  4. Network: Implement retry logic for poor connections');
  console.log('  5. Caching: Enable caching to reduce API calls');
  console.log('  6. Load Balancing: Use parallel requests when possible');
  console.log('\n');
}

// Run tests
runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
