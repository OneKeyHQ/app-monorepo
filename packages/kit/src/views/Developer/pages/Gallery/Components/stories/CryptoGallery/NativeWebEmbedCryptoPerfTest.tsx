import { useState } from 'react';

import { pbkdf2Async as nobleP2Async } from '@noble/hashes/pbkdf2';
import { sha512 as nobleSha512 } from '@noble/hashes/sha512';

import {
  Button,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import type {
  IBatchGetPublicKeysPerfTrace,
  IBatchGetPublicKeysPerfTraceEvent,
  IMnemonicToSeedPerfTrace,
  IMnemonicToSeedPerfTraceEvent,
} from '@onekeyhq/core/src/secret';
import type { ICurveName } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import { AppCryptoTestEmoji } from '@onekeyhq/shared/src/appCrypto/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RN_QUICK_CRYPTO from '@onekeyhq/shared/src/modules3rdParty/react-native-quick-crypto';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  CRYPTO_GALLERY_DEFAULT_PATH_EMOJI,
  CryptoGalleryTable,
  CryptoGalleryTableFooter,
  CryptoGalleryTableHeader,
  type ICryptoGalleryWebEmbedPrewarmResult,
  PartContainer,
  createCryptoGalleryBenchmarkCooldownGuard,
  formatCryptoGalleryMs,
  formatCryptoGalleryResultCell,
  getCryptoGalleryMsColor,
  getCryptoGalleryValidationColor,
  loadCoreSecret,
  prewarmCryptoGalleryWebEmbedApi,
  roundCryptoGalleryPerfMs,
  runCryptoGalleryBufferOrStringPerfTask,
  runCryptoGalleryTestExclusive,
  stringifyCryptoGalleryTablePayload,
} from './shared';

type INativeWebEmbedCryptoPerfRow = {
  mode: 'cold/raw' | 'hot/cache';
  opName: string;
  iter: number | null;
  defaultRuntime?: INativeWebEmbedDefaultRuntime;
  expectedResult: string;
  localResult: string | undefined;
  webEmbedResult: string | undefined;
  local: number | undefined;
  webEmbed: number | undefined;
  validation: string | undefined;
  isCorrect: string | undefined;
};

type INativeWebEmbedDefaultRuntime = 'primary' | 'secondary';

type INativeWebEmbedBatchPerfTraceSummaryRow = {
  mode: INativeWebEmbedCryptoPerfRow['mode'];
  source: IBatchGetPublicKeysPerfTraceEvent['source'];
  name: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
};

type INativeWebEmbedBatchPerfTracePayload = {
  mode: INativeWebEmbedCryptoPerfRow['mode'];
  events: IBatchGetPublicKeysPerfTraceEvent[];
  summary: INativeWebEmbedBatchPerfTraceSummaryRow[];
};

type INativeWebEmbedMnemonicPerfTraceRow = {
  runtime: string;
  stage: string;
  durationMs: number;
  result?: string;
  validation: string;
  isCorrect?: string;
  metadata?: IMnemonicToSeedPerfTraceEvent['metadata'];
};

function detectMnemonicToSeedBackendFromTrace(
  events: IMnemonicToSeedPerfTraceEvent[],
): string | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.name.startsWith('mnemonicToSeed.quickCrypto.pbkdf2')) {
      return 'react-native-quick-crypto';
    }
    if (event.name === 'mnemonicToSeed.webCrypto.deriveBits') {
      return 'webcrypto';
    }
    if (event.name === 'mnemonicToSeed.asmcrypto.pbkdf2Sync') {
      return 'asmcrypto';
    }
    if (event.name.startsWith('mnemonicToSeed.bip39.noblePbkdf2')) {
      return 'noble';
    }
  }
  return undefined;
}

function getGalleryWebCryptoSubtle(): SubtleCrypto | undefined {
  const subtle = globalThis.crypto?.subtle;
  if (
    subtle &&
    typeof subtle.importKey === 'function' &&
    typeof subtle.deriveBits === 'function'
  ) {
    return subtle;
  }
  return undefined;
}

function toGalleryWebCryptoArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const bytes = new Uint8Array(arrayBuffer);
  bytes.set(buffer);
  return arrayBuffer;
}

function buildBatchPerfTraceSummary({
  mode,
  events,
}: {
  mode: INativeWebEmbedCryptoPerfRow['mode'];
  events: IBatchGetPublicKeysPerfTraceEvent[];
}): INativeWebEmbedBatchPerfTraceSummaryRow[] {
  const summaryMap = new Map<
    string,
    Omit<INativeWebEmbedBatchPerfTraceSummaryRow, 'avgMs'>
  >();
  for (const event of events) {
    const key = `${event.source}:${event.name}`;
    const current = summaryMap.get(key);
    if (current) {
      current.count += 1;
      current.totalMs += event.durationMs;
      current.maxMs = Math.max(current.maxMs, event.durationMs);
    } else {
      summaryMap.set(key, {
        mode,
        source: event.source,
        name: event.name,
        count: 1,
        totalMs: event.durationMs,
        maxMs: event.durationMs,
      });
    }
  }
  return Array.from(summaryMap.values())
    .map((row) => ({
      ...row,
      totalMs: roundCryptoGalleryPerfMs(row.totalMs),
      avgMs: roundCryptoGalleryPerfMs(row.totalMs / row.count),
      maxMs: roundCryptoGalleryPerfMs(row.maxMs),
    }))
    .toSorted((a, b) => b.totalMs - a.totalMs)
    .slice(0, 24);
}

export function NativeWebEmbedCryptoPerfTest() {
  const [resultJson, setResultJson] = useState('');
  const [tableRows, setTableRows] = useState<INativeWebEmbedCryptoPerfRow[]>(
    [],
  );
  const [batchPerfTraceRows, setBatchPerfTraceRows] = useState<
    INativeWebEmbedBatchPerfTraceSummaryRow[]
  >([]);
  const [mnemonicPerfTraceRows, setMnemonicPerfTraceRows] = useState<
    INativeWebEmbedMnemonicPerfTraceRow[]
  >([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [running, setRunning] = useState(false);
  const { copyText } = useClipboard();
  const primaryRuntimeName = platformEnv.isNative ? 'native' : 'asmcrypto';
  const secondaryRuntimeName = platformEnv.isNative ? 'web-embed' : 'webcrypto';
  const defaultPathEmoji = CRYPTO_GALLERY_DEFAULT_PATH_EMOJI;

  const fmtMetadata = (
    metadata: IMnemonicToSeedPerfTraceEvent['metadata'],
  ): string =>
    metadata
      ? Object.entries(metadata)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(', ')
      : '';
  const getDefaultRuntimeByBackend = (
    backend: string | undefined,
  ): INativeWebEmbedDefaultRuntime | undefined => {
    if (!backend) {
      return undefined;
    }
    if (backend === primaryRuntimeName) {
      return 'primary';
    }
    if (backend === secondaryRuntimeName) {
      return 'secondary';
    }
    if (platformEnv.isNative && backend.startsWith('react-native-')) {
      return 'primary';
    }
    if (!platformEnv.isNative && backend === 'asmcrypto') {
      return 'primary';
    }
    if (!platformEnv.isNative && backend === 'webcrypto') {
      return 'secondary';
    }
    return undefined;
  };
  const renderRuntimeCell = ({
    row,
    runtime,
    value,
  }: {
    row: INativeWebEmbedCryptoPerfRow;
    runtime: INativeWebEmbedDefaultRuntime;
    value: number | undefined;
  }) => (
    <XStack gap="$1" alignItems="center" justifyContent="flex-end">
      {row.defaultRuntime === runtime ? (
        <SizableText size="$bodyMd">{defaultPathEmoji}</SizableText>
      ) : null}
      <SizableText size="$bodyMd" color={getCryptoGalleryMsColor(value)}>
        {formatCryptoGalleryMs(value)}
      </SizableText>
    </XStack>
  );

  const testNativeWebEmbedPerf = async () => {
    try {
      const secret = await loadCoreSecret();
      const {
        batchGetPublicKeys,
        clearHdCredentialDecryptCache,
        clearPbkdf2CacheAsync,
        encryptRevealableSeed,
        mnemonicToRevealableSeed,
        mnemonicToSeedAsync,
      } = secret;
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const rows: INativeWebEmbedCryptoPerfRow[] = [];
      const batchPerfTraces: INativeWebEmbedBatchPerfTracePayload[] = [];
      const nextBatchPerfTraceRows: INativeWebEmbedBatchPerfTraceSummaryRow[] =
        [];
      const mnemonicPerfEvents: IMnemonicToSeedPerfTraceEvent[] = [];
      const nextMnemonicPerfTraceRows: INativeWebEmbedMnemonicPerfTraceRow[] =
        [];
      const webEmbedApiStatus = globalThis as {
        $onekeyAppWebembedApiWebviewInitFailed?: boolean;
      };
      const webEmbedApiWasMarkedFailed = Boolean(
        webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed,
      );
      const canUseWebEmbed = Boolean(
        platformEnv.isNative && !platformEnv.isJest,
      );
      const nonDbTxKdfParams = appCrypto.pbkdf2.getPbkdf2KdfParamsForNonDbTx();
      const canUseWebCryptoKdf = nonDbTxKdfParams.kdfBackend === 'webcrypto';
      let canRunSecondary = platformEnv.isNative
        ? canUseWebEmbed
        : canUseWebCryptoKdf;
      const webEmbedPrewarmResults: ICryptoGalleryWebEmbedPrewarmResult[] = [];
      const waitBeforeBenchmarkTask =
        createCryptoGalleryBenchmarkCooldownGuard();
      const runPair = async ({
        mode,
        opName,
        iter,
        expect,
        beforeLocalFn,
        localFn,
        beforeSecondaryFn,
        secondaryFn,
        defaultRuntime,
      }: {
        mode: INativeWebEmbedCryptoPerfRow['mode'];
        opName: string;
        iter: number | null;
        expect: string;
        beforeLocalFn?: () => Promise<void>;
        localFn: () => Promise<Buffer | string> | Buffer | string;
        beforeSecondaryFn?: () => Promise<void>;
        secondaryFn: () => Promise<Buffer | string> | Buffer | string;
        defaultRuntime?: INativeWebEmbedDefaultRuntime;
      }) => {
        await waitBeforeBenchmarkTask();
        await beforeLocalFn?.();
        if (beforeLocalFn) {
          await waitBeforeBenchmarkTask();
        }
        const localTask = await runCryptoGalleryBufferOrStringPerfTask({
          name: `${mode} ${opName} ${primaryRuntimeName}`,
          expect,
          fn: localFn,
        });
        tasks.push(localTask);

        let secondaryTask: IRunAppCryptoTestTaskResult | undefined;
        if (canRunSecondary) {
          await waitBeforeBenchmarkTask();
          await beforeSecondaryFn?.();
          if (beforeSecondaryFn) {
            await waitBeforeBenchmarkTask();
          }
          secondaryTask = await runCryptoGalleryBufferOrStringPerfTask({
            name: `${mode} ${opName} ${secondaryRuntimeName}`,
            expect,
            fn: secondaryFn,
          });
          if (
            !secondaryTask.ERROR &&
            secondaryTask.result !== localTask.result
          ) {
            secondaryTask.isCorrect = AppCryptoTestEmoji.isIncorrect;
          }
          tasks.push(secondaryTask);
        }
        const rowValidation = (() => {
          if (localTask.ERROR) return localTask.ERROR;
          if (localTask.result !== expect) {
            return `${primaryRuntimeName} result mismatch`;
          }
          if (!secondaryTask) return `${primaryRuntimeName} result verified`;
          if (secondaryTask.ERROR) return secondaryTask.ERROR;
          if (secondaryTask.result !== expect) {
            return `${secondaryRuntimeName} result mismatch`;
          }
          if (secondaryTask.result !== localTask.result) {
            return `${primaryRuntimeName}/${secondaryRuntimeName} result mismatch`;
          }
          return `${primaryRuntimeName}/${secondaryRuntimeName} matched`;
        })();
        const rowIsCorrect = (() => {
          if (!secondaryTask) {
            return AppCryptoTestEmoji.isWarning;
          }
          return localTask.isCorrect === AppCryptoTestEmoji.isCorrect &&
            secondaryTask.isCorrect === AppCryptoTestEmoji.isCorrect
            ? AppCryptoTestEmoji.isCorrect
            : AppCryptoTestEmoji.isIncorrect;
        })();
        rows.push({
          mode,
          opName,
          iter,
          defaultRuntime,
          expectedResult: expect,
          localResult: localTask.result,
          webEmbedResult: secondaryTask?.result,
          local: localTask.time,
          webEmbed: secondaryTask?.time,
          validation: rowValidation,
          isCorrect: rowIsCorrect,
        });
        return {
          localTask,
          secondaryTask,
        };
      };

      const password = 'onekey-gallery-password';
      const mnemonicPerfTrace: IMnemonicToSeedPerfTrace = {
        onEvent: (event) => {
          const tracedEvent: IMnemonicToSeedPerfTraceEvent = {
            ...event,
            durationMs: roundCryptoGalleryPerfMs(event.durationMs),
          };
          mnemonicPerfEvents.push(tracedEvent);
          nextMnemonicPerfTraceRows.push({
            runtime: primaryRuntimeName,
            stage: tracedEvent.name,
            durationMs: tracedEvent.durationMs,
            metadata: tracedEvent.metadata,
            validation: 'timed',
          });
        },
      };
      const runLocalBatchGetPublicKeysWithTrace = async ({
        mode,
        fn,
      }: {
        mode: INativeWebEmbedCryptoPerfRow['mode'];
        fn: (perfTrace: IBatchGetPublicKeysPerfTrace) => Promise<Buffer>;
      }): Promise<Buffer> => {
        const events: IBatchGetPublicKeysPerfTraceEvent[] = [];
        const perfTrace: IBatchGetPublicKeysPerfTrace = {
          onEvent: (event) => {
            events.push({
              ...event,
              durationMs: roundCryptoGalleryPerfMs(event.durationMs),
            });
          },
        };
        const result = await fn(perfTrace);
        const summary = buildBatchPerfTraceSummary({
          mode,
          events,
        });
        batchPerfTraces.push({
          mode,
          events,
          summary,
        });
        nextBatchPerfTraceRows.push(...summary);
        return result;
      };
      const appendWebEmbedPrewarmTraceRows = (
        results: ICryptoGalleryWebEmbedPrewarmResult[],
      ) => {
        for (const item of results) {
          nextMnemonicPerfTraceRows.push({
            runtime: secondaryRuntimeName,
            stage: 'webEmbed.prewarm',
            durationMs: item.durationMs,
            result: item.result,
            metadata: {
              attempt: item.attempt,
              wasMarkedFailed: webEmbedApiWasMarkedFailed,
            },
            validation:
              item.status === 'success' ? 'ready' : item.error || item.status,
            isCorrect:
              item.status === 'success'
                ? AppCryptoTestEmoji.isCorrect
                : AppCryptoTestEmoji.isWarning,
          });
        }
      };
      const clearColdCaches = async () => {
        await clearPbkdf2CacheAsync();
      };
      const testMnemonic =
        'test test test test test test test test test test test junk';
      const testPassphrase = 'optional passphrase';
      const mnemonicToSeedExpected =
        'bc0d03ab4f8871dd4a7a68423894bb88fb54973899e4721c9dffd09a5b589171b5712b27da764f7be0653ba361f445b4f9251b490525833b644b7a13eebc7e2c';
      const batchGetPublicKeysExpected =
        '02be3c6a2aa12821e037632d30ed51a6dd2a41f2277959d56db41dfb94439e49e9';
      const defaultPathProbe: Record<
        string,
        {
          backend?: string;
          runtime?: INativeWebEmbedDefaultRuntime;
        }
      > = {};
      const bip39Pbkdf2Metadata = {
        iterations: 2048,
        keyLength: 64,
        digest: 'sha512',
      };
      const probeDefaultMnemonicToSeedBackend = async () => {
        await waitBeforeBenchmarkTask();
        const probeEvents: IMnemonicToSeedPerfTraceEvent[] = [];
        const result = await mnemonicToSeedAsync({
          mnemonic: testMnemonic,
          passphrase: testPassphrase,
          useWebembedApi: false,
          perfTrace: {
            onEvent: (event) => {
              probeEvents.push(event);
            },
          },
        });
        const resultHex = bufferUtils.bytesToHex(result);
        if (resultHex !== mnemonicToSeedExpected) {
          throw new OneKeyLocalError(
            'mnemonicToSeedAsync default probe result mismatch',
          );
        }
        return detectMnemonicToSeedBackendFromTrace(probeEvents);
      };
      const runMnemonicSegmentDiagnostic = async ({
        runtime,
        stage,
        fn,
      }: {
        runtime: string;
        stage: string;
        fn: () => Promise<Buffer> | Buffer;
      }) => {
        await waitBeforeBenchmarkTask();
        const task = await runCryptoGalleryBufferOrStringPerfTask({
          name: `mnemonicToSeed segment ${stage} ${runtime}`,
          expect: mnemonicToSeedExpected,
          fn,
        });
        tasks.push(task);
        nextMnemonicPerfTraceRows.push({
          runtime,
          stage,
          durationMs: task.time,
          result: task.result,
          metadata: bip39Pbkdf2Metadata,
          validation:
            task.isCorrect === AppCryptoTestEmoji.isCorrect
              ? 'matches expected seed'
              : task.ERROR || 'result mismatch',
          isCorrect: task.isCorrect,
        });
      };
      const defaultMnemonicBackend = await probeDefaultMnemonicToSeedBackend();
      const defaultMnemonicRuntime = getDefaultRuntimeByBackend(
        defaultMnemonicBackend,
      );
      defaultPathProbe.mnemonicToSeedAsync = {
        backend: defaultMnemonicBackend,
        runtime: defaultMnemonicRuntime,
      };
      if (platformEnv.isNative && canRunSecondary) {
        const prewarm = await prewarmCryptoGalleryWebEmbedApi({
          beforeAttempt: waitBeforeBenchmarkTask,
          canUseWebEmbed,
          probeName: 'crypto-gallery-prewarm',
        });
        webEmbedPrewarmResults.push(...prewarm.webEmbedPrewarmResults);
        appendWebEmbedPrewarmTraceRows(prewarm.webEmbedPrewarmResults);
        canRunSecondary = prewarm.canRunWebEmbed;
      }
      const mnemonicPair = await runPair({
        mode: 'cold/raw',
        opName: 'mnemonicToSeedAsync',
        iter: 2048,
        expect: mnemonicToSeedExpected,
        defaultRuntime: defaultMnemonicRuntime,
        localFn: () =>
          mnemonicToSeedAsync({
            mnemonic: testMnemonic,
            passphrase: testPassphrase,
            perfTrace: mnemonicPerfTrace,
            kdfBackend: platformEnv.isNative ? undefined : 'asmcrypto',
            useWebembedApi: false,
          }),
        secondaryFn: () =>
          mnemonicToSeedAsync({
            mnemonic: testMnemonic,
            passphrase: testPassphrase,
            kdfBackend: platformEnv.isNative ? undefined : 'webcrypto',
            useWebembedApi: platformEnv.isNative,
          }),
      });
      if (mnemonicPair.secondaryTask) {
        nextMnemonicPerfTraceRows.push({
          runtime: secondaryRuntimeName,
          stage: 'mnemonicToSeedAsync.total',
          durationMs: mnemonicPair.secondaryTask.time,
          result: mnemonicPair.secondaryTask.result,
          metadata: bip39Pbkdf2Metadata,
          validation:
            mnemonicPair.secondaryTask.isCorrect ===
            AppCryptoTestEmoji.isCorrect
              ? 'matches expected seed'
              : mnemonicPair.secondaryTask.ERROR || 'result mismatch',
          isCorrect: mnemonicPair.secondaryTask.isCorrect,
        });
      } else if (platformEnv.isNative) {
        nextMnemonicPerfTraceRows.push({
          runtime: secondaryRuntimeName,
          stage: 'mnemonicToSeedAsync.total',
          durationMs: 0,
          metadata: {
            reason: 'web-embed unavailable',
          },
          validation: 'web-embed unavailable',
          isCorrect: AppCryptoTestEmoji.isWarning,
        });
      }

      const mnemonicBuffer = Buffer.from(
        testMnemonic.normalize('NFKD'),
        'utf8',
      );
      const saltBuffer = Buffer.from(
        `mnemonic${testPassphrase.normalize('NFKD')}`,
        'utf8',
      );
      const galleryWebCryptoSubtle = getGalleryWebCryptoSubtle();
      if (galleryWebCryptoSubtle) {
        await runMnemonicSegmentDiagnostic({
          runtime: 'web-crypto',
          stage: 'rawPbkdf2DeriveBits',
          fn: async () => {
            const key = await galleryWebCryptoSubtle.importKey(
              'raw',
              toGalleryWebCryptoArrayBuffer(mnemonicBuffer),
              'PBKDF2',
              false,
              ['deriveBits'],
            );
            const derivedBits = await galleryWebCryptoSubtle.deriveBits(
              {
                name: 'PBKDF2',
                salt: toGalleryWebCryptoArrayBuffer(saltBuffer),
                iterations: 2048,
                hash: 'SHA-512',
              },
              key,
              64 * 8,
            );
            return Buffer.from(derivedBits);
          },
        });
      }
      await runMnemonicSegmentDiagnostic({
        runtime: 'noble-js',
        stage: 'rawPbkdf2Async',
        fn: async () =>
          Buffer.from(
            await nobleP2Async(nobleSha512, mnemonicBuffer, saltBuffer, {
              c: 2048,
              dkLen: 64,
            }),
          ),
      });
      if (platformEnv.isNative) {
        await runMnemonicSegmentDiagnostic({
          runtime: 'quick-crypto',
          stage: 'rawPbkdf2Async',
          fn: () =>
            new Promise<Buffer>((resolve, reject) => {
              RN_QUICK_CRYPTO.pbkdf2(
                mnemonicBuffer,
                saltBuffer,
                2048,
                64,
                'sha512',
                (err, seed) => {
                  if (err || !seed) {
                    reject(
                      err ||
                        new OneKeyLocalError(
                          'quick-crypto mnemonic segment failed',
                        ),
                    );
                    return;
                  }
                  resolve(Buffer.from(seed));
                },
              );
            }),
        });
        await runMnemonicSegmentDiagnostic({
          runtime: 'quick-crypto',
          stage: 'rawPbkdf2Sync',
          fn: () =>
            Buffer.from(
              RN_QUICK_CRYPTO.pbkdf2Sync(
                mnemonicBuffer,
                saltBuffer,
                2048,
                64,
                'sha512',
              ),
            ),
        });
      }

      const rs = mnemonicToRevealableSeed(testMnemonic, testPassphrase);
      const encodedPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: password,
        });
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: encodedPassword,
      });
      const localHotScopeId = `gallery-${primaryRuntimeName}-hot:${Date.now()}`;
      const secondaryHotScopeId = `gallery-${secondaryRuntimeName}-hot:${Date.now()}`;
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];
      const primaryBatchGetPublicKeysKdfParams = platformEnv.isNative
        ? nonDbTxKdfParams
        : {};
      const secondaryBatchGetPublicKeysKdfParams = platformEnv.isNative
        ? {}
        : nonDbTxKdfParams;
      const batchGetPublicKeysLocalRaw = async (
        perfTrace?: IBatchGetPublicKeysPerfTrace,
      ) => {
        const r = await batchGetPublicKeys({
          curveName,
          hdCredential,
          password: encodedPassword,
          prefix,
          relPaths,
          perfTrace,
          useWebembedApi: false,
          ...primaryBatchGetPublicKeysKdfParams,
        });
        const key = r?.[2]?.extendedKey?.key;
        if (!key) {
          throw new OneKeyLocalError('batchGetPublicKeys result missing');
        }
        return key;
      };
      const batchGetPublicKeysWebEmbedRaw = async () => {
        const r = await batchGetPublicKeys({
          curveName,
          hdCredential,
          password: encodedPassword,
          prefix,
          relPaths,
          useWebembedApi: platformEnv.isNative,
          ...secondaryBatchGetPublicKeysKdfParams,
        });
        const key = r?.[2]?.extendedKey?.key;
        if (!key) {
          throw new OneKeyLocalError('batchGetPublicKeys result missing');
        }
        return key;
      };
      const batchGetPublicKeysLocalHot = async (
        perfTrace?: IBatchGetPublicKeysPerfTrace,
      ) => {
        const r = await batchGetPublicKeys({
          curveName,
          hdCredential,
          password: encodedPassword,
          prefix,
          relPaths,
          hdCredentialCacheScopeId: localHotScopeId,
          perfTrace,
          useWebembedApi: false,
          ...primaryBatchGetPublicKeysKdfParams,
        });
        const key = r?.[2]?.extendedKey?.key;
        if (!key) {
          throw new OneKeyLocalError('batchGetPublicKeys result missing');
        }
        return key;
      };
      const batchGetPublicKeysWebEmbedHot = async () => {
        const r = await batchGetPublicKeys({
          curveName,
          hdCredential,
          password: encodedPassword,
          prefix,
          relPaths,
          hdCredentialCacheScopeId: secondaryHotScopeId,
          useWebembedApi: platformEnv.isNative,
          ...secondaryBatchGetPublicKeysKdfParams,
        });
        const key = r?.[2]?.extendedKey?.key;
        if (!key) {
          throw new OneKeyLocalError('batchGetPublicKeys result missing');
        }
        return key;
      };
      const probeDefaultBatchGetPublicKeysBackend = async () => {
        await waitBeforeBenchmarkTask();
        await clearColdCaches();
        const debugCryptoProbeId = `crypto-gallery-batch-default-${Date.now()}`;
        appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        try {
          const r = await batchGetPublicKeys({
            curveName,
            hdCredential,
            password: encodedPassword,
            prefix,
            relPaths,
            useWebembedApi: false,
            debugCryptoProbeId,
            ...nonDbTxKdfParams,
          });
          const key = r?.[2]?.extendedKey?.key;
          if (
            !key ||
            bufferUtils.bytesToHex(key) !== batchGetPublicKeysExpected
          ) {
            throw new OneKeyLocalError(
              'batchGetPublicKeys default probe result mismatch',
            );
          }
          return appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(
            debugCryptoProbeId,
          )?.backend;
        } finally {
          appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        }
      };
      const defaultBatchGetPublicKeysBackend =
        await probeDefaultBatchGetPublicKeysBackend();
      const defaultBatchGetPublicKeysRuntime = getDefaultRuntimeByBackend(
        defaultBatchGetPublicKeysBackend,
      );
      defaultPathProbe.batchGetPublicKeys = {
        backend: defaultBatchGetPublicKeysBackend,
        runtime: defaultBatchGetPublicKeysRuntime,
      };
      try {
        await runPair({
          mode: 'cold/raw',
          opName: 'batchGetPublicKeys',
          iter: null,
          expect: batchGetPublicKeysExpected,
          defaultRuntime: defaultBatchGetPublicKeysRuntime,
          beforeLocalFn: clearColdCaches,
          localFn: () =>
            runLocalBatchGetPublicKeysWithTrace({
              mode: 'cold/raw',
              fn: batchGetPublicKeysLocalRaw,
            }),
          beforeSecondaryFn: clearColdCaches,
          secondaryFn: batchGetPublicKeysWebEmbedRaw,
        });
        await runPair({
          mode: 'hot/cache',
          opName: 'batchGetPublicKeys',
          iter: null,
          expect: batchGetPublicKeysExpected,
          defaultRuntime: defaultBatchGetPublicKeysRuntime,
          beforeLocalFn: async () => {
            await clearHdCredentialDecryptCache({
              hdCredentialCacheScopeId: localHotScopeId,
            });
            await batchGetPublicKeysLocalHot();
          },
          localFn: () =>
            runLocalBatchGetPublicKeysWithTrace({
              mode: 'hot/cache',
              fn: batchGetPublicKeysLocalHot,
            }),
          beforeSecondaryFn: async () => {
            await clearHdCredentialDecryptCache({
              hdCredentialCacheScopeId: secondaryHotScopeId,
            });
            await batchGetPublicKeysWebEmbedHot();
          },
          secondaryFn: batchGetPublicKeysWebEmbedHot,
        });
      } finally {
        await clearHdCredentialDecryptCache({
          hdCredentialCacheScopeId: localHotScopeId,
        });
        await clearHdCredentialDecryptCache({
          hdCredentialCacheScopeId: secondaryHotScopeId,
        });
      }

      setTableRows(rows);
      setBatchPerfTraceRows(nextBatchPerfTraceRows);
      setMnemonicPerfTraceRows(nextMnemonicPerfTraceRows);
      setResultJson(
        stringifyCryptoGalleryTablePayload({
          platform: {
            isNative: platformEnv.isNative,
            isNativeIOS: platformEnv.isNativeIOS,
            isNativeAndroid: platformEnv.isNativeAndroid,
            canUseWebEmbed,
            webEmbedApiWasMarkedFailed,
            primaryRuntime: primaryRuntimeName,
            secondaryRuntime: secondaryRuntimeName,
            canUseWebCryptoKdf,
          },
          defaultPath: {
            pbkdf2: appCrypto.pbkdf2.getPbkdf2BackendForCurrentPlatform(),
            aesGcm: appCrypto.aesGcm.getAesGcmBackendForCurrentPlatform(),
            actualProbe: defaultPathProbe,
            primaryAccountDerivationKdfParams:
              primaryBatchGetPublicKeysKdfParams,
            secondaryAccountDerivationKdfParams:
              secondaryBatchGetPublicKeysKdfParams,
          },
          expectedResults: {
            mnemonicToSeedAsync: mnemonicToSeedExpected,
            batchGetPublicKeys: batchGetPublicKeysExpected,
          },
          resultRows: rows,
          mnemonicToSeedLocalPerfTrace: mnemonicPerfEvents,
          mnemonicToSeedSegmentedValidation: nextMnemonicPerfTraceRows,
          batchGetPublicKeysLocalPerfTrace: batchPerfTraces,
          webEmbedPrewarmResults,
          tasks,
        }),
      );
      setErrorMessage('');

      const allPassed =
        tasks.every((t) => t.isCorrect === AppCryptoTestEmoji.isCorrect) &&
        rows.every((row) => row.isCorrect === AppCryptoTestEmoji.isCorrect);
      if (allPassed) {
        setErrorMessage('');
        Toast.success({
          title: 'Secret Functions Crypto Perf (v2 test) passed',
        });
      } else {
        const failedTaskNames = tasks
          .filter((t) => t.isCorrect !== AppCryptoTestEmoji.isCorrect)
          .map((t) => t.name)
          .concat(
            rows
              .filter((row) => row.isCorrect !== AppCryptoTestEmoji.isCorrect)
              .map((row) => `${row.mode} ${row.opName}`),
          )
          .slice(0, 4);
        setErrorMessage(
          `Validation failed: ${failedTaskNames.join(', ')}${
            failedTaskNames.length >= 4 ? '...' : ''
          }`,
        );
        Toast.error({
          title: 'Secret Functions Crypto Perf (v2 test) failed',
        });
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      setResultJson('');
      setTableRows([]);
      setBatchPerfTraceRows([]);
      setMnemonicPerfTraceRows([]);
      Toast.error({
        title: `Secret Functions Crypto Perf (v2 test) failed: ${
          (error as Error).message
        }`,
      });
    }
  };

  return (
    <PartContainer title="Secret Functions Crypto Perf (v2 test)">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button
          variant="primary"
          loading={running}
          disabled={running}
          onPress={async () => {
            setRunning(true);
            try {
              await runCryptoGalleryTestExclusive(testNativeWebEmbedPerf);
            } finally {
              setRunning(false);
            }
          }}
        >
          Run Test
        </Button>
        {resultJson ? (
          <Button
            size="small"
            onPress={() => {
              copyText(resultJson);
            }}
          >
            Copy raw JSON
          </Button>
        ) : null}
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        Compares mnemonicToSeedAsync and batchGetPublicKeys on the current local
        runtime.
      </SizableText>

      {tableRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="34%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                operation
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {primaryRuntimeName}
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {secondaryRuntimeName}
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                validation
              </SizableText>
            </Stack>
          </CryptoGalleryTableHeader>
          {tableRows.map((row, idx) => (
            <XStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={idx === tableRows.length - 1 ? 0 : 1}
              borderBottomColor="$borderSubdued"
              alignItems="center"
            >
              <Stack flexBasis="34%">
                <SizableText size="$bodyMd">{row.opName}</SizableText>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {row.mode}
                  {row.iter !== null ? ` - ${row.iter.toLocaleString()}` : ''}
                </SizableText>
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                {renderRuntimeCell({
                  row,
                  runtime: 'primary',
                  value: row.local,
                })}
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                {renderRuntimeCell({
                  row,
                  runtime: 'secondary',
                  value: row.webEmbed,
                })}
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                <SizableText
                  size="$bodySmMedium"
                  color={getCryptoGalleryValidationColor(row.isCorrect)}
                  textAlign="right"
                >
                  {row.isCorrect}
                </SizableText>
              </Stack>
            </XStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(
                  stringifyCryptoGalleryTablePayload({
                    primaryRuntime: primaryRuntimeName,
                    secondaryRuntime: secondaryRuntimeName,
                    rows: tableRows.map(
                      ({
                        defaultRuntime,
                        isCorrect,
                        iter,
                        local,
                        mode,
                        opName,
                        validation,
                        webEmbed,
                      }) => ({
                        defaultRuntime,
                        isCorrect,
                        iter,
                        local,
                        mode,
                        opName,
                        validation,
                        webEmbed,
                      }),
                    ),
                  }),
                );
              }}
            >
              Copy overview table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {tableRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              calculation results (full hex, cross-platform compare)
            </SizableText>
          </CryptoGalleryTableHeader>
          {tableRows.map((row, idx) => (
            <YStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              gap="$2"
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={idx === tableRows.length - 1 ? 0 : 1}
              borderBottomColor="$borderSubdued"
            >
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <SizableText size="$bodyMd">{row.opName}</SizableText>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {row.mode}
                  {row.iter !== null ? ` - ${row.iter.toLocaleString()}` : ''}
                </SizableText>
              </XStack>
              <YStack gap="$1">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  expected
                </SizableText>
                <SizableText
                  size="$bodySm"
                  fontFamily="$monoRegular"
                  selectable
                  style={{ wordBreak: 'break-all' }}
                >
                  {row.expectedResult}
                </SizableText>
              </YStack>
              <YStack gap="$1">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {primaryRuntimeName} result
                </SizableText>
                <SizableText
                  size="$bodySm"
                  fontFamily="$monoRegular"
                  selectable
                  style={{ wordBreak: 'break-all' }}
                >
                  {formatCryptoGalleryResultCell(row.localResult)}
                </SizableText>
              </YStack>
              <YStack gap="$1">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {secondaryRuntimeName} result
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color={row.webEmbedResult ? '$text' : '$textDisabled'}
                  fontFamily="$monoRegular"
                  selectable
                  style={{ wordBreak: 'break-all' }}
                >
                  {formatCryptoGalleryResultCell(row.webEmbedResult)}
                </SizableText>
              </YStack>
            </YStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(
                  stringifyCryptoGalleryTablePayload({
                    primaryRuntime: primaryRuntimeName,
                    secondaryRuntime: secondaryRuntimeName,
                    rows: tableRows.map(
                      ({
                        expectedResult,
                        iter,
                        localResult,
                        mode,
                        opName,
                        webEmbedResult,
                      }) => ({
                        expectedResult,
                        iter,
                        localResult,
                        mode,
                        opName,
                        webEmbedResult,
                      }),
                    ),
                  }),
                );
              }}
            >
              Copy calculation results table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {mnemonicPerfTraceRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="20%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                runtime
              </SizableText>
            </Stack>
            <Stack flexBasis="40%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                mnemonic stage
              </SizableText>
            </Stack>
            <Stack flexBasis="18%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                time
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                validation
              </SizableText>
            </Stack>
          </CryptoGalleryTableHeader>
          {mnemonicPerfTraceRows.map((row, idx) => (
            <XStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={
                idx === mnemonicPerfTraceRows.length - 1 ? 0 : 1
              }
              borderBottomColor="$borderSubdued"
              alignItems="center"
            >
              <Stack flexBasis="20%">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {row.runtime}
                </SizableText>
              </Stack>
              <Stack flexBasis="40%">
                <SizableText size="$bodySm" color="$text">
                  {row.stage}
                </SizableText>
                {row.metadata ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {fmtMetadata(row.metadata)}
                  </SizableText>
                ) : null}
              </Stack>
              <Stack flexBasis="18%" alignItems="flex-end">
                <SizableText
                  size="$bodySm"
                  color={getCryptoGalleryMsColor(row.durationMs)}
                >
                  {formatCryptoGalleryMs(row.durationMs)}
                </SizableText>
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                <SizableText
                  size="$bodySmMedium"
                  color={
                    row.isCorrect
                      ? getCryptoGalleryValidationColor(row.isCorrect)
                      : '$text'
                  }
                  textAlign="right"
                >
                  {row.isCorrect ?? ''}
                </SizableText>
              </Stack>
            </XStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(
                  stringifyCryptoGalleryTablePayload(mnemonicPerfTraceRows),
                );
              }}
            >
              Copy mnemonic stage table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {batchPerfTraceRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="20%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                mode
              </SizableText>
            </Stack>
            <Stack flexBasis="36%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                stage
              </SizableText>
            </Stack>
            <Stack flexBasis="12%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                count
              </SizableText>
            </Stack>
            <Stack flexBasis="16%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                total
              </SizableText>
            </Stack>
            <Stack flexBasis="16%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                avg
              </SizableText>
            </Stack>
          </CryptoGalleryTableHeader>
          {batchPerfTraceRows.map((row, idx) => (
            <XStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={idx === batchPerfTraceRows.length - 1 ? 0 : 1}
              borderBottomColor="$borderSubdued"
              alignItems="center"
            >
              <Stack flexBasis="20%">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {row.mode}
                </SizableText>
              </Stack>
              <Stack flexBasis="36%">
                <SizableText size="$bodySm" color="$text">
                  {row.source}: {row.name}
                </SizableText>
              </Stack>
              <Stack flexBasis="12%" alignItems="flex-end">
                <SizableText size="$bodySm">{row.count}</SizableText>
              </Stack>
              <Stack flexBasis="16%" alignItems="flex-end">
                <SizableText
                  size="$bodySm"
                  color={getCryptoGalleryMsColor(row.totalMs)}
                >
                  {formatCryptoGalleryMs(row.totalMs)}
                </SizableText>
              </Stack>
              <Stack flexBasis="16%" alignItems="flex-end">
                <SizableText
                  size="$bodySm"
                  color={getCryptoGalleryMsColor(row.avgMs)}
                >
                  {formatCryptoGalleryMs(row.avgMs)}
                </SizableText>
              </Stack>
            </XStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(
                  stringifyCryptoGalleryTablePayload(batchPerfTraceRows),
                );
              }}
            >
              Copy batch stage table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {errorMessage ? (
        <SizableText size="$bodyMd" color="$textCritical">
          Error: {errorMessage}
        </SizableText>
      ) : null}
    </PartContainer>
  );
}
