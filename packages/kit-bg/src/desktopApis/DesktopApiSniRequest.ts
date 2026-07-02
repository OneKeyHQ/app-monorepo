import https from 'https';

import { session } from 'electron';
import logger from 'electron-log/main';
import ipaddr from 'ipaddr.js';

import { isSniFailClosedError } from '@onekeyhq/shared/src/request/helpers/sniFailClosedError';
import { safeSniLogValue } from '@onekeyhq/shared/src/request/helpers/sniLogRedaction';
import type {
  ISniRequestConfig,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { ClientRequest } from 'http';
import type { RequestOptions } from 'https';

const MAX_REQUEST_ID_BYTES = 128;
const MAX_TIMEOUT_MS = 120_000;
const MAX_PATH_BYTES = 8 * 1024;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const MAX_RESPONSE_BODY_BYTES = 10 * 1024 * 1024;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_NAME_BYTES = 128;
const MAX_HEADER_VALUE_BYTES = 8 * 1024;
const MAX_TOTAL_HEADER_BYTES = 32 * 1024;
const MAX_TOTAL_SOCKETS = 64;
const MAX_SOCKETS_PER_PAIR = 16;
const MAX_FREE_SOCKETS = 32;
const MAX_ACTIVE_REQUESTS = 64;
const MAX_ACTIVE_REQUESTS_PER_PAIR = 16;

const ALLOWED_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

const MODULE_OWNED_HEADERS = new Set([
  'host',
  'content-length',
  'accept-encoding',
  'x-emascurl-config-id',
]);

const UNSAFE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'expect',
]);

const HOSTNAME_RE =
  /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const HEADER_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

type NormalizedSniRequestConfig = Omit<
  ISniRequestConfig,
  'body' | 'headers' | 'method' | 'path'
> & {
  body: string | null;
  headers: Record<string, string>;
  method: string;
  path: string;
};

type SniAgentState = {
  agent: https.Agent;
  activeRequests: Set<ClientRequest>;
  destroyed: boolean;
};

export class SniRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public failClosed = false,
  ) {
    super(`${code}: ${message}`);
    this.name = 'SniRequestError';
  }
}

export { isSniFailClosedError };

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function shortHashForLog(value: string | undefined | null): string {
  if (!value) return 'none';
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function formatNativeLogEvent(
  event: string,
  fields: Record<string, unknown>,
): string {
  return Object.entries({ event, ...fields })
    .map(([key, value]) => `${key}=${safeSniLogValue(value)}`)
    .join(' ');
}

function writeNativeLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown>,
): void {
  const message = `[DesktopApiSniRequest] ${formatNativeLogEvent(
    event,
    fields,
  )}`;
  if (level === 'error') {
    logger.error(message);
  } else if (level === 'warn') {
    logger.warn(message);
  } else {
    logger.info(message);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getIpFamily(ip: string): string {
  return ip.includes(':') ? 'ipv6' : 'ipv4';
}

function getProxyRuleType(
  proxyRules: string,
): 'direct' | 'proxy' | 'mixed' | 'unknown' {
  const rules = proxyRules
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => rule.toUpperCase());
  if (rules.length === 0) return 'unknown';
  const directCount = rules.filter((rule) => rule === 'DIRECT').length;
  if (directCount === rules.length) return 'direct';
  if (directCount === 0) return 'proxy';
  return 'mixed';
}

function getHostnameForLog(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function invalidConfig(message: string): never {
  throw new SniRequestError('SNI_INVALID_CONFIG', message, true);
}

export function classifyTransportError(error: Error): Error {
  if (error instanceof SniRequestError) {
    return error;
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = `${code} ${error.message}`;
  if (
    /CERT|certificate|altname|hostname|self[- ]?signed|unable to verify|expired/i.test(
      message,
    )
  ) {
    return new SniRequestError('SNI_CERT_FAILED', error.message, true);
  }
  if (/TLS|SSL|handshake|EPROTO/i.test(message)) {
    return new SniRequestError('SNI_TLS_FAILED', error.message, true);
  }
  return error;
}

function byteSize(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function normalizeMethod(method: string): string {
  if (hasControlChar(method)) {
    invalidConfig(`Invalid method: ${method}`);
  }
  const normalized = method.trim().toUpperCase();
  if (!ALLOWED_METHODS.has(normalized)) {
    invalidConfig(`Invalid method: ${method}`);
  }
  return normalized;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (byteSize(trimmed) > MAX_PATH_BYTES) {
    invalidConfig('Path too large');
  }
  if (
    hasControlChar(trimmed) ||
    trimmed.startsWith('//') ||
    trimmed.includes('://') ||
    SCHEME_RE.test(trimmed.split('/')[0] ?? '')
  ) {
    invalidConfig('Invalid path');
  }
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function validateHostname(hostname: string): void {
  if (!HOSTNAME_RE.test(hostname) || ipaddr.isValid(hostname)) {
    invalidConfig(`Invalid hostname: ${hostname}`);
  }
}

function validateRequestId(requestId: string | undefined): void {
  if (requestId === undefined) return;
  if (
    !requestId ||
    hasControlChar(requestId) ||
    byteSize(requestId) > MAX_REQUEST_ID_BYTES
  ) {
    invalidConfig('Invalid requestId');
  }
}

function validateTimeout(timeout: number): void {
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
    invalidConfig(`Invalid timeout: ${timeout}`);
  }
}

function validateBody(body: string | null): void {
  if (body !== null && byteSize(body) > MAX_REQUEST_BODY_BYTES) {
    invalidConfig('Request body too large');
  }
}

function ipv6Bytes(address: ipaddr.IPv6): number[] {
  return address.parts.flatMap((part) => [(part >> 8) & 0xff, part & 0xff]);
}

function ipv4Octets(address: ipaddr.IPv4): number[] {
  return address.octets;
}

function isForbiddenIpv4(octets: number[]): boolean {
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && (b & 0xc0) === 0x40) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function embeddedIpv4(bytes: number[], offset: number): number[] {
  return [
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  ];
}

function isForbiddenIpv6(address: ipaddr.IPv6): boolean {
  if (address.isIPv4MappedAddress()) {
    return isForbiddenIpv4(ipv4Octets(address.toIPv4Address()));
  }

  const bytes = ipv6Bytes(address);
  const range = address.range();
  if (
    range !== 'unicast' ||
    (bytes[0] & 0xfe) === 0xfc ||
    (bytes[0] === 0x01 &&
      bytes[1] === 0x00 &&
      bytes.slice(2, 8).every((b) => b === 0)) ||
    (bytes[0] === 0x20 && bytes[1] === 0x02) ||
    bytes.slice(0, 12).every((b) => b === 0)
  ) {
    return true;
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x01) {
    if (bytes[2] === 0x00 && bytes[3] === 0x00) return true;
    if (bytes[2] === 0x00 && (bytes[3] & 0xf0) === 0x10) return true;
    if (bytes[2] === 0x00 && bytes[3] === 0x02) return true;
    if (bytes[2] === 0x0d && bytes[3] === 0xb8) return true;
  }
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b
  ) {
    if (bytes[4] === 0x00 && bytes[5] === 0x01) {
      return true;
    }
    if (bytes.slice(4, 12).every((b) => b === 0)) {
      return isForbiddenIpv4(embeddedIpv4(bytes, 12));
    }
  }
  return false;
}

function validatePublicIp(ip: string): void {
  if (
    !ip ||
    ip.trim() !== ip ||
    ip.includes('[') ||
    ip.includes(']') ||
    ip.includes('%')
  ) {
    invalidConfig(`Invalid IP: ${ip}`);
  }

  let address: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    address = ipaddr.parse(ip);
  } catch {
    invalidConfig(`Invalid IP: ${ip}`);
  }

  if (address.kind() === 'ipv4') {
    if (isForbiddenIpv4(ipv4Octets(address as ipaddr.IPv4))) {
      invalidConfig(`Forbidden IP: ${ip}`);
    }
    return;
  }

  if (isForbiddenIpv6(address as ipaddr.IPv6)) {
    invalidConfig(`Forbidden IP: ${ip}`);
  }
}

function normalizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(headers ?? {});
  if (entries.length > MAX_HEADER_COUNT) {
    invalidConfig('Too many headers');
  }

  let totalBytes = 0;
  const normalizedHeaders: Record<string, string> = {};
  for (const [name, rawValue] of entries) {
    const value = String(rawValue ?? '');
    const nameBytes = byteSize(name);
    const valueBytes = byteSize(value);
    totalBytes += nameBytes + valueBytes;

    if (
      !name ||
      hasControlChar(name) ||
      hasControlChar(value) ||
      nameBytes > MAX_HEADER_NAME_BYTES ||
      valueBytes > MAX_HEADER_VALUE_BYTES ||
      !HEADER_TOKEN_RE.test(name)
    ) {
      invalidConfig(`Invalid header: ${name}`);
    }

    const lowerName = name.toLowerCase();
    if (
      lowerName.startsWith(':') ||
      lowerName.startsWith('proxy-') ||
      UNSAFE_HEADERS.has(lowerName)
    ) {
      invalidConfig(`Unsafe header: ${name}`);
    }
    if (!MODULE_OWNED_HEADERS.has(lowerName)) {
      normalizedHeaders[name] = value;
    }
  }

  if (totalBytes > MAX_TOTAL_HEADER_BYTES) {
    invalidConfig('Headers too large');
  }
  return normalizedHeaders;
}

export function validateSniRequestConfig(
  config: ISniRequestConfig,
): NormalizedSniRequestConfig {
  validateRequestId(config.requestId);
  validatePublicIp(config.ip);
  validateHostname(config.hostname);
  validateTimeout(config.timeout);
  const body = config.body ?? null;
  validateBody(body);

  if (config.port !== null && config.port !== undefined) {
    invalidConfig('Caller-controlled ports are not allowed');
  }

  return {
    ...config,
    body,
    headers: normalizeHeaders(config.headers ?? {}),
    method: normalizeMethod(config.method ?? 'GET'),
    path: normalizePath(config.path ?? '/'),
    timeout: Math.trunc(config.timeout),
  };
}

function createCustomAgent(): https.Agent {
  const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: MAX_SOCKETS_PER_PAIR,
    maxTotalSockets: MAX_TOTAL_SOCKETS,
    maxFreeSockets: MAX_FREE_SOCKETS,
    timeout: MAX_TIMEOUT_MS,
    scheduling: 'lifo',
  });

  (
    agent as https.Agent & {
      getName(options: RequestOptions): string;
    }
  ).getName = (options: RequestOptions): string => {
    const ip = options.host || '';
    const hostname = options.servername || '';
    const port = options.port || 443;
    return `${hostname}:${ip}:${port}`;
  };
  return agent;
}

function createAgentState(): SniAgentState {
  return {
    agent: createCustomAgent(),
    activeRequests: new Set<ClientRequest>(),
    destroyed: false,
  };
}

export function isProxyRouteActive(proxyRules: string): boolean {
  return proxyRules
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .some((rule) => rule.toUpperCase() !== 'DIRECT');
}

export function buildSniRequestOptions(
  config: NormalizedSniRequestConfig,
  agent: https.Agent,
): RequestOptions {
  const headers: Record<string, string> = {
    ...config.headers,
    Host: config.hostname,
    'Accept-Encoding': 'identity',
  };
  if (config.body !== null) {
    headers['Content-Length'] = String(Buffer.byteLength(config.body, 'utf8'));
  }

  return {
    method: config.method,
    host: config.ip,
    port: 443,
    path: config.path,
    servername: config.hostname,
    headers,
    agent,
    rejectUnauthorized: true,
  };
}

export function headersToMaps(rawHeaders: string[]): {
  headers: Record<string, string>;
  multiValueHeaders: Record<string, string[]>;
} {
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = String(rawHeaders[index] ?? '').toLowerCase();
    const value = String(rawHeaders[index + 1] ?? '');
    if (name) {
      headers[name] = value;
      multiValueHeaders[name] = [...(multiValueHeaders[name] ?? []), value];
    }
  }
  return { headers, multiValueHeaders };
}

// eslint-disable-next-line max-classes-per-file
export class SniRequestLimiter {
  constructor(
    private maxActiveRequests = MAX_ACTIVE_REQUESTS,
    private maxActiveRequestsPerPair = MAX_ACTIVE_REQUESTS_PER_PAIR,
  ) {}

  private activeRequests = 0;

  private activeRequestsByPair = new Map<string, number>();

  snapshot(
    hostname?: string,
    ip?: string,
  ): {
    activeRequests: number;
    activeRequestsForPair: number;
  } {
    const key = hostname && ip ? `${hostname.toLowerCase()}|${ip}` : undefined;
    return {
      activeRequests: this.activeRequests,
      activeRequestsForPair: key
        ? (this.activeRequestsByPair.get(key) ?? 0)
        : 0,
    };
  }

  acquire(hostname: string, ip: string): () => void {
    const key = `${hostname.toLowerCase()}|${ip}`;
    if (this.activeRequests >= this.maxActiveRequests) {
      writeNativeLog('warn', 'desktop_sni_resource_limit', {
        hostname: hostname.toLowerCase(),
        ipHash: shortHashForLog(ip),
        ipFamily: getIpFamily(ip),
        activeRequests: this.activeRequests,
        activeRequestsForPair: this.activeRequestsByPair.get(key) ?? 0,
        limit: this.maxActiveRequests,
        reason: 'max_active_requests',
      });
      throw new SniRequestError(
        'SNI_RESOURCE_LIMIT',
        'Too many active SNI requests',
        true,
      );
    }
    const pairCount = this.activeRequestsByPair.get(key) ?? 0;
    if (pairCount >= this.maxActiveRequestsPerPair) {
      writeNativeLog('warn', 'desktop_sni_resource_limit', {
        hostname: hostname.toLowerCase(),
        ipHash: shortHashForLog(ip),
        ipFamily: getIpFamily(ip),
        activeRequests: this.activeRequests,
        activeRequestsForPair: pairCount,
        limit: this.maxActiveRequestsPerPair,
        reason: 'max_active_requests_per_pair',
      });
      throw new SniRequestError(
        'SNI_RESOURCE_LIMIT',
        'Too many active SNI requests for destination',
        true,
      );
    }

    this.activeRequests += 1;
    this.activeRequestsByPair.set(key, pairCount + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      const nextPairCount = this.activeRequestsByPair.get(key) ?? 0;
      if (nextPairCount <= 1) {
        this.activeRequestsByPair.delete(key);
      } else {
        this.activeRequestsByPair.set(key, nextPairCount - 1);
      }
    };
  }
}

class DesktopApiSniRequest {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.agentState = createAgentState();
  }

  desktopApi: IDesktopApi;

  private agentState: SniAgentState;

  private activeRequests = new Map<string, ClientRequest>();

  private allActiveRequests = new Set<ClientRequest>();

  private requestAgentStates = new Map<ClientRequest, SniAgentState>();

  private requestLimiter = new SniRequestLimiter();

  private maybeDestroyIdleAgentState(agentState: SniAgentState): void {
    if (
      agentState !== this.agentState &&
      agentState.activeRequests.size === 0 &&
      !agentState.destroyed
    ) {
      agentState.destroyed = true;
      agentState.agent.destroy();
    }
  }

  private removeActiveRequest(
    requestId: string | undefined,
    request: ClientRequest | undefined,
    agentState: SniAgentState | undefined,
  ): void {
    let cleanupAgentState = agentState;
    if (
      requestId &&
      request &&
      this.activeRequests.get(requestId) === request
    ) {
      this.activeRequests.delete(requestId);
    }
    if (request) {
      const state = agentState ?? this.requestAgentStates.get(request);
      this.allActiveRequests.delete(request);
      state?.activeRequests.delete(request);
      this.requestAgentStates.delete(request);
      cleanupAgentState = state;
    }
    if (cleanupAgentState) {
      this.maybeDestroyIdleAgentState(cleanupAgentState);
    }
  }

  async isProxyActiveForUrl(url: string): Promise<boolean> {
    const startedAt = Date.now();
    const hostname = getHostnameForLog(url);
    try {
      const proxyRules = await session.defaultSession.resolveProxy(url);
      const proxyActive = isProxyRouteActive(proxyRules);
      writeNativeLog('info', 'desktop_sni_proxy_preflight', {
        hostname,
        proxyActive,
        proxyRuleType: getProxyRuleType(proxyRules),
        durationMs: Date.now() - startedAt,
      });
      return proxyActive;
    } catch (error) {
      writeNativeLog('error', 'desktop_sni_proxy_preflight', {
        hostname,
        proxyActive: 'unknown',
        proxyRuleType: 'unknown',
        durationMs: Date.now() - startedAt,
        errorCode: getErrorCode(error) ?? 'none',
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }
  }

  async request(config: ISniRequestConfig): Promise<ISniResponse> {
    const startedAt = Date.now();
    let normalizedConfig: NormalizedSniRequestConfig;
    try {
      normalizedConfig = validateSniRequestConfig(config);
    } catch (error) {
      writeNativeLog('error', 'desktop_sni_request_failed', {
        code: getErrorCode(error) ?? 'SNI_INVALID_CONFIG',
        failClosed: isSniFailClosedError(error),
        hostname: config.hostname ?? 'unknown',
        ipHash: shortHashForLog(config.ip),
        ipFamily: config.ip ? getIpFamily(config.ip) : 'unknown',
        method: config.method ?? 'GET',
        timeout: config.timeout ?? 'unknown',
        pathBytes: config.path ? byteSize(config.path) : 0,
        bodyBytes: config.body ? byteSize(config.body) : 0,
        headerCount: Object.keys(config.headers ?? {}).length,
        activeRequests: this.requestLimiter.snapshot().activeRequests,
        activeRequestsForPair: 0,
        durationMs: Date.now() - startedAt,
        errorMessage: getErrorMessage(error),
      });
      return Promise.reject(error);
    }
    let releaseRequestSlot: (() => void) | undefined;
    try {
      releaseRequestSlot = this.requestLimiter.acquire(
        normalizedConfig.hostname,
        normalizedConfig.ip,
      );
    } catch (error) {
      const stats = this.requestLimiter.snapshot(
        normalizedConfig.hostname,
        normalizedConfig.ip,
      );
      writeNativeLog('error', 'desktop_sni_request_failed', {
        code: getErrorCode(error) ?? 'SNI_RESOURCE_LIMIT',
        failClosed: isSniFailClosedError(error),
        hostname: normalizedConfig.hostname,
        ipHash: shortHashForLog(normalizedConfig.ip),
        ipFamily: getIpFamily(normalizedConfig.ip),
        method: normalizedConfig.method,
        timeout: normalizedConfig.timeout,
        pathBytes: byteSize(normalizedConfig.path),
        bodyBytes: normalizedConfig.body ? byteSize(normalizedConfig.body) : 0,
        headerCount: Object.keys(normalizedConfig.headers).length,
        activeRequests: stats.activeRequests,
        activeRequestsForPair: stats.activeRequestsForPair,
        durationMs: Date.now() - startedAt,
        errorMessage: getErrorMessage(error),
      });
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let activeRequest: ClientRequest | undefined;
      let activeAgentState: SniAgentState | undefined;
      const releaseSlot = () => {
        releaseRequestSlot?.();
        releaseRequestSlot = undefined;
      };

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        releaseSlot();
        if (timeoutId) clearTimeout(timeoutId);
        this.removeActiveRequest(
          normalizedConfig.requestId,
          activeRequest,
          activeAgentState,
        );
        const stats = this.requestLimiter.snapshot(
          normalizedConfig.hostname,
          normalizedConfig.ip,
        );
        writeNativeLog('error', 'desktop_sni_request_failed', {
          code: getErrorCode(error) ?? 'SNI_REQUEST_FAILED',
          failClosed: isSniFailClosedError(error),
          hostname: normalizedConfig.hostname,
          ipHash: shortHashForLog(normalizedConfig.ip),
          ipFamily: getIpFamily(normalizedConfig.ip),
          method: normalizedConfig.method,
          timeout: normalizedConfig.timeout,
          pathBytes: byteSize(normalizedConfig.path),
          bodyBytes: normalizedConfig.body
            ? byteSize(normalizedConfig.body)
            : 0,
          headerCount: Object.keys(normalizedConfig.headers).length,
          activeRequests: stats.activeRequests,
          activeRequestsForPair: stats.activeRequestsForPair,
          durationMs: Date.now() - startedAt,
          errorMessage: error.message,
        });
        reject(error);
      };

      const settleResolve = (response: ISniResponse) => {
        if (settled) return;
        settled = true;
        releaseSlot();
        if (timeoutId) clearTimeout(timeoutId);
        this.removeActiveRequest(
          normalizedConfig.requestId,
          activeRequest,
          activeAgentState,
        );
        writeNativeLog('info', 'desktop_sni_request_result', {
          result: 'response',
          status: response.statusCode,
          hostname: normalizedConfig.hostname,
          ipHash: shortHashForLog(normalizedConfig.ip),
          ipFamily: getIpFamily(normalizedConfig.ip),
          method: normalizedConfig.method,
          timeout: normalizedConfig.timeout,
          responseBytes: response.body ? byteSize(response.body) : 0,
          durationMs: Date.now() - startedAt,
        });
        resolve(response);
      };

      try {
        activeAgentState = this.agentState;
        const requestOptions = buildSniRequestOptions(
          normalizedConfig,
          activeAgentState.agent,
        );

        const request = https.request(requestOptions, (response) => {
          const encoding = response.headers['content-encoding'];
          if (encoding && encoding !== 'identity') {
            response.resume();
            settleReject(
              new SniRequestError(
                'SNI_RESPONSE_FAILED',
                `Unsupported content encoding: ${String(encoding)}`,
                true,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on('data', (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk, 'utf8');
            totalBytes += buffer.length;
            if (totalBytes > MAX_RESPONSE_BODY_BYTES) {
              request.destroy(
                new SniRequestError(
                  'SNI_RESPONSE_FAILED',
                  'Response body too large',
                  true,
                ),
              );
              return;
            }
            chunks.push(buffer);
          });

          response.on('end', () => {
            const headerMaps = headersToMaps(response.rawHeaders ?? []);
            const body = Buffer.concat(chunks).toString('utf8');
            const statusCode = response.statusCode || 0;
            settleResolve({
              statusCode,
              status: statusCode,
              statusText: response.statusMessage || '',
              headers: headerMaps.headers,
              multiValueHeaders: headerMaps.multiValueHeaders,
              body,
              data: body,
            });
          });

          response.on('error', (error: Error) => {
            settleReject(
              error instanceof SniRequestError
                ? error
                : new SniRequestError(
                    'SNI_RESPONSE_FAILED',
                    `Response stream error: ${error.message}`,
                    true,
                  ),
            );
          });
        });
        activeRequest = request;
        this.allActiveRequests.add(request);
        activeAgentState.activeRequests.add(request);
        this.requestAgentStates.set(request, activeAgentState);
        const stats = this.requestLimiter.snapshot(
          normalizedConfig.hostname,
          normalizedConfig.ip,
        );
        writeNativeLog('info', 'desktop_sni_request_start', {
          requestIdHash: shortHashForLog(normalizedConfig.requestId),
          hostname: normalizedConfig.hostname,
          ipHash: shortHashForLog(normalizedConfig.ip),
          ipFamily: getIpFamily(normalizedConfig.ip),
          method: normalizedConfig.method,
          timeout: normalizedConfig.timeout,
          pathBytes: byteSize(normalizedConfig.path),
          bodyBytes: normalizedConfig.body
            ? byteSize(normalizedConfig.body)
            : 0,
          headerCount: Object.keys(normalizedConfig.headers).length,
          activeRequests: stats.activeRequests,
          activeRequestsForPair: stats.activeRequestsForPair,
        });

        if (normalizedConfig.requestId) {
          const previous = this.activeRequests.get(normalizedConfig.requestId);
          if (previous) {
            writeNativeLog('warn', 'desktop_sni_lifecycle', {
              action: 'duplicate_request_id',
              requestIdHash: shortHashForLog(normalizedConfig.requestId),
              success: true,
              activeCount: this.allActiveRequests.size,
            });
            previous.destroy(
              new SniRequestError('SNI_CANCELLED', 'Request cancelled', true),
            );
          }
          this.activeRequests.set(normalizedConfig.requestId, request);
        }

        request.on('error', (error: Error) => {
          settleReject(classifyTransportError(error));
        });

        timeoutId = setTimeout(() => {
          request.destroy(
            new SniRequestError(
              'SNI_TIMEOUT',
              `SNI request timeout after ${normalizedConfig.timeout}ms`,
            ),
          );
        }, normalizedConfig.timeout);

        if (normalizedConfig.body) {
          request.write(normalizedConfig.body);
        }

        request.end();
      } catch (error) {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async cancelRequest(requestId: string): Promise<{ success: boolean }> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      writeNativeLog('warn', 'desktop_sni_lifecycle', {
        action: 'cancel_request',
        requestIdHash: shortHashForLog(requestId),
        success: false,
        activeCount: this.allActiveRequests.size,
      });
      return { success: false };
    }
    this.removeActiveRequest(requestId, request, undefined);
    request.destroy(
      new SniRequestError('SNI_CANCELLED', 'Request cancelled', true),
    );
    writeNativeLog('info', 'desktop_sni_lifecycle', {
      action: 'cancel_request',
      requestIdHash: shortHashForLog(requestId),
      success: true,
      activeCount: this.allActiveRequests.size,
    });
    return { success: true };
  }

  async cancelAllRequests(): Promise<{ success: boolean }> {
    const requests = Array.from(this.allActiveRequests.values());
    this.activeRequests.clear();
    this.allActiveRequests.clear();
    for (const request of requests) {
      request.destroy(
        new SniRequestError('SNI_CANCELLED', 'Request cancelled', true),
      );
    }
    writeNativeLog('info', 'desktop_sni_lifecycle', {
      action: 'cancel_all_requests',
      success: true,
      activeCount: requests.length,
    });
    return { success: true };
  }

  async clearDNSCache(): Promise<{ success: boolean }> {
    const previousAgentState = this.agentState;
    this.agentState = createAgentState();
    if (
      previousAgentState.activeRequests.size === 0 &&
      !previousAgentState.destroyed
    ) {
      previousAgentState.destroyed = true;
      previousAgentState.agent.destroy();
    }
    writeNativeLog('info', 'desktop_sni_lifecycle', {
      action: 'clear_dns_cache',
      success: true,
      activeCount: previousAgentState.activeRequests.size,
    });
    return { success: true };
  }

  async isSupported(): Promise<boolean> {
    return true;
  }
}

export default DesktopApiSniRequest;
