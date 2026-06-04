import { isPerpsMobileLayoutTraceEnabled } from './mobileLayoutTrace';

const originalPerfMonitorEnabled = process.env.PERF_MONITOR_ENABLED;
const originalPerpsMobileLayoutTrace = process.env.PERPS_MOBILE_LAYOUT_TRACE;
const originalNodeEnv = process.env.NODE_ENV;

describe('mobileLayoutTrace', () => {
  afterEach(() => {
    if (originalPerfMonitorEnabled === undefined) {
      delete process.env.PERF_MONITOR_ENABLED;
    } else {
      process.env.PERF_MONITOR_ENABLED = originalPerfMonitorEnabled;
    }

    if (originalPerpsMobileLayoutTrace === undefined) {
      delete process.env.PERPS_MOBILE_LAYOUT_TRACE;
    } else {
      process.env.PERPS_MOBILE_LAYOUT_TRACE = originalPerpsMobileLayoutTrace;
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('keeps perps layout tracing disabled by default', () => {
    delete process.env.PERF_MONITOR_ENABLED;
    delete process.env.PERPS_MOBILE_LAYOUT_TRACE;

    expect(isPerpsMobileLayoutTraceEnabled()).toBe(false);
  });

  it('enables perps layout tracing only with explicit diagnostics flags', () => {
    process.env.PERF_MONITOR_ENABLED = '1';
    expect(isPerpsMobileLayoutTraceEnabled()).toBe(true);

    delete process.env.PERF_MONITOR_ENABLED;
    process.env.PERPS_MOBILE_LAYOUT_TRACE = '1';
    expect(isPerpsMobileLayoutTraceEnabled()).toBe(true);
  });

  it('keeps perps layout tracing disabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PERF_MONITOR_ENABLED = '1';
    process.env.PERPS_MOBILE_LAYOUT_TRACE = '1';

    expect(isPerpsMobileLayoutTraceEnabled()).toBe(false);
  });
});
