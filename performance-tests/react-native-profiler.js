/**
 * React Native Performance Profiler
 * 
 * Analyzes app performance metrics:
 * - Frame rate (60 FPS target)
 * - Memory usage
 * - Component render times
 * - Network requests
 * 
 * Run with: node react-native-profiler.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class PerformanceProfiler {
  constructor() {
    this.metrics = {
      frameRate: [],
      memoryUsage: [],
      renderTimes: {},
      networkRequests: [],
      jankFrames: [],
    };
    
    this.targetFrameRate = 60;
    this.memoryThreshold = 200; // MB
  }

  /**
   * Simulate frame rate measurement
   * Target: 60 FPS (16.67ms per frame)
   */
  recordFrameRate(fps) {
    this.metrics.frameRate.push({
      fps,
      timestamp: Date.now(),
      isJank: fps < 50, // Jank if below 50 FPS
    });
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      timestamp: Date.now(),
    });
  }

  /**
   * Record component render time
   */
  recordRenderTime(componentName, duration) {
    if (!this.metrics.renderTimes[componentName]) {
      this.metrics.renderTimes[componentName] = [];
    }
    this.metrics.renderTimes[componentName].push({
      duration,
      timestamp: Date.now(),
      isSlow: duration > 16.67, // Slow if > 1 frame duration
    });
  }

  /**
   * Record network request
   */
  recordNetworkRequest(url, duration, status) {
    this.metrics.networkRequests.push({
      url,
      duration,
      status,
      timestamp: Date.now(),
      isSlowNetwork: duration > 1000, // Slow if > 1s
    });
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    const stats = {
      frameRate: this.calculateFrameRateStats(),
      memory: this.calculateMemoryStats(),
      rendering: this.calculateRenderStats(),
      network: this.calculateNetworkStats(),
    };
    
    return stats;
  }

  calculateFrameRateStats() {
    if (this.metrics.frameRate.length === 0) {
      return { avg: 0, min: 0, max: 0, jankCount: 0, jankPercent: 0 };
    }

    const rates = this.metrics.frameRate.map(f => f.fps);
    const jankCount = this.metrics.frameRate.filter(f => f.isJank).length;

    return {
      avg: Math.round(rates.reduce((a, b) => a + b) / rates.length),
      min: Math.min(...rates),
      max: Math.max(...rates),
      jankCount,
      jankPercent: Math.round((jankCount / rates.length) * 100),
      dataPoints: rates.length,
    };
  }

  calculateMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) {
      return { avgHeap: 0, maxHeap: 0, leak: false };
    }

    const heapUsages = this.metrics.memoryUsage.map(m => m.heapUsed);
    const trend = heapUsages.slice(-10); // Last 10 measurements
    const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
    const secondHalf = trend.slice(Math.floor(trend.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    const leak = avgSecond > avgFirst * 1.1; // 10% increase = potential leak

    return {
      avgHeap: Math.round(heapUsages.reduce((a, b) => a + b) / heapUsages.length),
      maxHeap: Math.max(...heapUsages),
      minHeap: Math.min(...heapUsages),
      potentialLeak: leak,
      trendingUp: avgSecond > avgFirst,
      dataPoints: heapUsages.length,
    };
  }

  calculateRenderStats() {
    const allRenders = Object.entries(this.metrics.renderTimes).map(([name, times]) => ({
      component: name,
      avgTime: Math.round(times.reduce((a, b) => a + b.duration) / times.length * 100) / 100,
      slowRenders: times.filter(t => t.isSlow).length,
      totalRenders: times.length,
      maxTime: Math.max(...times.map(t => t.duration)),
    }));

    return {
      components: allRenders.length,
      totalRenders: Object.values(this.metrics.renderTimes).reduce((sum, arr) => sum + arr.length, 0),
      slowestComponent: allRenders.sort((a, b) => b.avgTime - a.avgTime)[0],
      componentStats: allRenders,
    };
  }

  calculateNetworkStats() {
    if (this.metrics.networkRequests.length === 0) {
      return { avg: 0, min: 0, max: 0, slowCount: 0, slowPercent: 0 };
    }

    const durations = this.metrics.networkRequests.map(r => r.duration);
    const slowCount = this.metrics.networkRequests.filter(r => r.isSlowNetwork).length;
    const successCount = this.metrics.networkRequests.filter(r => r.status === 200).length;

    return {
      avg: Math.round(durations.reduce((a, b) => a + b) / durations.length),
      min: Math.min(...durations),
      max: Math.max(...durations),
      slowCount,
      slowPercent: Math.round((slowCount / durations.length) * 100),
      successRate: Math.round((successCount / this.metrics.networkRequests.length) * 100),
      totalRequests: this.metrics.networkRequests.length,
    };
  }

  /**
   * Print detailed report
   */
  printReport() {
    const stats = this.calculateStats();

    console.log('\n' + colors.cyan + colors.bright + '╔════════════════════════════════════════════════════════╗' + colors.reset);
    console.log(colors.cyan + colors.bright + '║   React Native Performance Profiler Report             ║' + colors.reset);
    console.log(colors.cyan + colors.bright + '╚════════════════════════════════════════════════════════╝' + colors.reset + '\n');

    // Frame Rate Report
    console.log(colors.blue + '► Frame Rate Performance' + colors.reset);
    const fps = stats.frameRate;
    const fpsColor = fps.avg >= 50 ? colors.green : fps.avg >= 30 ? colors.yellow : colors.red;
    console.log(`  Average FPS: ${fpsColor}${fps.avg}${colors.reset} / 60 target`);
    console.log(`  Frame Range: ${fps.min} - ${fps.max} FPS`);
    console.log(`  Jank Events: ${colors.yellow}${fps.jankCount}${colors.reset} (${fps.jankPercent}% of frames)`);
    console.log(`  Status: ${fps.avg >= 55 ? colors.green + '✓ Smooth' : fps.avg >= 40 ? colors.yellow + '⚠ Acceptable' : colors.red + '✗ Janky'}${colors.reset}\n`);

    // Memory Report
    console.log(colors.blue + '► Memory Usage' + colors.reset);
    const mem = stats.memory;
    const memColor = mem.avgHeap < 100 ? colors.green : mem.avgHeap < 200 ? colors.yellow : colors.red;
    console.log(`  Average Heap: ${memColor}${mem.avgHeap}MB${colors.reset}`);
    console.log(`  Peak Heap: ${mem.maxHeap}MB`);
    console.log(`  Memory Range: ${mem.minHeap} - ${mem.maxHeap}MB`);
    
    if (mem.potentialLeak) {
      console.log(`  ${colors.red}⚠ Potential memory leak detected${colors.reset}`);
    } else if (mem.trendingUp) {
      console.log(`  ${colors.yellow}⚠ Memory usage trending up${colors.reset}`);
    } else {
      console.log(`  ${colors.green}✓ Memory stable${colors.reset}`);
    }
    console.log('');

    // Rendering Report
    console.log(colors.blue + '› Component Rendering' + colors.reset);
    const render = stats.rendering;
    console.log(`  Components Tracked: ${render.components}`);
    console.log(`  Total Renders: ${render.totalRenders}`);
    if (render.slowestComponent) {
      console.log(`  Slowest Component: ${render.slowestComponent.component} (${render.slowestComponent.avgTime}ms avg)`);
      if (render.slowestComponent.slowRenders > 0) {
        console.log(`    ${colors.yellow}→ Slow renders: ${render.slowestComponent.slowRenders}/${render.slowestComponent.totalRenders}${colors.reset}`);
      }
    }
    
    // Detailed component stats
    if (render.componentStats.length > 0) {
      console.log(`\n  Component Statistics:`);
      render.componentStats.forEach(comp => {
        const timeColor = comp.avgTime < 10 ? colors.green : comp.avgTime < 20 ? colors.yellow : colors.red;
        console.log(`    ${comp.component}: ${timeColor}${comp.avgTime}ms avg${colors.reset} (${comp.totalRenders} renders)`);
      });
    }
    console.log('');

    // Network Report
    console.log(colors.blue + '► Network Performance' + colors.reset);
    const net = stats.network;
    const netColor = net.avg < 200 ? colors.green : net.avg < 500 ? colors.yellow : colors.red;
    console.log(`  Average Latency: ${netColor}${net.avg}ms${colors.reset}`);
    console.log(`  Latency Range: ${net.min} - ${net.max}ms`);
    console.log(`  Slow Requests: ${colors.yellow}${net.slowCount}${colors.reset} (${net.slowPercent}%)`);
    console.log(`  Success Rate: ${colors.green}${net.successRate}%${colors.reset}`);
    console.log(`  Total Requests: ${net.totalRequests}\n`);

    // Overall Assessment
    console.log(colors.blue + '► Overall Assessment' + colors.reset);
    const issues = [
      fps.avg < 50 && 'Frame rate below target (50+ FPS)',
      mem.potentialLeak && 'Potential memory leak',
      render.slowestComponent?.avgTime > 20 && 'Slow component rendering',
      net.slowPercent > 10 && 'High percentage of slow network requests',
    ].filter(Boolean);

    if (issues.length === 0) {
      console.log(`${colors.green}✓ Excellent performance${colors.reset} - No issues detected`);
    } else {
      console.log(`${colors.yellow}⚠ Issues detected:${colors.reset}`);
      issues.forEach(issue => console.log(`  • ${issue}`));
    }
    console.log('');

    // Recommendations
    console.log(colors.blue + '► Recommendations' + colors.reset);
    if (fps.jankPercent > 5) {
      console.log(`  1. ${colors.yellow}Frame rate optimization:${colors.reset}`);
      console.log('     - Reduce render complexity');
      console.log('     - Use React.memo for expensive components');
      console.log('     - Implement virtualization for long lists');
    }
    if (mem.potentialLeak) {
      console.log(`  2. ${colors.yellow}Memory leak investigation:${colors.reset}`);
      console.log('     - Check for circular references');
      console.log('     - Verify event listener cleanup');
      console.log('     - Profile with Chrome DevTools');
    }
    if (render.slowestComponent?.avgTime > 20) {
      console.log(`  3. ${colors.yellow}Component performance:${colors.reset}`);
      console.log(`     - Optimize ${render.slowestComponent.component}`);
      console.log('     - Break into smaller components');
      console.log('     - Use useMemo/useCallback hooks');
    }
    if (net.slowPercent > 10) {
      console.log(`  4. ${colors.yellow}Network optimization:${colors.reset}`);
      console.log('     - Implement request batching');
      console.log('     - Enable response caching');
      console.log('     - Use data compression');
    }
    console.log('');
  }

  /**
   * Export metrics to file
   */
  exportMetrics(filename = 'performance-metrics.json') {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      stats: this.calculateStats(),
      recommendations: this.generateRecommendations(),
    };

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`${colors.green}✓ Metrics exported to ${filename}${colors.reset}`);
  }

  generateRecommendations() {
    const stats = this.calculateStats();
    const recommendations = [];

    if (stats.frameRate.avg < 50) {
      recommendations.push({
        category: 'Frame Rate',
        severity: 'HIGH',
        message: 'Average FPS below 50. Consider optimizing rendering.',
        actions: [
          'Use React.memo for complex components',
          'Implement list virtualization',
          'Reduce re-render frequency',
        ],
      });
    }

    if (stats.memory.potentialLeak) {
      recommendations.push({
        category: 'Memory',
        severity: 'HIGH',
        message: 'Potential memory leak detected.',
        actions: [
          'Check for circular references',
          'Verify cleanup in useEffect hooks',
          'Profile with Chrome DevTools',
        ],
      });
    }

    if (stats.rendering.slowestComponent?.avgTime > 20) {
      recommendations.push({
        category: 'Rendering',
        severity: 'MEDIUM',
        message: `${stats.rendering.slowestComponent.component} is slow to render.`,
        actions: [
          'Break component into smaller chunks',
          'Use useMemo for expensive calculations',
          'Profile with React DevTools Profiler',
        ],
      });
    }

    if (stats.network.slowPercent > 10) {
      recommendations.push({
        category: 'Network',
        severity: 'MEDIUM',
        message: `${stats.network.slowPercent}% of requests are slow.`,
        actions: [
          'Implement request batching',
          'Add response caching',
          'Use compression for large payloads',
        ],
      });
    }

    return recommendations;
  }
}

// ============================================================================
// SIMULATION & TESTING
// ============================================================================

async function runSimulation() {
  const profiler = new PerformanceProfiler();

  console.log(`\n${colors.cyan}Starting React Native performance simulation...${colors.reset}\n`);

  // Simulate frame rate data (60 FPS with occasional jank)
  for (let i = 0; i < 100; i++) {
    const fps = Math.random() > 0.1 ? 55 + Math.random() * 10 : 20 + Math.random() * 30;
    profiler.recordFrameRate(Math.round(fps));
  }

  // Simulate memory usage
  for (let i = 0; i < 50; i++) {
    // Gradually increasing memory to simulate potential leak
    const leak = i > 25 ? i * 0.5 : 0;
    global.gc?.(); // Force GC if available
    profiler.recordMemoryUsage();
  }

  // Simulate component rendering
  const components = ['HomeScreen', 'ShiftList', 'ShiftItem', 'Calendar', 'ProfileScreen'];
  for (const component of components) {
    for (let i = 0; i < 20; i++) {
      const baseDuration = { HomeScreen: 15, ShiftList: 12, ShiftItem: 8, Calendar: 20, ProfileScreen: 18 }[component];
      const duration = baseDuration + (Math.random() - 0.5) * 8;
      profiler.recordRenderTime(component, duration);
    }
  }

  // Simulate network requests
  const urls = [
    '/api/shifts',
    '/api/household',
    '/api/messages',
    '/api/invitations',
    '/api/notifications',
  ];
  for (let i = 0; i < 50; i++) {
    const url = urls[Math.floor(Math.random() * urls.length)];
    const status = Math.random() > 0.05 ? 200 : 500;
    const duration = Math.round(100 + Math.random() * 400);
    profiler.recordNetworkRequest(url, duration, status);
  }

  // Print report
  profiler.printReport();

  // Export metrics
  profiler.exportMetrics('./performance-metrics.json');
}

// Run simulation
runSimulation().catch(err => {
  console.error('Profiler error:', err);
  process.exit(1);
});
