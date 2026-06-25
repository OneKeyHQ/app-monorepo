import { totalMemory } from 'expo-device';

// Native low-end-device flag, computed once at module load from device RAM.
//
// `expo-device` `totalMemory` is in bytes. We use binary GiB (1024^3) so that
// 3GB-class devices that report ~3.14e9 bytes (e.g. iPhone 7 Plus) are included.
// Threshold 3.5 * GiB = 3_758_096_384 bytes.
//
// Used to defer rendering the full app tree behind the lock screen during a
// cold-start lock, so the single background JS thread is free to finish the
// 600k-iteration PBKDF2 `verifyPassword` before iOS jetsam kills the process.
const GB = 1024 * 1024 * 1024;
const LOW_END_MEMORY_THRESHOLD = 3.5 * GB; // 3_758_096_384 bytes

const mem = typeof totalMemory === 'number' ? totalMemory : 0;

export const IS_LOW_END_DEVICE = mem > 0 && mem <= LOW_END_MEMORY_THRESHOLD;
