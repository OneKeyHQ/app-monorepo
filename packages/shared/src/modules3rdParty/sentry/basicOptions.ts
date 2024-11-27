import wordLists from 'bip39/src/wordlists/english.json';

import type { BrowserOptions } from '@sentry/browser';

// Check if errorText contains a private key pattern
const checkPrivateKey = (errorText: string) => {
  if (
    typeof errorText === 'string' &&
    // Check for common private key formats
    (/^[0-9a-f]{64}$/i.test(errorText) || // Raw hex private key
      /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(errorText) || // WIF format
      /^[a-f0-9]{128}$/i.test(errorText) || // Extended private key
      /^0x[0-9a-f]{64}$/i.test(errorText)) // Ethereum style private key
  ) {
    // If private key detected, redact the event
    return null;
  }
};

// Check if text contains mnemonic phrases
const checkAndRedactMnemonicWords = (words: string[]) => {
  if (!Array.isArray(words)) {
    return words;
  }

  const wordSet = new Set(wordLists);
  const result = [...words];
  let consecutiveCount = 0;
  let maxConsecutiveCount = 0;

  const indexes = [];
  // Check for consecutive mnemonic words and count them
  for (let i = 0; i < words.length; i += 1) {
    if (wordSet.has(words[i].toLowerCase())) {
      consecutiveCount += 1;
      maxConsecutiveCount = Math.max(maxConsecutiveCount, consecutiveCount);
      indexes.push(i);
    } else {
      consecutiveCount = 0;
    }
  }

  if (maxConsecutiveCount > 10) {
    for (let i = 0; i < indexes.length; i += 1) {
      result[indexes[i]] = '****';
    }
  }

  return result;
};

export const basicOptions: BrowserOptions = {
  enabled: true,
  maxBreadcrumbs: 100,
  beforeSend: (event) => {
    console.log('beforeSend', event.exception);
    if (Array.isArray(event.exception?.values)) {
      for (let index = 0; index < event.exception.values.length; index += 1) {
        const errorText = event.exception.values[index].value;
        if (errorText) {
          let textSlices = errorText?.split(' ');
          try {
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
    console.log('beforeSend', event.exception);
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
