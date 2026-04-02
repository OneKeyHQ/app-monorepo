import {
  reactNativeTracingIntegration,
  reactNavigationIntegration,
} from '@sentry/react-native';
import wordLists from 'bip39/src/wordlists/english.json';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { EOneKeyErrorClassNames } from '../../errors/types/errorTypes';

import type { BrowserOptions, Stacktrace } from '@sentry/browser';
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

export const navigationIntegration = reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Minimum consecutive mnemonic words to trigger redaction (12-word mnemonic could partially leak)
const MIN_MNEMONIC_SEQUENCE_LENGTH = 3;

// Check if text contains mnemonic phrases and redact them
const checkAndRedactMnemonicWords = (words: string[]): string[] => {
  if (!Array.isArray(words) || words.length === 0) {
    return words;
  }

  const wordSet = lazyLoadWordSet();
  const result = words.slice();

  let sequenceStart = -1;
  let consecutiveCount = 0;

  // Find and redact all mnemonic sequences
  for (let i = 0; i <= words.length; i += 1) {
    const isLastIteration = i === words.length;
    const isMnemonicWord =
      !isLastIteration && wordSet.has(words[i].toLowerCase());

    if (isMnemonicWord) {
      if (sequenceStart === -1) {
        sequenceStart = i; // Mark start of new sequence
      }
      consecutiveCount += 1;
    } else {
      // End of sequence (or end of array) - check if we need to redact
      if (consecutiveCount >= MIN_MNEMONIC_SEQUENCE_LENGTH) {
        // Redact the entire sequence
        for (
          let j = sequenceStart;
          j < sequenceStart + consecutiveCount;
          j += 1
        ) {
          result[j] = '****';
        }
      }
      // Reset for next potential sequence
      sequenceStart = -1;
      consecutiveCount = 0;
    }
  }

  return result;
};

// Maximum word length before redacting (long strings may contain sensitive data)
const MAX_WORD_LENGTH = 20;

// Sanitize a single text string (check for private keys, long words, and mnemonics)
const sanitizeText = (text: string): string => {
  if (typeof text !== 'string' || !text) {
    return text;
  }
  let words = text.split(' ');
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
  words = checkAndRedactMnemonicWords(words);
  return words.join(' ');
};

// Sanitize stacktrace frames (local variables may contain sensitive data)
const sanitizeStacktrace = (stacktrace?: Stacktrace): void => {
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

export const buildBasicOptions = ({
  onError,
}: {
  onError: (errorMessage: string, stacktrace?: Stacktrace) => void;
}) =>
  ({
    enabled: true,
    maxBreadcrumbs: 100,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    beforeSend: (event) => {
      if (Array.isArray(event.exception?.values)) {
        for (let index = 0; index < event.exception.values.length; index += 1) {
          const exceptionValue = event.exception.values[index];
          const { type: originalType, value: originalValue } = exceptionValue;
          try {
            // Sanitize error message
            if (exceptionValue.value) {
              const newErrorText = sanitizeText(exceptionValue.value);
              // Save error message locally
              onError(newErrorText, exceptionValue.stacktrace);
              exceptionValue.value = newErrorText;
            }
            // In webEmbed environment, network requests cannot be sent, so abort subsequent operations
            if (platformEnv.isWebEmbed) {
              return;
            }
            // Sanitize stacktrace (local variables, context lines)
            sanitizeStacktrace(exceptionValue.stacktrace);
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
    },
  }) as BrowserOptions;

export const buildSentryOptions = (Sentry: typeof import('@sentry/react')) => ({
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
});

export const buildIntegrations = (Sentry: typeof import('@sentry/react')) => [
  navigationIntegration,
  reactNativeTracingIntegration(),
  Sentry.browserProfilingIntegration(),
  Sentry.browserTracingIntegration(),
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
