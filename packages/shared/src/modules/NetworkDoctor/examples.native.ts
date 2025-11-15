/**
 * Network Doctor Library - Usage Examples
 *
 * Demonstrates various usage scenarios
 */

import { EDiagnosticIssueType, runNetworkDoctor } from './index.native';

// ==================== Example 1: Basic Usage ====================

export async function example1Basic() {
  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
  });

  console.log('Network Assessment:', report.summary.assessment);

  if (!report.summary.allCriticalChecksPassed) {
    console.error('Issues detected:', report.summary.issues);
  }
}

// ==================== Example 2: Full Configuration ====================

export async function example2FullConfig() {
  const report = await runNetworkDoctor({
    // Required
    targetDomain: 'wallet.onekeytest.com',

    // Custom health check path
    healthCheckPath: '/wallet/v1/health',

    // Dynamic Headers
    headersGenerator: async () => ({
      Authorization: `Bearer ${await getAuthToken()}`,
      'X-Request-ID': generateRequestId(),
      'X-Device-ID': getDeviceId(),
      'X-App-Version': getAppVersion(),
    }),

    // Timeout configuration
    timeouts: {
      dns: 5000,
      tcp: 8000,
      tls: 10_000,
      http: 15_000,
      ping: 3000,
    },

    // Extra test targets
    extraPingTargets: ['1.1.1.1', '8.8.8.8'],
    extraHttpProbes: [
      { label: 'api_status', url: 'https://api.example.com/status' },
    ],

    // Network logging
    enableNetworkLogger: true,
    maxNetworkLogs: 500,
  });

  return report;
}

// ==================== Example 3: SNI Blocking Detection ====================

export async function example3DetectSniBlocking() {
  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
    healthCheckPath: '/wallet/v1/health',
  });

  // Detect SNI blocking
  const sniBlockingIssue = report.summary.issues.find(
    (issue) => issue.type === EDiagnosticIssueType.SELECTIVE_BLOCKING,
  );

  if (sniBlockingIssue) {
    console.error('🚨 SNI Blocking detected!');
    console.log('Details:', sniBlockingIssue.details);
    console.log('Suggested solutions:', sniBlockingIssue.suggestedSolutions);

    // Switch to backup strategy
    await switchToBackupDomain();
  } else {
    console.log('✅ No SNI blocking detected');
  }
}

// ==================== Example 4: Auto Report to Server ====================

export async function example4ReportToServer() {
  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
  });

  // Upload diagnostic data
  await fetch('https://analytics.example.com/network-diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: getUserId(),
      country: getUserCountry(),
      timestamp: report.timestamp,
      assessment: report.summary.assessment,
      issues: report.summary.issues.map((i) => ({
        type: i.type,
        severity: i.severity,
        message: i.message,
      })),
      metrics: report.metrics,
    }),
  });
}

// ==================== Example 5: Run on App Start ====================

export async function example5OnAppStart() {
  console.log('Running network diagnostics on app start...');

  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
    headersGenerator: async () => ({
      'X-User-Country': getUserCountry(),
    }),
  });

  // Take action based on results
  if (report.summary.assessment === 'blocked') {
    // Network blocked
    showNetworkBlockedAlert();
    await enableAlternativeConnection();
  } else if (report.summary.assessment === 'degraded') {
    // Poor network quality
    showNetworkDegradedWarning();
  } else {
    // Network healthy
    console.log('✅ Network is healthy');
  }

  // Log performance metrics
  logPerformanceMetrics(report.metrics);
}

// ==================== Example 6: Conditional Diagnostics ====================

export async function example6ConditionalDiagnostics() {
  // Only run full diagnostics under certain conditions
  const shouldRunFullDiagnostics =
    getUserCountry() === 'JP' || // Japanese users
    hasReportedNetworkIssues() || // User reported issues
    isFirstLaunchToday(); // First launch today

  if (!shouldRunFullDiagnostics) {
    // Only run quick check
    const quickCheck = await runQuickNetworkCheck();
    return quickCheck;
  }

  // Run full diagnostics
  const report = await runNetworkDoctor({
    targetDomain: 'wallet.onekeytest.com',
  });

  // Cache results
  await cacheReportForToday(report);

  return report;
}

// ==================== Helper Functions (Examples) ====================

async function getAuthToken(): Promise<string> {
  // Actual implementation
  return 'mock-token';
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(7);
}

function getDeviceId(): string {
  return 'device-id';
}

function getAppVersion(): string {
  return '1.0.0';
}

function getUserId(): string {
  return 'user-123';
}

function getUserCountry(): string {
  return 'JP';
}

async function switchToBackupDomain(): Promise<void> {
  console.log('Switching to backup domain...');
}

function showNetworkBlockedAlert(): void {
  console.log('Alert: Network is blocked');
}

function showNetworkDegradedWarning(): void {
  console.log('Warning: Network is degraded');
}

async function enableAlternativeConnection(): Promise<void> {
  console.log('Enabling alternative connection...');
}

function logPerformanceMetrics(metrics: any): void {
  console.log('Performance metrics:', metrics);
}

function hasReportedNetworkIssues(): boolean {
  return false;
}

function isFirstLaunchToday(): boolean {
  return true;
}

async function runQuickNetworkCheck(): Promise<any> {
  return { status: 'ok' };
}

async function cacheReportForToday(report: any): Promise<void> {
  console.log('Caching report...');
}
