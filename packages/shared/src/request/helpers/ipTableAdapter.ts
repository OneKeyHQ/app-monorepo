import axios, { AxiosHeaders } from 'axios';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import requestHelper from '../requestHelper';

import { isSniSupported, sniRequest } from './sniRequest';

import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * Debug logging helper - only logs in development mode
 */
const DEBUG = platformEnv.isDev;
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};
const debugWarn = (...args: any[]) => {
  if (DEBUG) {
    console.warn(...args);
  }
};
const debugError = (...args: any[]) => {
  // Always log errors, even in production
  console.error(...args);
};

/**
 * Extract root domain from hostname
 * Example: wallet.example.com -> example.com
 * Example: api.example.so -> example.so
 */
function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Check if IP Table should be used based on environment and dev settings
 * @returns true if IP Table should be used, false otherwise
 */
async function shouldUseIpTable(): Promise<boolean> {
  const defaultEnabled = false;
  try {
    const devSettings = await requestHelper.getDevSettingsPersistAtom();

    if (!devSettings.enabled) {
      return defaultEnabled;
    }

    const enabledInDev = !!devSettings.settings?.enableIpTableInDev;
    if (devSettings.settings?.enableIpTableInDev) {
      debugLog(
        `[IpTableAdapter] Dev environment - IP Table ${
          enabledInDev ? 'enabled' : 'disabled'
        }`,
      );
      return enabledInDev;
    }

    const disabledInProd = !!devSettings.settings?.disableIpTableInProd;
    if (disabledInProd) {
      debugLog(
        `[IpTableAdapter] Prod environment - IP Table ${
          disabledInProd ? 'disabled' : 'enabled'
        }`,
      );
      return !disabledInProd;
    }

    return false;
  } catch (error) {
    debugWarn('[IpTableAdapter] Failed to check IP Table permission:', error);
    return defaultEnabled;
  }
}

/**
 * Get selected IP for a given hostname from IP Table configuration
 * Uses dynamic configuration from requestHelper
 * @returns IP address if found and enabled, null otherwise
 */
async function getSelectedIpForHost(hostname: string): Promise<string | null> {
  try {
    // Check environment-based permission first
    const hasPermission = await shouldUseIpTable();
    if (!hasPermission) {
      debugLog('[IpTableAdapter] IP Table disabled by dev settings');
      return null;
    }

    const config = await requestHelper.getIpTableConfig();

    // Check global enable flag
    if (!config || !config.enabled) {
      return null;
    }

    const rootDomain = extractRootDomain(hostname);
    const hostConfig = config.hosts[rootDomain];

    // Check if host configuration exists
    if (!hostConfig) {
      return null;
    }

    // Return currently selected IP for this host
    return config.currentSelections[rootDomain] || null;
  } catch (error) {
    debugWarn('[IpTableAdapter] Failed to get IP table config:', error);
    return null;
  }
}

/**
 * Convert AxiosHeaders to plain object
 */
function axiosHeadersToPlainObject(
  headers: AxiosHeaders | Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof AxiosHeaders) {
    const plainHeaders: Record<string, string> = {};
    // Check if forEach method exists before calling it
    if (typeof headers.forEach === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      headers.forEach((value: any, key: string) => {
        if (typeof value === 'string') {
          plainHeaders[key] = value;
        } else if (value !== undefined) {
          plainHeaders[key] = String(value);
        }
      });
    } else {
      // Fallback: iterate over headers as object
      Object.keys(headers).forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const value = (headers as any)[key];
        if (typeof value === 'string') {
          plainHeaders[key] = value;
        } else if (value !== undefined && value !== null) {
          plainHeaders[key] = String(value);
        }
      });
    }
    return plainHeaders;
  }

  // If it's a plain object, return it directly
  if (typeof headers === 'object') {
    return headers;
  }

  return {};
}

/**
 * IP Table Axios Adapter
 * Intercepts axios requests and performs direct IP connection with SNI when applicable
 * Falls back to default axios request if IP direct connection is not available or fails
 */
export function createIpTableAdapter(
  _fallbackConfig: AxiosRequestConfig,
): AxiosAdapter {
  // Get the original axios default adapters BEFORE any modification
  // This ensures we capture the platform's native adapters (xhr/http/fetch)
  const originalDefaultAdapters = axios.defaults.adapter;

  debugLog(
    '[IpTableAdapter] Captured original default adapters:',
    originalDefaultAdapters,
  );

  // Helper function to call original adapter and avoid infinite loop
  const callOriginalAdapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    debugLog('[IpTableAdapter] About to call original adapter...');
    debugLog(
      '[IpTableAdapter] Original adapter type:',
      typeof originalDefaultAdapters,
    );

    // If originalDefaultAdapters is a function, call it directly
    if (typeof originalDefaultAdapters === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
      return originalDefaultAdapters(config);
    }

    // If originalDefaultAdapters is an array (axios 1.x style like ["xhr", "http", "fetch"]),
    // we need to use axios internal adapter resolution
    if (Array.isArray(originalDefaultAdapters)) {
      debugLog(
        '[IpTableAdapter] Original adapter is array, using axios.getAdapter()',
      );

      // Try to use axios.getAdapter() to resolve the adapter array
      if (typeof axios.getAdapter === 'function') {
        const resolvedAdapter = axios.getAdapter(originalDefaultAdapters);
        if (typeof resolvedAdapter === 'function') {
          debugLog('[IpTableAdapter] Successfully resolved adapter function');
          return resolvedAdapter(config);
        }
      }

      // Fallback: Create a new axios instance with the original adapter array
      // This is safe because we're explicitly passing the original adapters
      debugLog(
        '[IpTableAdapter] axios.getAdapter not available, creating temp instance',
      );
      const tempAxios = axios.create({
        adapter: originalDefaultAdapters,
      });

      return tempAxios.request(config);
    }

    // Last resort: throw error to let caller handle it
    debugError(
      '[IpTableAdapter] Unable to resolve adapter, type:',
      typeof originalDefaultAdapters,
    );
    throw new OneKeyLocalError(
      'IP Table Adapter: Unable to perform fallback request on this platform',
    );
  };

  return async (config: InternalAxiosRequestConfig) => {
    const sniSupported = isSniSupported();
    // Check if SNI is supported on current platform
    if (!sniSupported) {
      debugLog(
        '[IpTableAdapter] SNI not supported, using fallback for:',
        config.url,
      );

      try {
        return await callOriginalAdapter(config);
      } catch (fallbackError) {
        debugError('[IpTableAdapter] Fallback request failed:', fallbackError);
        throw fallbackError;
      }
    }

    // Parse URL to extract hostname
    const url = config.url || '';
    let hostname: string | null = null;

    try {
      // Handle full URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      }
      // Handle relative URL with baseURL
      else if (config.baseURL) {
        const baseUrlObj = new URL(config.baseURL);
        hostname = baseUrlObj.hostname;
      }
    } catch (error) {
      // If URL parsing fails, use original adapter
      debugLog('[IpTableAdapter] URL parsing failed, using fallback');
      return callOriginalAdapter(config);
    }

    // If no hostname extracted, use original adapter
    if (!hostname) {
      debugLog('[IpTableAdapter] No hostname extracted, using fallback');
      return callOriginalAdapter(config);
    }

    // Get selected IP for this hostname (async call)
    const selectedIp = await getSelectedIpForHost(hostname);

    // If no IP mapping found, use original adapter
    if (!selectedIp) {
      debugLog(
        `[IpTableAdapter] No IP mapping found for hostname: ${hostname}`,
      );
      return callOriginalAdapter(config);
    }

    debugLog(
      `[IpTableAdapter] Using IP direct connection: ${hostname} -> ${selectedIp}`,
    );

    // Construct full path for SNI request
    let fullPath = url;
    if (config.baseURL && !url.startsWith('http')) {
      // Combine baseURL and relative path
      const baseUrlObj = new URL(config.baseURL);
      const basePath = baseUrlObj.pathname.endsWith('/')
        ? baseUrlObj.pathname.slice(0, -1)
        : baseUrlObj.pathname;
      const relativePath = url.startsWith('/') ? url : `/${url}`;
      fullPath = basePath + relativePath;

      // Append query string if exists
      if (config.params) {
        // Filter out undefined and null values to match axios default behavior
        const filteredParams: Record<string, string> = {};
        Object.entries(config.params as Record<string, any>).forEach(
          ([key, value]) => {
            if (value !== undefined && value !== null) {
              filteredParams[key] = String(value);
            }
          },
        );

        const searchParams = new URLSearchParams(filteredParams);
        const queryString = searchParams.toString();
        if (queryString) {
          fullPath += `?${queryString}`;
        }
      }
    } else if (url.startsWith('http')) {
      // Extract path from full URL
      const urlObj = new URL(url);
      fullPath = urlObj.pathname + urlObj.search;
    }

    // Prepare request body
    let requestBody: string | null = null;
    if (config.data) {
      if (typeof config.data === 'string') {
        requestBody = config.data;
      } else {
        try {
          requestBody = JSON.stringify(config.data);
        } catch (stringifyError) {
          console.warn(
            '[IpTableAdapter] Failed to stringify request data:',
            stringifyError,
          );
          requestBody = String(config.data);
        }
      }
    }

    const requestHeaders = axiosHeadersToPlainObject(config.headers);

    // Ensure Content-Type is set for POST/PUT requests with body
    if (
      requestBody &&
      ['POST', 'PUT', 'PATCH'].includes(
        (config.method || 'GET').toUpperCase(),
      ) &&
      !requestHeaders['content-type'] &&
      !requestHeaders['Content-Type']
    ) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    debugLog(
      `[IpTableAdapter] Request details - URL: ${url}, BaseURL: ${
        config.baseURL || 'N/A'
      }, FullPath: ${fullPath}, Method: ${config.method || 'GET'}`,
    );
    debugLog('[IpTableAdapter] Request headers:', requestHeaders);
    debugLog(
      '[IpTableAdapter] Request body:',
      requestBody ? requestBody.substring(0, 200) : 'null',
    );

    try {
      const sniResponse = await sniRequest({
        ip: selectedIp,
        hostname,
        path: fullPath,
        headers: requestHeaders,
        method: (config.method || 'GET').toUpperCase(),
        body: requestBody,
        timeout: config.timeout || 60_000,
        port: 443, // HTTPS port
      });

      // If SNI request fails, use original adapter
      if (!sniResponse) {
        debugLog('[IpTableAdapter] SNI request returned null, using fallback');
        return await callOriginalAdapter(config);
      }

      // Convert SNI response to Axios response format
      debugLog(
        `[IpTableAdapter] SNI request successful: ${sniResponse.statusCode}`,
      );

      // Parse response body
      let responseData: any = null;
      if (sniResponse.body) {
        try {
          // Check if body is already an object or a string
          if (typeof sniResponse.body === 'string') {
            responseData = JSON.parse(sniResponse.body);
          } else {
            responseData = sniResponse.body;
          }
        } catch (parseError) {
          debugWarn(
            '[IpTableAdapter] Failed to parse response body:',
            parseError,
          );
          responseData = sniResponse.body;
        }
      }

      debugLog('[IpTableAdapter] Response data:', responseData);

      return {
        data: responseData,
        status: sniResponse.statusCode,
        statusText: '', // SNI response doesn't provide statusText
        headers: sniResponse.headers,
        config,
        request: {},
      };
    } catch (error) {
      // If SNI request throws error, use original adapter
      debugWarn(
        '[IpTableAdapter] SNI request failed, falling back to original adapter:',
        error,
      );
      return callOriginalAdapter(config);
    }
  };
}

/**
 * Create axios instance with IP Table adapter
 */
export function createAxiosWithIpTable(axiosConfig: AxiosRequestConfig = {}) {
  const ipTableAdapter = createIpTableAdapter(axiosConfig);

  return axios.create({
    ...axiosConfig,
    adapter: ipTableAdapter,
  });
}
