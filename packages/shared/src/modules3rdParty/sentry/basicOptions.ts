import wordLists from 'bip39/src/wordlists/english.json';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { EOneKeyErrorClassNames } from '../../errors/types/errorTypes';

import type { BrowserOptions, Stacktrace } from '@sentry/browser';

export { navigationIntegration } from './navigationIntegration';

// cspell:ignore Sanitizable

// Check for common private key formats
const PRIVATE_KEY_PATTERNS = [
  /^0x[a-fA-F0-9]{64}$/, // Ethereum private key (hex with 0x prefix)
  /^[a-fA-F0-9]{64}$/, // Raw 32-byte hex private key
  /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/, // Bitcoin WIF format
  /^[a-fA-F0-9]{128}$/, // 64-byte extended key hex
];

const checkPrivateKey = (text: string): boolean => {
  if (typeof text !== 'string' || text.length < 50) {
    return false;
  }
  return PRIVATE_KEY_PATTERNS.some((pattern) => pattern.test(text));
};

const lazyLoadWordSet = memoizee(() => new Set(wordLists));

// Minimum consecutive mnemonic words to trigger redaction (12-word mnemonic could partially leak)
const MIN_MNEMONIC_SEQUENCE_LENGTH = 3;

const redactMnemonicSequences = (text: string): string => {
  const wordSet = lazyLoadWordSet();
  const parts = text.split(/([\s,]+)/);
  let mnemonicPartIndexes: number[] = [];
  const flushMnemonicSequence = () => {
    if (mnemonicPartIndexes.length >= MIN_MNEMONIC_SEQUENCE_LENGTH) {
      for (const index of mnemonicPartIndexes) {
        parts[index] = parts[index].replace(/[A-Za-z]+/, '****');
      }
    }
    mnemonicPartIndexes = [];
  };
  for (let index = 0; index <= parts.length; index += 1) {
    const part = parts[index];
    if (part && !/^[\s,]+$/.test(part)) {
      if (/^[A-Za-z]+$/.test(part) && wordSet.has(part.toLowerCase())) {
        mnemonicPartIndexes.push(index);
      } else {
        flushMnemonicSequence();
      }
    }
  }
  flushMnemonicSequence();
  return parts.join('');
};

const checkAndRedactMnemonicWords = (words: string[]): string[] => {
  if (!Array.isArray(words) || words.length === 0) {
    return words;
  }
  return redactMnemonicSequences(words.join(' ')).split(' ');
};

// Maximum word length before redacting (long strings may contain sensitive data)
const MAX_WORD_LENGTH = 20;

const SENSITIVE_INLINE_PATTERNS: [RegExp, string][] = [
  [/(\bbearer\s+)[A-Za-z0-9._~+/-]+=*/giu, '$1****'],
  [
    /(["']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)["']?\s*[=:]\s*)[[{][\s\S]*/giu,
    '$1****',
  ],
  [
    /(["']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)["']?\s*[=:]\s*)"[^"]*"/giu,
    '$1"****"',
  ],
  [
    /(["']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)["']?\s*[=:]\s*)'[^']*'/giu,
    "$1'****'",
  ],
  [
    /(["']?(?:password|passwd|passphrase|secret|token|authorization|cookie|session(?:id)?|api[-_]?key|private[-_]?key|mnemonic|seed(?:[-_ ]?phrase)?|recovery(?:[-_ ]?phrase)?|credential)["']?\s*[=:]\s*)[^"'\s,;}]+/giu,
    '$1****',
  ],
  [/\b(?:https?|wss?):\/\/[^\s]+/giu, '****'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '****'],
  [/\b0x[0-9a-f]{40,64}\b/giu, '****'],
  [/\b[0-9a-f]{64}\b/giu, '****'],
  [/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/gu, '****'],
  [/\b[xyz](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\b/giu, '****'],
  [/\b(?:[a-z0-9]{1,20}1)[a-z0-9]{20,90}\b/giu, '****'],
  [/\b[1-9A-HJ-NP-Za-km-z]{32,128}\b/gu, '****'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '****'],
];

// Sanitize a single text string (check for private keys, long words, and mnemonics)
const sanitizeText = (text: string): string => {
  if (typeof text !== 'string' || !text) {
    return text;
  }
  let result = redactMnemonicSequences(text);
  for (const [pattern, replacement] of SENSITIVE_INLINE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  const words = result.split(' ');
  // Check for private keys and long words
  for (let i = 0; i < words.length; i += 1) {
    if (checkPrivateKey(words[i])) {
      words[i] = '****';
    } else if (words[i].length > MAX_WORD_LENGTH) {
      // Redact words longer than MAX_WORD_LENGTH (may contain sensitive data like tokens, keys, etc.)
      words[i] = '***';
    }
  }
  // Check for mnemonic sequences
  return words.join(' ');
};

export interface ISentrySanitizableStackFrame {
  vars?: Record<string, unknown>;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

export type ISentrySanitizableStacktrace = Stacktrace & {
  frames?: ISentrySanitizableStackFrame[];
};

export interface ISentrySanitizableEvent {
  exception?: {
    values?: {
      type?: string;
      value?: string;
      stacktrace?: ISentrySanitizableStacktrace;
    }[];
  };
  breadcrumbs?: {
    category?: string;
    level?: string;
    message?: string;
    data?: Record<string, unknown>;
  }[];
}

export const sanitizeNavigationBreadcrumbsForLocalLog = (
  breadcrumbs?: ISentrySanitizableEvent['breadcrumbs'],
) =>
  (breadcrumbs ?? [])
    .filter((breadcrumb) => breadcrumb.category === 'navigation')
    .slice(-20)
    .map((breadcrumb) => ({
      category: 'navigation',
      ...(breadcrumb.message
        ? { message: sanitizeText(breadcrumb.message) }
        : {}),
      ...(typeof breadcrumb.data?.from === 'string'
        ? { from: sanitizeText(breadcrumb.data.from) }
        : {}),
      ...(typeof breadcrumb.data?.to === 'string'
        ? { to: sanitizeText(breadcrumb.data.to) }
        : {}),
    }));

export type ISentrySanitizationErrorHandler = (
  errorMessage: string,
  stacktrace?: ISentrySanitizableStacktrace,
) => void;

// Sanitize stacktrace frames (local variables may contain sensitive data)
const sanitizeStacktrace = (
  stacktrace?: ISentrySanitizableStacktrace,
): void => {
  if (!stacktrace?.frames) {
    return;
  }
  for (const frame of stacktrace.frames) {
    // Sanitize local variables captured in stack frames
    if (frame.vars) {
      for (const key of Object.keys(frame.vars)) {
        const value = frame.vars[key];
        if (typeof value === 'string') {
          frame.vars[key] = sanitizeText(value);
        } else if (typeof value === 'object' && value !== null) {
          // For objects, convert to string and sanitize
          try {
            const jsonStr = JSON.stringify(value);
            const sanitized = sanitizeText(jsonStr);
            if (sanitized !== jsonStr) {
              frame.vars[key] = '[REDACTED]';
            }
          } catch {
            // Keep original if can't stringify
          }
        }
      }
    }
    // Sanitize context lines if present
    if (frame.context_line) {
      frame.context_line = sanitizeText(frame.context_line);
    }
    if (Array.isArray(frame.pre_context)) {
      frame.pre_context = frame.pre_context.map(sanitizeText);
    }
    if (Array.isArray(frame.post_context)) {
      frame.post_context = frame.post_context.map(sanitizeText);
    }
  }
};

export const SENTRY_IPC = 'sentry-ipc://';

export const buildSentryReleaseName = () =>
  `${process.env.VERSION ?? ''} (${process.env.BUILD_NUMBER ?? ''})`;

const FILTERED_ERROR_TYPES = new Set([
  'AxiosError',
  'HTTPClientError',
  EOneKeyErrorClassNames.OneKeyError,
  EOneKeyErrorClassNames.OneKeyLocalError,
  EOneKeyErrorClassNames.OneKeyHardwareError,
  EOneKeyErrorClassNames.OneKeyAppError,
  EOneKeyErrorClassNames.OneKeyServerApiError,
  EOneKeyErrorClassNames.OneKeyErrorNotImplemented,
  EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet,
  EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound,
  EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
  EOneKeyErrorClassNames.VaultKeyringNotDefinedError,
  EOneKeyErrorClassNames.PasswordPromptDialogCancel,
  EOneKeyErrorClassNames.PrimeLoginDialogCancelError,
  EOneKeyErrorClassNames.FirmwareUpdateExit,
  EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
]);

const FILTER_ERROR_VALUES = new Set([
  'AbortError: AbortError',
  'cancel timeout',
]);

const isFilterErrorAndSkipSentry = (error?: {
  type?: string | undefined;
  value?: string | undefined;
}) => {
  if (!error) {
    return false;
  }
  if (error.type && FILTERED_ERROR_TYPES.has(error.type)) {
    return true;
  }

  // Desktop-specific error filters (grouped to avoid redundant platform checks)
  if (platformEnv.isDesktop && error.value) {
    // Filter CustomElementRegistry error
    if (
      error.value.includes(
        `Failed to execute 'define' on 'CustomElementRegistry'`,
      )
    ) {
      return true;
    }
    // Filter Electron webview connection closed error (network interruption during webview loading)
    // Check shorter string first for better performance
    if (
      error.value.includes('ERR_CONNECTION_CLOSED') &&
      error.value.includes('GUEST_VIEW_MANAGER_CALL')
    ) {
      return true;
    }
  }

  if (
    error.type === 'Error' &&
    error.value &&
    FILTER_ERROR_VALUES.has(error.value)
  ) {
    return true;
  }

  return false;
};

export const sanitizeSentryEvent = <T extends ISentrySanitizableEvent>(
  event: T,
  onError: ISentrySanitizationErrorHandler,
): T | null => {
  if (Array.isArray(event.exception?.values)) {
    for (let index = 0; index < event.exception.values.length; index += 1) {
      const exceptionValue = event.exception.values[index];
      const { type: originalType, value: originalValue } = exceptionValue;
      try {
        sanitizeStacktrace(exceptionValue.stacktrace);
        // Sanitize error message
        if (exceptionValue.value) {
          const newErrorText = sanitizeText(exceptionValue.value);
          // Save error message locally
          onError(newErrorText, exceptionValue.stacktrace);
          exceptionValue.value = newErrorText;
        }
        // WebEmbed forwards exceptions to the host through onError; do not also
        // send them directly to Sentry from the embedded runtime.
        // TODO: Remove the WebEmbed Sentry runtime dependency. Replace it with
        // a small global error/unhandled rejection bridge that sanitizes and
        // forwards errors through postMessage, then remove the WebEmbed Sentry
        // entry and its vendor-transpilation allowlist.
        if (platformEnv.isWebEmbed) {
          return null;
        }
        // Sanitize stacktrace (local variables, context lines)
        if (
          isFilterErrorAndSkipSentry({
            type: originalType,
            value: originalValue,
          })
        ) {
          return null;
        }
      } catch {
        // Do nothing
      }
    }
  }
  // Filter out duplicate error messages
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.filter(
      (e) => e.category !== 'sentry.event' && e.level !== 'error',
    );
  }
  return event;
};

export const buildBasicOptions = ({
  onError,
}: {
  onError: ISentrySanitizationErrorHandler;
}) =>
  ({
    enabled: true,
    maxBreadcrumbs: 100,
    // Performance tracing/profiling disabled: in the long-lived renderer the
    // browser/idle-span tracing leaks unboundedly (heap snapshots show ~300K
    // retained SentryNonRecordingSpan pinning React fibers; renderer RSS climbs
    // ~240MB/h with no plateau). Error reporting + breadcrumbs are unaffected.
    // The tracing integrations are also removed from buildIntegrations below;
    // zeroing the sample rate alone does NOT stop span creation.
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    beforeSend: (event, _hint) => sanitizeSentryEvent(event, onError),
  }) satisfies BrowserOptions;

type ISentryTransportBuilder = Pick<
  typeof import('@sentry/react'),
  'makeBrowserOfflineTransport' | 'makeFetchTransport'
>;

type ISentryIntegrationsBuilder = Pick<
  typeof import('@sentry/react'),
  'breadcrumbsIntegration'
>;

export const buildSentryOptions = (Sentry: ISentryTransportBuilder) => ({
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
});

export const buildIntegrations = (Sentry: ISentryIntegrationsBuilder) => [
  // Performance-tracing integrations intentionally removed — they create a span
  // per navigation/interaction that leaks in the long-lived renderer (see the
  // tracesSampleRate note above). Only error reporting + breadcrumbs remain.
  Sentry.breadcrumbsIntegration({
    console: false,
    dom: true,
    fetch: true,
    history: true,
    xhr: true,
  }),
];

// Export for testing purposes (sanitization functions)
export const testUtils = {
  checkPrivateKey,
  checkAndRedactMnemonicWords,
  sanitizeText,
  sanitizeStacktrace,
  isFilterErrorAndSkipSentry,
};
