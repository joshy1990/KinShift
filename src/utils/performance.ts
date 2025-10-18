/**
 * Performance Monitoring Utilities
 * Track and log performance metrics for optimization
 */

import React from 'react';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean = __DEV__; // Only enabled in development by default

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Start tracking a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.metrics.set(name, {
      name,
      startTime: Date.now(),
      metadata,
    });
  }

  /**
   * Stop tracking and log the metric
   */
  end(name: string): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    this.logMetric(metric);
    this.metrics.delete(name);

    return duration;
  }

  /**
   * Measure the execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return await Promise.resolve(fn());
    }

    this.start(name, metadata);
    try {
      const result = await Promise.resolve(fn());
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Log a metric to console
   */
  private logMetric(metric: PerformanceMetric): void {
    const duration = metric.duration || 0;
    const color = this.getColorForDuration(duration);
    const metadataStr = metric.metadata
      ? ` | ${JSON.stringify(metric.metadata)}`
      : '';

    console.log(
      `%c⚡ ${metric.name}: ${duration}ms${metadataStr}`,
      `color: ${color}; font-weight: bold;`
    );

    // Warn for slow operations
    if (duration > 1000) {
      console.warn(
        `⚠️ Slow operation detected: "${metric.name}" took ${duration}ms`
      );
    }
  }

  /**
   * Get console color based on duration
   */
  private getColorForDuration(duration: number): string {
    if (duration < 100) return '#10B981'; // Fast - green
    if (duration < 500) return '#F59E0B'; // Medium - amber
    return '#EF4444'; // Slow - red
  }

  /**
   * Get all active metrics
   */
  getActiveMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): string {
    const active = this.getActiveMetrics();
    if (active.length === 0) {
      return 'No active performance metrics';
    }

    return `Active metrics: ${active.map((m) => m.name).join(', ')}`;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function to measure component render time
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name;

  return function PerformanceTrackedComponent(props: P) {
    const renderStart = React.useRef<number>(Date.now());

    React.useEffect(() => {
      const renderTime = Date.now() - renderStart.current;
      if (renderTime > 16) {
        // More than one frame (60fps)
        console.log(
          `%c🎨 ${name} render: ${renderTime}ms`,
          'color: #8B5CF6; font-weight: bold;'
        );
      }
    });

    return React.createElement(Component, props);
  };
}

/**
 * Hook to measure custom metrics
 */
export function usePerformanceMetric(metricName: string) {
  React.useEffect(() => {
    performanceMonitor.start(metricName);
    return () => {
      performanceMonitor.end(metricName);
    };
  }, [metricName]);
}

/**
 * Measure API call performance
 */
export async function measureApiCall<T>(
  apiName: string,
  apiCall: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measure(`API: ${apiName}`, apiCall);
}

/**
 * Measure database query performance
 */
export async function measureDbQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measure(`DB: ${queryName}`, query);
}

/**
 * Memory usage tracking (if available)
 */
export function logMemoryUsage(): void {
  if (
    typeof global !== 'undefined' &&
    (global as any).performance &&
    (global as any).performance.memory
  ) {
    const memory = (global as any).performance.memory;
    const used = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const total = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const limit = (memory.jsHeapSizeLimit / 1048576).toFixed(2);

    console.log(
      `%c💾 Memory: ${used}MB / ${total}MB (Limit: ${limit}MB)`,
      'color: #06B6D4; font-weight: bold;'
    );
  }
}

/**
 * FPS monitoring (React Native specific)
 */
export function startFPSMonitoring(interval: number = 1000): () => void {
  let frameCount = 0;
  let lastTime = Date.now();
  let animationFrameId: number;

  const measureFPS = () => {
    frameCount++;
    const currentTime = Date.now();
    const elapsed = currentTime - lastTime;

    if (elapsed >= interval) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      const color = fps >= 55 ? '#10B981' : fps >= 30 ? '#F59E0B' : '#EF4444';

      console.log(
        `%c📊 FPS: ${fps}`,
        `color: ${color}; font-weight: bold;`
      );

      if (fps < 30) {
        console.warn('⚠️ Low FPS detected. Performance issues may be present.');
      }

      frameCount = 0;
      lastTime = currentTime;
    }

    animationFrameId = requestAnimationFrame(measureFPS);
  };

  animationFrameId = requestAnimationFrame(measureFPS);

  // Return cleanup function
  return () => {
    cancelAnimationFrame(animationFrameId);
  };
}
