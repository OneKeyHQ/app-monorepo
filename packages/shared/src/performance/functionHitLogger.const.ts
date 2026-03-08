// Function hit logger constants
export const HEARTBEAT_LOG_RELATIVE_PATH = 'rn-profiler/heartbeat.log';
export const FUNCTION_LOG_RELATIVE_PATH = 'rn-profiler/functions.log';
export const FUNCTION_THRESHOLD_DEFAULT_MS = 100; // Increased from 30ms to reduce noise
export const FUNCTION_WARN_DEFAULT_MS = 300; // Increased from 120ms
export const FUNCTION_THRESHOLD_REQUEST_MS = 500; // Increased from 300ms
export const FUNCTION_WARN_REQUEST_MS = 1000; // Increased from 800ms
export const FUNCTION_SAMPLE_REQUEST_DEFAULT = 5; // 1 of N
export const CALL_STACK_MAX_DEPTH = 50; // Internal tracking limit
// Keep a deeper slice of the call chain so flame graphs have more context
export const CALL_STACK_LOG_DEPTH = 12; // Only log top N frames to keep logs lean
