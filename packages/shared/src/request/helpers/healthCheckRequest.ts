/**
 * Health Check Request - Default implementation for Web/Extension
 * Uses native fetch API as fallback
 */

export interface IHealthCheckConfig {
  url: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  headers?: Record<string, string>;
}

export interface IHealthCheckResponse {
  status: number;
  ok: boolean;
}

/**
 * Perform health check request using native fetch
 * This is the fallback implementation for platforms that don't support IP Table
 */
export async function healthCheckRequest(
  config: IHealthCheckConfig,
): Promise<IHealthCheckResponse> {
  const { url, method = 'GET', timeout = 10_000, headers = {} } = config;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    return {
      status: response.status,
      ok: response.ok,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
