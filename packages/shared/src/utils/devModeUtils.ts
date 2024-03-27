import platformEnv from '../platformEnv';

const SensitiveMessage = '❃❃❃❃ sensitive information ❃❃❃❃';

export function devOnlyData<T>(
  data: T,
  fallback = SensitiveMessage,
): T | string {
  if (platformEnv.isDev) {
    return data;
  }
  return fallback;
}
