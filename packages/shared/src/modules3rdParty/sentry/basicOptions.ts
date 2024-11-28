import wordLists from 'bip39/src/wordlists/english.json';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type { BrowserOptions } from '@sentry/browser';

// dirty check for common private key formats
const checkPrivateKey = (errorText: string) =>
  typeof errorText === 'string' && errorText.length > 26;

const lazyLoadWordSet = memoizee(() => new Set(wordLists));

// Check if text contains mnemonic phrases
const checkAndRedactMnemonicWords = (words: string[]) => {
  if (!Array.isArray(words)) {
    return words;
  }

  const wordSet = lazyLoadWordSet();
  const result = words.slice();
  let consecutiveCount = 0;
  let maxConsecutiveCount = 0;

  let startIndex = 0;
  // Check for consecutive mnemonic words and count them
  for (let i = 0; i < words.length; i += 1) {
    if (wordSet.has(words[i].toLowerCase())) {
      consecutiveCount += 1;
      maxConsecutiveCount = Math.max(maxConsecutiveCount, consecutiveCount);
    } else {
      startIndex = i;
      consecutiveCount = 0;
    }
  }

  if (maxConsecutiveCount > 10) {
    for (let i = startIndex; i < maxConsecutiveCount; i += 1) {
      result[i] = '****';
    }
  }

  return result;
};

export const basicOptions: BrowserOptions = {
  enabled: process.env.NODE_ENV === 'production',
  maxBreadcrumbs: 100,
  beforeSend: (event) => {
    if (Array.isArray(event.exception?.values)) {
      for (let index = 0; index < event.exception.values.length; index += 1) {
        const errorText = event.exception.values[index].value;
        if (errorText) {
          try {
            let textSlices = errorText?.split(' ');
            for (let i = 0; i < textSlices.length; i += 1) {
              const textSlice = textSlices[i];
              if (checkPrivateKey(textSlice)) {
                textSlices[i] = '****';
              }
            }
            textSlices = checkAndRedactMnemonicWords(textSlices);
            event.exception.values[index].value = textSlices.join(' ');
          } catch {
            // Do nothing
          }
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
};

export const buildOptions = (Sentry: typeof import('@sentry/react')) => ({
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
});

export const buildIntegrations = (Sentry: typeof import('@sentry/react')) => [
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
