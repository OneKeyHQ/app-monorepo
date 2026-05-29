import { useState } from 'react';

import {
  Button,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import type { IAdaShelleyAddressPerfTraceEvent } from '@onekeyhq/core/src/chains/ada/sdkAda';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import { AppCryptoTestEmoji } from '@onekeyhq/shared/src/appCrypto/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  CryptoGalleryTable,
  CryptoGalleryTableFooter,
  CryptoGalleryTableHeader,
  PartContainer,
  createCryptoGalleryBenchmarkCooldownGuard,
  formatCryptoGalleryMs,
  formatCryptoGalleryResultCell,
  getCryptoGalleryMsColor,
  getCryptoGalleryValidationColor,
  loadCoreAdaSdk,
  loadCoreSecret,
  prewarmCryptoGalleryWebEmbedApi,
  runCryptoGalleryPerfTask,
  runCryptoGalleryTestExclusive,
  stringifyCryptoGalleryTablePayload,
} from './shared';

type IAdaGalleryShelleyAddressResult = {
  baseAddress: {
    address: string;
    path: string;
    xpub: string;
  };
  stakingAddress: {
    address: string;
    path: number[];
  };
}[];

type IAdaAddressPerfRow = {
  mode: 'cold/single' | 'hot/single' | 'cold/batch5' | 'hot/batch5';
  indexes: string;
  rnJs: number | undefined;
  webEmbed: number | undefined;
  rnJsResult: string | undefined;
  webEmbedResult: string | undefined;
  validation: string | undefined;
  isCorrect: string | undefined;
};

type IAdaAddressProbeRow = {
  detail: string;
  durationMs: number | undefined;
  isCorrect?: string;
  stage: string;
};

type IAdaAddressVectorRow = {
  expectedResult: IAdaGalleryShelleyAddressResult[number];
  index: number;
  isCorrect: string;
  rnJs: string;
  rnJsResult: IAdaGalleryShelleyAddressResult[number] | undefined;
  validation: string;
  webEmbed: string;
  webEmbedResult: IAdaGalleryShelleyAddressResult[number] | undefined;
};

const ADA_ADDRESS_TEST_MNEMONIC =
  'test test test test test test test test test test test junk';

const ADA_ADDRESS_TEST_VECTOR = {
  id: 'ada-shelley-mainnet-test-mnemonic-account-0-4-v1',
  indexes: [0, 1, 2, 3, 4],
  networkId: 1,
  expected: [
    {
      baseAddress: {
        path: "m/1852'/1815'/0'/0/0",
        address:
          'addr1qy4jrrcfzylccwgqu3su865es52jkf7yzrdu9cw3z84nycnn3zz9lvqj7vs95tej896xkekzkufhpuk64ja7pga2g8kswl6kh2',
        xpub: 'f2cdeef60dfc2c00cd1d4c0def0ce3f7b0328f5badd2fd771f48ff207ca7eaa8500a3c3d556f995e79c4a75e64d13ab12772f46e6c05fed1d9698b7e12a533f7',
      },
      stakingAddress: {
        path: [2_147_485_500, 2_147_485_463, 2_147_483_648, 2, 0],
        address: 'stake1u9ec3pzlkqf0xgz69uerjartvmptwyms7td2ewlq5w4yrmgt9207g',
      },
    },
    {
      baseAddress: {
        path: "m/1852'/1815'/1'/0/0",
        address:
          'addr1q9zdzgj2lgsemgtzvaft77stwn5k9scduwdglmphq3kpdft09083trxjn8nnmder6h37nuwlpqty5ymnxhw7zjp8fv8qyxclta',
        xpub: '694c67fe990e06966cca0a359a0f39f3c4699a268e43d92db9059a5064c5ee996ed67bf6a38c5e90463954fcfcd46aaae672a4f4b58b21176a8e96c39366fd4b',
      },
      stakingAddress: {
        path: [2_147_485_500, 2_147_485_463, 2_147_483_649, 2, 0],
        address: 'stake1u9hjhnc43nffneeaku3atclf780ss9j2zdenth0pfqn5krssu6zcj',
      },
    },
    {
      baseAddress: {
        path: "m/1852'/1815'/2'/0/0",
        address:
          'addr1q8f93rc4xm7jak3xdx4gz40pnsn3c9m0ulvqtgnynds5pa34zdgt7pf2lh3f448hytvnmq088l3wv4ml6up0ukht80dsqwhn6v',
        xpub: '0a9fdb381eb5e57b1b374bad712221f990a03dd21bbdb1c7afae9f9f24f6f727795e67cb7a4d84ca6871a4218e2d48c2e7bacf2133452fb0badd67a7d30f6ef0',
      },
      stakingAddress: {
        path: [2_147_485_500, 2_147_485_463, 2_147_483_650, 2, 0],
        address: 'stake1uy63x59lq540mc566nmj9kfas8nnlchx2alawqh7tt4nhkcwxug8h',
      },
    },
    {
      baseAddress: {
        path: "m/1852'/1815'/3'/0/0",
        address:
          'addr1q9krajzapr3cmsj84ucnga3fafk2hd9m7y9z0vtpssc32zgqvexknvdlzuujdwq7p9jgceasx8g4ljcufu54594j9zuq045whs',
        xpub: '53486109c474a2a6db4a69866c9986606b814801f63a584aa3e2d0ce999010c172e3014ffa038007d67dd8d02b18d276b1cd014bcf81bdd0e66abcb755b1609c',
      },
      stakingAddress: {
        path: [2_147_485_500, 2_147_485_463, 2_147_483_651, 2, 0],
        address: 'stake1uyqxvntfkxl3wwfxhq0qjeyvv7crr52levwy7226z6ez3wqjxgy0w',
      },
    },
    {
      baseAddress: {
        path: "m/1852'/1815'/4'/0/0",
        address:
          'addr1qyaxhe9c0sgvz5j00a8vf0f2n8cy6xpnn95wm4hkpxxvjvzrfrchmg3k9laqmtwpe3t9zh6g7697puuh29ncrn2a45hq5xlp6j',
        xpub: '8d2db7a1e92a5ed319321c78211804c8552897159fd6290651a28833fbf72b58a582e249faafd83a1af868bfbe31494077aed1270a17b8ffca2b14a68a977b45',
      },
      stakingAddress: {
        path: [2_147_485_500, 2_147_485_463, 2_147_483_652, 2, 0],
        address: 'stake1u9p53uta5gmzl7sd4hquc4j3tay0dzlq7wt4zeupe4w66tsnx47xy',
      },
    },
  ] satisfies IAdaGalleryShelleyAddressResult,
};

function serializeAdaShelleyAddressResult(
  result: IAdaGalleryShelleyAddressResult,
): string {
  return stringifyCryptoGalleryTablePayload(
    result.map(({ baseAddress, stakingAddress }) => ({
      baseAddress: {
        address: baseAddress.address,
        path: baseAddress.path,
        xpub: baseAddress.xpub,
      },
      stakingAddress: {
        address: stakingAddress.address,
        path: stakingAddress.path.join('/'),
      },
    })),
  );
}

function isAdaShelleyAddressItemMatched(
  actual: IAdaGalleryShelleyAddressResult[number] | undefined,
  expected: IAdaGalleryShelleyAddressResult[number],
) {
  return (
    actual?.baseAddress.address === expected.baseAddress.address &&
    actual.baseAddress.path === expected.baseAddress.path &&
    actual.baseAddress.xpub === expected.baseAddress.xpub &&
    actual.stakingAddress.address === expected.stakingAddress.address &&
    actual.stakingAddress.path.join('/') ===
      expected.stakingAddress.path.join('/')
  );
}

function getAdaShelleyAddressMismatchFields(
  actual: IAdaGalleryShelleyAddressResult[number] | undefined,
  expected: IAdaGalleryShelleyAddressResult[number],
) {
  if (!actual) {
    return ['missing result'];
  }
  const mismatches: string[] = [];
  if (actual.baseAddress.address !== expected.baseAddress.address) {
    mismatches.push('base address');
  }
  if (actual.baseAddress.path !== expected.baseAddress.path) {
    mismatches.push('base path');
  }
  if (actual.baseAddress.xpub !== expected.baseAddress.xpub) {
    mismatches.push('xpub');
  }
  if (actual.stakingAddress.address !== expected.stakingAddress.address) {
    mismatches.push('stake address');
  }
  if (
    actual.stakingAddress.path.join('/') !==
    expected.stakingAddress.path.join('/')
  ) {
    mismatches.push('stake path');
  }
  return mismatches;
}

function AdaVectorAddressResultBlock({
  label,
  result,
}: {
  label: string;
  result: IAdaGalleryShelleyAddressResult[number] | undefined;
}) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodySm"
        fontFamily="$monoRegular"
        selectable
        style={{ wordBreak: 'break-all' }}
      >
        base: {result?.baseAddress.address ?? '-'}
      </SizableText>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        fontFamily="$monoRegular"
        selectable
        style={{ wordBreak: 'break-all' }}
      >
        base path: {result?.baseAddress.path ?? '-'}
      </SizableText>
      <SizableText
        size="$bodySm"
        fontFamily="$monoRegular"
        selectable
        style={{ wordBreak: 'break-all' }}
      >
        stake: {result?.stakingAddress.address ?? '-'}
      </SizableText>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        fontFamily="$monoRegular"
        selectable
        style={{ wordBreak: 'break-all' }}
      >
        stake path: {result?.stakingAddress.path.join('/') ?? '-'}
      </SizableText>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        fontFamily="$monoRegular"
        selectable
        style={{ wordBreak: 'break-all' }}
      >
        xpub: {result?.baseAddress.xpub ?? '-'}
      </SizableText>
    </YStack>
  );
}

async function runAdaAddressPerfTask({
  name,
  expect,
  fn,
}: {
  name: string;
  expect?: string;
  fn: () => Promise<IAdaGalleryShelleyAddressResult>;
}): Promise<IRunAppCryptoTestTaskResult> {
  return runCryptoGalleryPerfTask({
    name,
    expect,
    fn,
    stringifyResult: serializeAdaShelleyAddressResult,
  });
}

function formatAdaProbeMetadata(
  metadata: IAdaShelleyAddressPerfTraceEvent['metadata'],
) {
  if (!metadata) {
    return '-';
  }
  const text = Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
  return text || '-';
}

export function AdaAddressPerfTest() {
  const [resultJson, setResultJson] = useState('');
  const [tableRows, setTableRows] = useState<IAdaAddressPerfRow[]>([]);
  const [probeRows, setProbeRows] = useState<IAdaAddressProbeRow[]>([]);
  const [vectorRows, setVectorRows] = useState<IAdaAddressVectorRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [running, setRunning] = useState(false);
  const [probeRunning, setProbeRunning] = useState(false);
  const [vectorRunning, setVectorRunning] = useState(false);
  const { copyText } = useClipboard();
  const rnRuntimeName = platformEnv.isNative ? 'RN JS/Hermes' : 'local JS';
  const webEmbedRuntimeName = 'WebEmbed';
  const isBusy = running || probeRunning || vectorRunning;

  const formatKdfInvocation = (
    invocation: ReturnType<
      typeof appCrypto.pbkdf2.getPbkdf2InvocationByProbeId
    >,
  ) => {
    if (!invocation) {
      return 'kdf invocation not recorded (likely PBKDF2 cache hit)';
    }
    return `backend=${invocation.backend}, iterations=${invocation.iterations}, keyLength=${invocation.keyLength}`;
  };

  const getKdfInvocationStatus = (
    invocation: ReturnType<
      typeof appCrypto.pbkdf2.getPbkdf2InvocationByProbeId
    >,
  ) => {
    if (!invocation) {
      return AppCryptoTestEmoji.isWarning;
    }
    if (!platformEnv.isNativeAndroid) {
      return AppCryptoTestEmoji.isCorrect;
    }
    if (invocation?.backend === 'react-native-quick-crypto') {
      return AppCryptoTestEmoji.isCorrect;
    }
    if (invocation?.backend === 'react-native-fast-pbkdf2') {
      return AppCryptoTestEmoji.isWarning;
    }
    return AppCryptoTestEmoji.isIncorrect;
  };

  const measureProbeTask = async <T,>({ fn }: { fn: () => Promise<T> | T }) => {
    const start = Date.now();
    const result = await fn();
    return {
      durationMs: Date.now() - start,
      result,
    };
  };

  const testAdaAddressSingleProbe = async () => {
    const secret = await loadCoreSecret();
    const {
      clearHdCredentialDecryptCache,
      encryptRevealableSeed,
      mnemonicToRevealableSeed,
    } = secret;
    const { batchGetShelleyAddressByRootKey, getRootKey } =
      await loadCoreAdaSdk();
    const canUseWebEmbed = Boolean(platformEnv.isNative && !platformEnv.isJest);
    const { canRunWebEmbed, webembedApiProxy, webEmbedPrewarmResults } =
      await prewarmCryptoGalleryWebEmbedApi({
        canUseWebEmbed,
        probeName: 'crypto-gallery-ada-single-probe-prewarm',
      });
    if (canUseWebEmbed && (!canRunWebEmbed || !webembedApiProxy)) {
      throw new OneKeyLocalError('WebEmbed API unavailable');
    }
    const rows: IAdaAddressProbeRow[] = [];
    const traceEvents: IAdaShelleyAddressPerfTraceEvent[] = [];
    const nonDbTxKdfParams = appCrypto.pbkdf2.getPbkdf2KdfParamsForNonDbTx();
    const password = 'onekey-gallery-password';
    const encodedPassword =
      await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: password,
      });
    const rs = mnemonicToRevealableSeed(ADA_ADDRESS_TEST_MNEMONIC);
    const setupProbeId = `crypto-gallery-ada-setup-${Date.now()}`;
    const createProbeId = `crypto-gallery-ada-create-${Date.now()}`;
    const hdCredentialCacheScopeId = `crypto-gallery-ada-create:${Date.now()}`;

    appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(setupProbeId);
    appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(createProbeId);

    try {
      const setup = await measureProbeTask({
        fn: () =>
          encryptRevealableSeed({
            rs,
            password: encodedPassword,
            ...nonDbTxKdfParams,
            debugCryptoProbeId: setupProbeId,
          }),
      });
      const setupKdfInvocation =
        appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(setupProbeId);
      rows.push({
        detail: formatKdfInvocation(setupKdfInvocation),
        durationMs: setup.durationMs,
        isCorrect: getKdfInvocationStatus(setupKdfInvocation),
        stage: 'setup.encryptRevealableSeed',
      });
      appCrypto.pbkdf2.clearPbkdf2Cache();

      const create = await measureProbeTask({
        fn: async () => {
          const rootKeyStart = Date.now();
          const rootKey = await getRootKey(encodedPassword, setup.result, {
            ...nonDbTxKdfParams,
            debugCryptoProbeId: createProbeId,
            hdCredentialCacheScopeId,
            perfTrace: {
              onEvent: (event) => {
                traceEvents.push(event);
              },
            },
          });
          traceEvents.push({
            durationMs: Date.now() - rootKeyStart,
            metadata: {
              indexes: 1,
              networkId: 1,
            },
            name: 'getRootKey.total',
          });

          const deriveStart = Date.now();
          const result =
            canRunWebEmbed && webembedApiProxy
              ? await webembedApiProxy.chainAdaLegacy.batchGetShelleyAddressByRootKeyHex(
                  {
                    indexes: [0],
                    networkId: 1,
                    rootKeyHex: rootKey.toString('hex'),
                  },
                )
              : batchGetShelleyAddressByRootKey(rootKey, [0], 1);
          traceEvents.push({
            durationMs: Date.now() - deriveStart,
            metadata: {
              indexes: 1,
              networkId: 1,
              runtime:
                canRunWebEmbed && webembedApiProxy
                  ? webEmbedRuntimeName
                  : rnRuntimeName,
            },
            name: 'batchGetShelleyAddressByRootKey',
          });
          return result;
        },
      });
      const createKdfInvocation =
        appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(createProbeId);
      rows.push({
        detail: 'indexes=0, networkId=1',
        durationMs: create.durationMs,
        isCorrect: AppCryptoTestEmoji.isCorrect,
        stage: 'create.total',
      });
      rows.push({
        detail: formatKdfInvocation(createKdfInvocation),
        durationMs: undefined,
        isCorrect: getKdfInvocationStatus(createKdfInvocation),
        stage: 'create.kdfBackend',
      });
      traceEvents.forEach((event) => {
        rows.push({
          detail: formatAdaProbeMetadata(event.metadata),
          durationMs: event.durationMs,
          isCorrect: AppCryptoTestEmoji.isCorrect,
          stage: event.name,
        });
      });

      setProbeRows(rows);
      setVectorRows([]);
      setTableRows([]);
      setResultJson(
        stringifyCryptoGalleryTablePayload({
          platform: {
            isNative: platformEnv.isNative,
            isNativeAndroid: platformEnv.isNativeAndroid,
            isNativeIOS: platformEnv.isNativeIOS,
            canRunWebEmbed,
            canUseWebEmbed,
            kdfBackendForCurrentPlatform:
              appCrypto.pbkdf2.getPbkdf2BackendForCurrentPlatform(),
            nativeKdfBackend: appCrypto.pbkdf2.getPbkdf2NativeBackend(),
            rnRuntime: rnRuntimeName,
            webEmbedPrewarmResults,
            webEmbedRuntime: webEmbedRuntimeName,
          },
          kdfParams: nonDbTxKdfParams,
          setupKdfInvocation,
          createKdfInvocation,
          traceEvents,
          rows,
          address: create.result,
        }),
      );
      setErrorMessage('');
      const hasIncorrectRow = rows.some(
        (row) => row.isCorrect === AppCryptoTestEmoji.isIncorrect,
      );
      if (hasIncorrectRow) {
        Toast.error({ title: 'ADA single probe detected JS KDF fallback' });
      } else {
        Toast.success({ title: 'ADA single probe finished' });
      }
    } finally {
      const webEmbedApiStatus = globalThis as {
        $onekeyAppWebembedApiWebviewInitFailed?: boolean;
      };
      const previousWebEmbedFailedStatus =
        webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed;
      try {
        webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed = true;
        await clearHdCredentialDecryptCache({ hdCredentialCacheScopeId });
      } finally {
        webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed =
          previousWebEmbedFailedStatus;
      }
      appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(setupProbeId);
      appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(createProbeId);
    }
  };

  const testAdaAddressVector = async () => {
    try {
      const secret = await loadCoreSecret();
      const {
        clearHdCredentialDecryptCache,
        encryptRevealableSeed,
        mnemonicToRevealableSeed,
      } = secret;
      const {
        batchGetShelleyAddressByRootKey,
        batchGetShelleyAddresses,
        getRootKey,
      } = await loadCoreAdaSdk();
      const canUseWebEmbed = Boolean(
        platformEnv.isNative && !platformEnv.isJest,
      );
      const webEmbedApiStatus = globalThis as {
        $onekeyAppWebembedApiWebviewInitFailed?: boolean;
      };
      const { canRunWebEmbed, webembedApiProxy, webEmbedPrewarmResults } =
        await prewarmCryptoGalleryWebEmbedApi({
          canUseWebEmbed,
          probeName: 'crypto-gallery-ada-address-vector-prewarm',
        });
      const nonDbTxKdfParams = appCrypto.pbkdf2.getPbkdf2KdfParamsForNonDbTx();
      const hdCredentialCacheScopeId = `gallery-ada-vector:${Date.now()}`;
      const password = 'onekey-gallery-password';
      const encodedPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: password,
        });
      const rs = mnemonicToRevealableSeed(ADA_ADDRESS_TEST_MNEMONIC);
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: encodedPassword,
        ...nonDbTxKdfParams,
      });

      let rootKey: Buffer | undefined;
      let webEmbedByRootKeyResult: IAdaGalleryShelleyAddressResult | undefined;
      try {
        appCrypto.pbkdf2.clearPbkdf2Cache();
        const rnJsResult = await batchGetShelleyAddresses(
          hdCredential,
          encodedPassword,
          ADA_ADDRESS_TEST_VECTOR.indexes,
          ADA_ADDRESS_TEST_VECTOR.networkId,
          {
            ...nonDbTxKdfParams,
            hdCredentialCacheScopeId,
          },
        );

        rootKey = await getRootKey(encodedPassword, hdCredential, {
          ...nonDbTxKdfParams,
          hdCredentialCacheScopeId,
        });
        if (canRunWebEmbed && webembedApiProxy) {
          webEmbedByRootKeyResult =
            await webembedApiProxy.chainAdaLegacy.batchGetShelleyAddressByRootKeyHex(
              {
                indexes: ADA_ADDRESS_TEST_VECTOR.indexes,
                networkId: ADA_ADDRESS_TEST_VECTOR.networkId,
                rootKeyHex: rootKey.toString('hex'),
              },
            );
        }
        const localByRootKeyResult = batchGetShelleyAddressByRootKey(
          rootKey,
          ADA_ADDRESS_TEST_VECTOR.indexes,
          ADA_ADDRESS_TEST_VECTOR.networkId,
        );

        const rows = ADA_ADDRESS_TEST_VECTOR.expected.map(
          (expected, rowIndex) => {
            const accountIndex = ADA_ADDRESS_TEST_VECTOR.indexes[rowIndex];
            const rnJsMatched = isAdaShelleyAddressItemMatched(
              rnJsResult[rowIndex],
              expected,
            );
            const webEmbedMatched = isAdaShelleyAddressItemMatched(
              webEmbedByRootKeyResult?.[rowIndex],
              expected,
            );
            const localByRootKeyMatched = isAdaShelleyAddressItemMatched(
              localByRootKeyResult[rowIndex],
              expected,
            );
            const rnJsMismatchFields = getAdaShelleyAddressMismatchFields(
              rnJsResult[rowIndex],
              expected,
            );
            const localByRootKeyMismatchFields =
              getAdaShelleyAddressMismatchFields(
                localByRootKeyResult[rowIndex],
                expected,
              );
            const webEmbedMismatchFields = getAdaShelleyAddressMismatchFields(
              webEmbedByRootKeyResult?.[rowIndex],
              expected,
            );
            const formatMismatch = ({
              isMatched,
              mismatchFields,
              runtimeName,
            }: {
              isMatched: boolean;
              mismatchFields: string[];
              runtimeName: string;
            }) =>
              isMatched
                ? `${runtimeName} matched`
                : `${runtimeName} mismatch: ${mismatchFields.join(', ')}`;
            const validation = [
              formatMismatch({
                isMatched: rnJsMatched,
                mismatchFields: rnJsMismatchFields,
                runtimeName: rnRuntimeName,
              }),
              formatMismatch({
                isMatched: localByRootKeyMatched,
                mismatchFields: localByRootKeyMismatchFields,
                runtimeName: 'rootKey path',
              }),
              webEmbedByRootKeyResult
                ? formatMismatch({
                    isMatched: webEmbedMatched,
                    mismatchFields: webEmbedMismatchFields,
                    runtimeName: webEmbedRuntimeName,
                  })
                : `${webEmbedRuntimeName} ${
                    canUseWebEmbed ? 'unavailable' : 'skipped'
                  }`,
            ].join(', ');
            const isCorrect = (() => {
              if (!rnJsMatched || !localByRootKeyMatched) {
                return AppCryptoTestEmoji.isIncorrect;
              }
              if (!webEmbedByRootKeyResult) {
                return canUseWebEmbed
                  ? AppCryptoTestEmoji.isWarning
                  : AppCryptoTestEmoji.isCorrect;
              }
              return webEmbedMatched
                ? AppCryptoTestEmoji.isCorrect
                : AppCryptoTestEmoji.isIncorrect;
            })();
            const webEmbedStatus = (() => {
              if (!webEmbedByRootKeyResult) {
                return canUseWebEmbed ? AppCryptoTestEmoji.isWarning : '-';
              }
              return webEmbedMatched
                ? AppCryptoTestEmoji.isCorrect
                : AppCryptoTestEmoji.isIncorrect;
            })();
            return {
              expectedResult: expected,
              index: accountIndex,
              isCorrect,
              rnJs: rnJsMatched
                ? AppCryptoTestEmoji.isCorrect
                : AppCryptoTestEmoji.isIncorrect,
              rnJsResult: rnJsResult[rowIndex],
              validation,
              webEmbed: webEmbedStatus,
              webEmbedResult: webEmbedByRootKeyResult?.[rowIndex],
            };
          },
        );
        const rnJsSerialized = serializeAdaShelleyAddressResult(rnJsResult);
        const expectedSerialized = serializeAdaShelleyAddressResult(
          ADA_ADDRESS_TEST_VECTOR.expected,
        );
        const localByRootKeySerialized =
          serializeAdaShelleyAddressResult(localByRootKeyResult);
        const webEmbedSerialized = webEmbedByRootKeyResult
          ? serializeAdaShelleyAddressResult(webEmbedByRootKeyResult)
          : undefined;

        setVectorRows(rows);
        setTableRows([]);
        setProbeRows([]);
        setResultJson(
          stringifyCryptoGalleryTablePayload({
            type: 'ada-address-test-vector',
            platform: {
              isNative: platformEnv.isNative,
              isNativeAndroid: platformEnv.isNativeAndroid,
              isNativeIOS: platformEnv.isNativeIOS,
              canRunWebEmbed,
              canUseWebEmbed,
              rnRuntime: rnRuntimeName,
              webEmbedRuntime: webEmbedRuntimeName,
            },
            vector: {
              id: ADA_ADDRESS_TEST_VECTOR.id,
              indexes: ADA_ADDRESS_TEST_VECTOR.indexes,
              networkId: ADA_ADDRESS_TEST_VECTOR.networkId,
              expected: ADA_ADDRESS_TEST_VECTOR.expected,
            },
            results: {
              rnJs: {
                matchesExpected: rnJsSerialized === expectedSerialized,
                result: rnJsResult,
                runtime: rnRuntimeName,
              },
              localByRootKey: {
                matchesExpected:
                  localByRootKeySerialized === expectedSerialized,
                result: localByRootKeyResult,
                runtime: rnRuntimeName,
              },
              webEmbedByRootKey: {
                matchesExpected: webEmbedSerialized
                  ? webEmbedSerialized === expectedSerialized
                  : undefined,
                result: webEmbedByRootKeyResult,
                runtime: webEmbedRuntimeName,
              },
            },
            webEmbedPrewarmResults,
            rows,
          }),
        );
        setErrorMessage('');

        const allPassed = rows.every(
          (row) => row.isCorrect === AppCryptoTestEmoji.isCorrect,
        );
        if (allPassed) {
          Toast.success({ title: 'ADA vector test passed' });
        } else {
          setErrorMessage('ADA vector test result mismatch');
          Toast.error({ title: 'ADA vector test failed' });
        }
      } finally {
        rootKey?.fill(0);
        const previousWebEmbedFailedStatus =
          webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed;
        try {
          if (canUseWebEmbed && !canRunWebEmbed) {
            webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed = true;
          }
          await clearHdCredentialDecryptCache({ hdCredentialCacheScopeId });
        } finally {
          if (canUseWebEmbed && !canRunWebEmbed) {
            webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed =
              previousWebEmbedFailedStatus;
          }
        }
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      setResultJson('');
      setVectorRows([]);
      setTableRows([]);
      setProbeRows([]);
      Toast.error({
        title: `ADA vector test failed: ${(error as Error).message}`,
      });
    }
  };

  const testAdaAddressPerf = async () => {
    try {
      const secret = await loadCoreSecret();
      const {
        clearHdCredentialDecryptCache,
        encryptRevealableSeed,
        mnemonicToRevealableSeed,
      } = secret;
      const { batchGetShelleyAddresses } = await loadCoreAdaSdk();
      const canUseWebEmbed = Boolean(
        platformEnv.isNative && !platformEnv.isJest,
      );
      const webEmbedApiStatus = globalThis as {
        $onekeyAppWebembedApiWebviewInitFailed?: boolean;
      };
      const { canRunWebEmbed, webembedApiProxy, webEmbedPrewarmResults } =
        await prewarmCryptoGalleryWebEmbedApi({
          canUseWebEmbed,
          probeName: 'crypto-gallery-ada-address-prewarm',
        });
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const rows: IAdaAddressPerfRow[] = [];
      const scopeIdsToClear: string[] = [];
      const password = 'onekey-gallery-password';
      const encodedPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: password,
        });
      const rs = mnemonicToRevealableSeed(ADA_ADDRESS_TEST_MNEMONIC);
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: encodedPassword,
      });
      const nonDbTxKdfParams = appCrypto.pbkdf2.getPbkdf2KdfParamsForNonDbTx();
      const waitBeforeBenchmarkTask =
        createCryptoGalleryBenchmarkCooldownGuard();
      const clearLocalPbkdf2Cache = () => {
        appCrypto.pbkdf2.clearPbkdf2Cache();
      };
      const clearWebEmbedPbkdf2Cache = async () => {
        if (canRunWebEmbed && webembedApiProxy) {
          await webembedApiProxy.secret.clearPbkdf2Cache();
        }
      };
      const runLocalAdaAddresses = async ({
        indexes,
        hdCredentialCacheScopeId,
      }: {
        indexes: number[];
        hdCredentialCacheScopeId?: string;
      }) =>
        batchGetShelleyAddresses(hdCredential, encodedPassword, indexes, 1, {
          ...nonDbTxKdfParams,
          hdCredentialCacheScopeId,
        });
      const runWebEmbedAdaAddresses = async ({
        indexes,
        hdCredentialCacheScopeId,
      }: {
        indexes: number[];
        hdCredentialCacheScopeId?: string;
      }) => {
        if (!webembedApiProxy || !canRunWebEmbed) {
          throw new OneKeyLocalError('WebEmbed API unavailable');
        }
        return webembedApiProxy.chainAdaLegacy.batchGetShelleyAddresses({
          hdCredential,
          password: encodedPassword,
          indexes,
          networkId: 1,
          ...nonDbTxKdfParams,
          hdCredentialCacheScopeId,
        });
      };
      const runCase = async ({
        mode,
        indexes,
        hot,
      }: {
        mode: IAdaAddressPerfRow['mode'];
        indexes: number[];
        hot: boolean;
      }) => {
        const indexesLabel = indexes.join(',');
        const localScopeId = hot
          ? `gallery-ada-rn-hot:${Date.now()}:${mode}`
          : undefined;
        const webEmbedScopeId = hot
          ? `gallery-ada-webembed-hot:${Date.now()}:${mode}`
          : undefined;
        if (localScopeId) {
          scopeIdsToClear.push(localScopeId);
        }
        if (webEmbedScopeId) {
          scopeIdsToClear.push(webEmbedScopeId);
        }
        const localFn = () =>
          runLocalAdaAddresses({
            indexes,
            hdCredentialCacheScopeId: localScopeId,
          });
        const webEmbedFn = () =>
          runWebEmbedAdaAddresses({
            indexes,
            hdCredentialCacheScopeId: webEmbedScopeId,
          });

        if (hot) {
          clearLocalPbkdf2Cache();
          await localFn();
        } else {
          clearLocalPbkdf2Cache();
        }
        await waitBeforeBenchmarkTask();
        const localTask = await runAdaAddressPerfTask({
          name: `ada address ${mode} ${rnRuntimeName}`,
          fn: localFn,
        });
        tasks.push(localTask);

        let webEmbedTask: IRunAppCryptoTestTaskResult | undefined;
        if (canRunWebEmbed) {
          if (hot) {
            await clearWebEmbedPbkdf2Cache();
            await webEmbedFn();
          } else {
            await clearWebEmbedPbkdf2Cache();
          }
          await waitBeforeBenchmarkTask();
          webEmbedTask = await runAdaAddressPerfTask({
            name: `ada address ${mode} ${webEmbedRuntimeName}`,
            expect: localTask.result,
            fn: webEmbedFn,
          });
          tasks.push(webEmbedTask);
        }

        const validation = (() => {
          if (localTask.ERROR) return localTask.ERROR;
          if (!webEmbedTask) return 'web-embed unavailable';
          if (webEmbedTask.ERROR) return webEmbedTask.ERROR;
          if (webEmbedTask.result !== localTask.result) {
            return `${rnRuntimeName}/${webEmbedRuntimeName} result mismatch`;
          }
          return `${rnRuntimeName}/${webEmbedRuntimeName} matched`;
        })();
        const isCorrect = (() => {
          if (!webEmbedTask) return AppCryptoTestEmoji.isWarning;
          return localTask.isCorrect === AppCryptoTestEmoji.isCorrect &&
            webEmbedTask.isCorrect === AppCryptoTestEmoji.isCorrect
            ? AppCryptoTestEmoji.isCorrect
            : AppCryptoTestEmoji.isIncorrect;
        })();
        rows.push({
          mode,
          indexes: indexesLabel,
          rnJs: localTask.time,
          webEmbed: webEmbedTask?.time,
          rnJsResult: localTask.result,
          webEmbedResult: webEmbedTask?.result,
          validation,
          isCorrect,
        });
      };

      const clearHdCredentialCacheScopes = async () => {
        const shouldSkipRemoteWebEmbedClear = canUseWebEmbed && !canRunWebEmbed;
        const previousWebEmbedFailedStatus =
          webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed;
        try {
          if (shouldSkipRemoteWebEmbedClear) {
            webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed = true;
          }
          for (const hdCredentialCacheScopeId of scopeIdsToClear) {
            await clearHdCredentialDecryptCache({ hdCredentialCacheScopeId });
          }
        } finally {
          if (shouldSkipRemoteWebEmbedClear) {
            webEmbedApiStatus.$onekeyAppWebembedApiWebviewInitFailed =
              previousWebEmbedFailedStatus;
          }
        }
      };

      try {
        await clearWebEmbedPbkdf2Cache();
        clearLocalPbkdf2Cache();
        await runCase({ mode: 'cold/single', indexes: [0], hot: false });
        await runCase({ mode: 'hot/single', indexes: [0], hot: true });
        await runCase({
          mode: 'cold/batch5',
          indexes: [0, 1, 2, 3, 4],
          hot: false,
        });
        await runCase({
          mode: 'hot/batch5',
          indexes: [0, 1, 2, 3, 4],
          hot: true,
        });
      } finally {
        await clearHdCredentialCacheScopes();
      }

      setTableRows(rows);
      setVectorRows([]);
      setProbeRows([]);
      setResultJson(
        stringifyCryptoGalleryTablePayload({
          platform: {
            isNative: platformEnv.isNative,
            isNativeAndroid: platformEnv.isNativeAndroid,
            isNativeIOS: platformEnv.isNativeIOS,
            canUseWebEmbed,
            canRunWebEmbed,
            rnRuntime: rnRuntimeName,
            webEmbedRuntime: webEmbedRuntimeName,
          },
          kdfParams: nonDbTxKdfParams,
          webEmbedPrewarmResults,
          rows,
          tasks,
        }),
      );
      setErrorMessage('');

      const allPassed =
        tasks.every(
          (task) => task.isCorrect === AppCryptoTestEmoji.isCorrect,
        ) &&
        rows.every((row) => row.isCorrect === AppCryptoTestEmoji.isCorrect);
      if (allPassed) {
        Toast.success({ title: 'ADA Address Perf test passed' });
      } else {
        const failedRows = rows
          .filter((row) => row.isCorrect !== AppCryptoTestEmoji.isCorrect)
          .map((row) => row.mode)
          .slice(0, 4);
        setErrorMessage(
          `Validation failed: ${failedRows.join(', ')}${
            failedRows.length >= 4 ? '...' : ''
          }`,
        );
        Toast.error({ title: 'ADA Address Perf test failed' });
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      setResultJson('');
      setTableRows([]);
      setVectorRows([]);
      setProbeRows([]);
      Toast.error({
        title: `ADA Address Perf test failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="ADA Address Perf">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button
          variant="primary"
          loading={running}
          disabled={isBusy}
          onPress={async () => {
            setRunning(true);
            try {
              await runCryptoGalleryTestExclusive(testAdaAddressPerf);
            } finally {
              setRunning(false);
            }
          }}
        >
          Run Test
        </Button>
        <Button
          loading={probeRunning}
          disabled={isBusy}
          onPress={async () => {
            setProbeRunning(true);
            try {
              await runCryptoGalleryTestExclusive(testAdaAddressSingleProbe);
            } catch (error) {
              setErrorMessage((error as Error).message);
              setProbeRows([]);
              setVectorRows([]);
              setTableRows([]);
              setResultJson('');
              Toast.error({
                title: `ADA single probe failed: ${(error as Error).message}`,
              });
            } finally {
              setProbeRunning(false);
            }
          }}
        >
          Run Single Probe
        </Button>
        <Button
          loading={vectorRunning}
          disabled={isBusy}
          onPress={async () => {
            setVectorRunning(true);
            try {
              await runCryptoGalleryTestExclusive(testAdaAddressVector);
            } finally {
              setVectorRunning(false);
            }
          }}
        >
          Run Vector
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
        Compares ADA Shelley address derivation in RN JS/Hermes and WebEmbed.
      </SizableText>

      {vectorRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="18%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                vector
              </SizableText>
            </Stack>
            <Stack flexBasis="16%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {rnRuntimeName}
              </SizableText>
            </Stack>
            <Stack flexBasis="16%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {webEmbedRuntimeName}
              </SizableText>
            </Stack>
            <Stack flexBasis="38%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                validation
              </SizableText>
            </Stack>
            <Stack flexBasis="12%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                status
              </SizableText>
            </Stack>
          </CryptoGalleryTableHeader>
          {vectorRows.map((row, idx) => (
            <YStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              gap="$2"
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={idx === vectorRows.length - 1 ? 0 : 1}
              borderBottomColor="$borderSubdued"
            >
              <XStack alignItems="center">
                <Stack flexBasis="18%">
                  <SizableText size="$bodySm">index {row.index}</SizableText>
                </Stack>
                <Stack flexBasis="16%" alignItems="flex-end">
                  <SizableText
                    size="$bodySmMedium"
                    color={getCryptoGalleryValidationColor(row.rnJs)}
                  >
                    {row.rnJs}
                  </SizableText>
                </Stack>
                <Stack flexBasis="16%" alignItems="flex-end">
                  <SizableText
                    size="$bodySmMedium"
                    color={
                      row.webEmbed === '-'
                        ? '$textDisabled'
                        : getCryptoGalleryValidationColor(row.webEmbed)
                    }
                  >
                    {row.webEmbed}
                  </SizableText>
                </Stack>
                <Stack flexBasis="38%">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {row.validation}
                  </SizableText>
                </Stack>
                <Stack flexBasis="12%" alignItems="flex-end">
                  <SizableText
                    size="$bodySmMedium"
                    color={getCryptoGalleryValidationColor(row.isCorrect)}
                    textAlign="right"
                  >
                    {row.isCorrect}
                  </SizableText>
                </Stack>
              </XStack>
              <YStack gap="$2">
                <AdaVectorAddressResultBlock
                  label="expected"
                  result={row.expectedResult}
                />
                <AdaVectorAddressResultBlock
                  label={rnRuntimeName}
                  result={row.rnJsResult}
                />
                <AdaVectorAddressResultBlock
                  label={webEmbedRuntimeName}
                  result={row.webEmbedResult}
                />
              </YStack>
            </YStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(stringifyCryptoGalleryTablePayload(vectorRows));
              }}
            >
              Copy ADA vector table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {probeRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="32%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                probe stage
              </SizableText>
            </Stack>
            <Stack flexBasis="18%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                time
              </SizableText>
            </Stack>
            <Stack flexBasis="38%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                detail
              </SizableText>
            </Stack>
            <Stack flexBasis="12%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                status
              </SizableText>
            </Stack>
          </CryptoGalleryTableHeader>
          {probeRows.map((row, idx) => (
            <XStack
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderBottomWidth={idx === probeRows.length - 1 ? 0 : 1}
              borderBottomColor="$borderSubdued"
              alignItems="center"
            >
              <Stack flexBasis="32%">
                <SizableText size="$bodySm">{row.stage}</SizableText>
              </Stack>
              <Stack flexBasis="18%" alignItems="flex-end">
                <SizableText
                  size="$bodySm"
                  color={getCryptoGalleryMsColor(row.durationMs)}
                >
                  {formatCryptoGalleryMs(row.durationMs)}
                </SizableText>
              </Stack>
              <Stack flexBasis="38%">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  selectable
                  style={{ wordBreak: 'break-all' }}
                >
                  {row.detail}
                </SizableText>
              </Stack>
              <Stack flexBasis="12%" alignItems="flex-end">
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
                copyText(stringifyCryptoGalleryTablePayload(probeRows));
              }}
            >
              Copy single probe table
            </Button>
          </CryptoGalleryTableFooter>
        </CryptoGalleryTable>
      ) : null}

      {tableRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <Stack flexBasis="34%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                case
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {rnRuntimeName}
              </SizableText>
            </Stack>
            <Stack flexBasis="22%" alignItems="flex-end">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {webEmbedRuntimeName}
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
                <SizableText size="$bodyMd">{row.mode}</SizableText>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  indexes {row.indexes}
                </SizableText>
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                <SizableText
                  size="$bodyMd"
                  color={getCryptoGalleryMsColor(row.rnJs)}
                >
                  {formatCryptoGalleryMs(row.rnJs)}
                </SizableText>
              </Stack>
              <Stack flexBasis="22%" alignItems="flex-end">
                <SizableText
                  size="$bodyMd"
                  color={getCryptoGalleryMsColor(row.webEmbed)}
                >
                  {formatCryptoGalleryMs(row.webEmbed)}
                </SizableText>
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
        </CryptoGalleryTable>
      ) : null}

      {tableRows.length > 0 ? (
        <CryptoGalleryTable>
          <CryptoGalleryTableHeader>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              ADA address results
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
                <SizableText size="$bodyMd">{row.mode}</SizableText>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  indexes {row.indexes}
                </SizableText>
              </XStack>
              <YStack gap="$1">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {rnRuntimeName} result
                </SizableText>
                <SizableText
                  size="$bodySm"
                  fontFamily="$monoRegular"
                  selectable
                  style={{ wordBreak: 'break-all' }}
                >
                  {formatCryptoGalleryResultCell(row.rnJsResult)}
                </SizableText>
              </YStack>
              <YStack gap="$1">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {webEmbedRuntimeName} result
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
              <SizableText size="$bodySm" color="$textSubdued">
                {row.validation}
              </SizableText>
            </YStack>
          ))}
          <CryptoGalleryTableFooter>
            <Button
              size="small"
              onPress={() => {
                copyText(stringifyCryptoGalleryTablePayload(tableRows));
              }}
            >
              Copy ADA address table
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
