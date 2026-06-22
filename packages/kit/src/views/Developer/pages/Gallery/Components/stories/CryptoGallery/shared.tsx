import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import { AppCryptoTestEmoji } from '@onekeyhq/shared/src/appCrypto/utils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

// Core secret functions are loaded dynamically to avoid kit->core value import
export async function loadCoreSecret() {
  return import('@onekeyhq/core/src/secret');
}

export async function loadCoreAdaSdk() {
  return import('@onekeyhq/core/src/chains/ada/sdkAda');
}

export function PartContainer({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack>
      <YStack gap="$5">{children}</YStack>
    </YStack>
  );
}

export function CustomAccordion({ children }: { children: ReactNode }) {
  return (
    <YStack gap="$2" width="100%">
      {children}
    </YStack>
  );
}

export function CustomAccordionItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <YStack overflow="hidden">
      <Stack
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py="$4"
        px="$2"
        borderRadius="$2"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => setIsOpen(!isOpen)}
        bg="$backgroundFocus"
      >
        <SizableText>{title}</SizableText>
        <View
          animation="quick"
          animateOnly={ANIMATE_ONLY_TRANSFORM}
          rotate={isOpen ? '0deg' : '-90deg'}
          transformOrigin="center"
        >
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$6" />
        </View>
      </Stack>

      <YStack
        animation="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        opacity={isOpen ? 1 : 0}
        overflow="hidden"
        style={{
          maxHeight: isOpen ? 100_000 : 0,
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        <YStack paddingTop="$2">{children}</YStack>
      </YStack>
    </YStack>
  );
}

export function CryptoGalleryTable({ children }: { children: ReactNode }) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$2"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

export function CryptoGalleryTableHeader({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <XStack
      backgroundColor="$bgSubdued"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderBottomWidth={1}
      borderBottomColor="$border"
    >
      {children}
    </XStack>
  );
}

export function CryptoGalleryTableFooter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <XStack
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderTopWidth={1}
      borderTopColor="$borderSubdued"
    >
      {children}
    </XStack>
  );
}

export const CRYPTO_GALLERY_TEST_COOLDOWN_MS = 500;
export const CRYPTO_GALLERY_DEFAULT_PATH_EMOJI = '⭐';
let cryptoGalleryTestQueue = Promise.resolve();
let lastCryptoGalleryTestFinishedAt = 0;

function waitForCryptoGalleryTestCooldown() {
  const waitMs =
    lastCryptoGalleryTestFinishedAt > 0
      ? Math.max(
          CRYPTO_GALLERY_TEST_COOLDOWN_MS -
            (Date.now() - lastCryptoGalleryTestFinishedAt),
          0,
        )
      : 0;
  return new Promise<void>((resolve) => {
    setTimeout(resolve, waitMs);
  });
}

export function waitForCryptoGalleryBenchmarkCooldown() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, CRYPTO_GALLERY_TEST_COOLDOWN_MS);
  });
}

export function createCryptoGalleryBenchmarkCooldownGuard() {
  let shouldCooldownBeforeBenchmarkTask = false;
  return async () => {
    if (!shouldCooldownBeforeBenchmarkTask) {
      shouldCooldownBeforeBenchmarkTask = true;
      return;
    }
    await waitForCryptoGalleryBenchmarkCooldown();
  };
}

export function formatCryptoGalleryMs(
  value: number | undefined,
  emptyPlaceholder = '—',
) {
  return value === undefined ? emptyPlaceholder : `${value} ms`;
}

export function formatCryptoGalleryResultCell(value: string | undefined) {
  return value ?? '-';
}

export function getCryptoGalleryMsColor(value: number | undefined): string {
  if (value === undefined) return '$textDisabled';
  if (value <= 10) return '$textSuccess';
  if (value < 100) return '$text';
  if (value < 500) return '$textCaution';
  return '$textCritical';
}

export function getCryptoGalleryValidationColor(
  isCorrect: string | undefined,
): string {
  if (isCorrect === AppCryptoTestEmoji.isCorrect) {
    return '$textSuccess';
  }
  if (isCorrect === AppCryptoTestEmoji.isWarning) {
    return '$textCaution';
  }
  return '$textCritical';
}

export function roundCryptoGalleryPerfMs(value: number): number {
  return Number(value.toFixed(2));
}

export async function runCryptoGalleryPerfTask<T>({
  name,
  expect,
  fn,
  stringifyResult,
}: {
  name: string;
  expect?: string;
  fn: () => Promise<T> | T;
  stringifyResult: (value: T) => string;
}): Promise<IRunAppCryptoTestTaskResult> {
  const start = Date.now();
  let result: string | undefined = '';
  let error: string | undefined = '';
  let isPromise = false;
  try {
    const value = fn();
    isPromise = typeof (value as Promise<T> | undefined)?.then === 'function';
    result = stringifyResult(await value);
  } catch (e) {
    error = (e as Error | undefined)?.message ?? 'Error';
  }
  const time = Date.now() - start;
  return {
    name,
    result: result || undefined,
    time,
    isSlow: time > 10 && !error ? AppCryptoTestEmoji.isSlow : undefined,
    isPromise,
    ERROR: error ? `${AppCryptoTestEmoji.isWarning} ${error}` : undefined,
    isCorrect: (() => {
      if (error) return AppCryptoTestEmoji.isWarning;
      if (expect === undefined || result === expect) {
        return AppCryptoTestEmoji.isCorrect;
      }
      return AppCryptoTestEmoji.isIncorrect;
    })(),
  };
}

export function runCryptoGalleryBufferOrStringPerfTask({
  name,
  expect,
  fn,
}: {
  name: string;
  expect: string;
  fn: () => Promise<Buffer | string> | Buffer | string;
}) {
  return runCryptoGalleryPerfTask({
    name,
    expect,
    fn,
    stringifyResult: bufferUtils.bytesToHex,
  });
}

export type ICryptoGalleryWebEmbedPrewarmResult = {
  attempt: number;
  durationMs: number;
  error?: string;
  result?: string;
  status: 'failed' | 'skipped' | 'success';
};

type ICryptoGalleryWebembedApiProxy =
  typeof import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy').default;

export async function prewarmCryptoGalleryWebEmbedApi({
  beforeAttempt,
  canUseWebEmbed,
  probeName,
  maxAttempts = 2,
}: {
  beforeAttempt?: () => Promise<void>;
  canUseWebEmbed: boolean;
  maxAttempts?: number;
  probeName: string;
}): Promise<{
  canRunWebEmbed: boolean;
  webembedApiProxy?: ICryptoGalleryWebembedApiProxy;
  webEmbedPrewarmResults: ICryptoGalleryWebEmbedPrewarmResult[];
}> {
  const webEmbedPrewarmResults: ICryptoGalleryWebEmbedPrewarmResult[] = [];
  if (!canUseWebEmbed) {
    webEmbedPrewarmResults.push({
      attempt: 0,
      durationMs: 0,
      status: 'skipped',
    });
    return {
      canRunWebEmbed: false,
      webEmbedPrewarmResults,
    };
  }

  const webembedApiProxy = (
    await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
  ).default;
  const webEmbedApiStatus = globalThis as {
    $onekeyAppWebembedApiWebviewInitFailed?: boolean;
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await beforeAttempt?.();
    const start = Date.now();
    try {
      const result = await webembedApiProxy.test.test1(
        probeName,
        String(attempt),
      );
      const durationMs = Date.now() - start;
      webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed = false;
      webEmbedPrewarmResults.push({
        attempt,
        durationMs,
        result,
        status: 'success',
      });
      return {
        canRunWebEmbed: true,
        webembedApiProxy,
        webEmbedPrewarmResults,
      };
    } catch (error) {
      webEmbedPrewarmResults.push({
        attempt,
        durationMs: Date.now() - start,
        error: (error as Error).message,
        status: 'failed',
      });
    }
  }
  return {
    canRunWebEmbed: false,
    webembedApiProxy,
    webEmbedPrewarmResults,
  };
}

export function runCryptoGalleryTestExclusive<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const run = cryptoGalleryTestQueue
    .catch(() => undefined)
    .then(async () => {
      await waitForCryptoGalleryTestCooldown();
      try {
        return await fn();
      } finally {
        lastCryptoGalleryTestFinishedAt = Date.now();
      }
    });
  cryptoGalleryTestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function stringifyCryptoGalleryTablePayload(value: unknown): string {
  return stringUtils.stableStringify(
    value,
    stringUtils.STRINGIFY_REPLACER.bufferToHex,
    2,
  );
}
