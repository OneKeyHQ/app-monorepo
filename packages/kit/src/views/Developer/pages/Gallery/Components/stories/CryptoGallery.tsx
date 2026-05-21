/* eslint-disable prefer-const */
import { useState } from 'react';

import crypto from 'crypto';

import { pbkdf2Async as nobleP2Async } from '@noble/hashes/pbkdf2';
import { sha512 as nobleSha512 } from '@noble/hashes/sha512';

import {
  Button,
  DebugRenderTracker,
  Icon,
  Select,
  SizableText,
  Stack,
  Toast,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import type { ICurveName } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDemoPriceInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/demo';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import {
  AppCryptoTestEmoji,
  runAppCryptoTestTask,
} from '@onekeyhq/shared/src/appCrypto/utils';
import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import RN_FAST_PBKDF2 from '@onekeyhq/shared/src/modules3rdParty/react-native-fast-pbkdf2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { Layout } from './utils/Layout';

// Core secret functions are loaded dynamically to avoid kit->core value import
async function loadCoreSecret() {
  return import('@onekeyhq/core/src/secret');
}

function PartContainer({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <YStack>
      <YStack gap="$5">{children}</YStack>
    </YStack>
  );
}

// Custom Accordion Components
function CustomAccordion({ children }: { children: React.ReactNode }) {
  return (
    <YStack gap="$2" width="100%">
      {children}
    </YStack>
  );
}

function CustomAccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <YStack
      // borderColor="$border"
      // borderWidth={StyleSheet.hairlineWidth}
      // borderRadius="$2"
      overflow="hidden"
    >
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

// Test Components
function PBKDF2Test() {
  const [result, setResult] = useState('');

  const testPBKDF2 = async () => {
    try {
      const r = await appCrypto.pbkdf2.$testSampleForPbkdf2();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `PBKDF2 completed `,
      });
    } catch (error) {
      Toast.error({
        title: `PBKDF2 failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="PBKDF2 Test">
      <Button variant="primary" onPress={testPBKDF2}>
        Test PBKDF2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function HashTest() {
  const [result, setResult] = useState('');

  const testHash = async () => {
    try {
      const r = await appCrypto.hash.$testSampleForHash();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `Hash completed `,
      });
    } catch (error) {
      Toast.error({
        title: `Hash failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="Hash Test">
      <Button variant="primary" onPress={testHash}>
        Test Hash
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function KeyGenTest() {
  const [result, setResult] = useState('');

  const testKeyGen = async () => {
    try {
      const r = await appCrypto.keyGen.$testSampleForKeyGen();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `KeyGen completed`,
      });
    } catch (error) {
      Toast.error({
        title: `KeyGen failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="KeyGen Test">
      <Button variant="primary" onPress={testKeyGen}>
        Test KeyGen
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function AESCbcTest() {
  const [result, setResult] = useState('');

  const testAESCbc = async () => {
    try {
      const r = await appCrypto.aesCbc.$testSampleForAesCbc();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `AES-CBC completed`,
      });
    } catch (error) {
      Toast.error({
        title: `AES-CBC failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="AES-CBC Test">
      <Button variant="primary" onPress={testAESCbc}>
        Test AES-CBC
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

// Production default (600_000) is always measured automatically, so it is
// intentionally excluded from the selector.
const AES_GCM_V2_ITER_OPTIONS: number[] = [
  5000, 6000, 7000, 8000, 9000, 10_000, 20_000, 50_000, 100_000, 400_000,
  800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
];
const AES_GCM_V2_DEFAULT_ITER = 600_000;
const AES_GCM_V2_BENCHMARK_COOLDOWN_MS = 500;

// Canonical PBKDF2-HMAC-SHA256 vectors for the fixed gallery inputs:
//   password = sha256('onekey-gallery-password')
//            = 5251c069b517bbf3f2a4b41fef38d2470c9967c1b265c9d3261c3f48eeadaf01
//   salt     = 303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f
//   dkLen    = 32, hash = sha256
// Cross-verified with Node's `crypto.pbkdf2Sync` and `@noble/hashes/pbkdf2`
// (two independent implementations). Pinning these forces every backend on
// every platform to match a third-party reference, not just each other.
const AES_GCM_V2_PBKDF2_EXPECTED: Record<number, string> = {
  5000: 'a0b5a344d633782e09c3b12c25e7af2f7884046d3b6532fbf8703621f8fa85fb',
  6000: '0d68b34a893246887ca00c4f0f742fee31b12e59dfb6f467798487e745abbc35',
  7000: 'b59e473f7f8be89d98dfbf3ac361ec57cf6504afec911bf5c6a1b8041fc96aad',
  8000: '1122868ea2381f56dd1f28941660ea1bb4408480692aa5481177e4185d25ad2c',
  9000: 'f5a430e87254d0085fca9a362772e6182f3559979919184d97e2bb650c45c2f5',
  10_000: '50dd37fe740120de701248818e084bc4752aa72a4c7eece93bff4b387450144b',
  20_000: '7029da313d766845fb9ae8004bb25d13a3d3043499e3dfee673286f4ff505290',
  50_000: '25bc707d3b8581c4468b3de4f85eee7d860b3bd932a4530aca1b907b35326f55',
  100_000: 'a86fa53cac84f4f57f18afef80a7eb4f178df47c1e7e1fe6310745fdf44ce570',
  400_000: 'cff1d771a919abdaff4b5c5f03e6e2dbfdc14103440b76f35169a7536a23da8a',
  600_000: 'b9bb3c9fd4a62196b2c4e3610bc1c92b834cdf2b1d688675e46b711f7ffd9f0a',
  800_000: '438761b9323817c39a3a61487e164704a5d0b33ddba7bb0679d481269b712fb2',
  1_000_000: 'bc603304bdc4e26aec16bb99cafeb780ff80440451ddc945540b87e3c66d2e3c',
  1_500_000: '0bee8eca4c39ff15f1eb050aca8e27f3a1ee6d476921f236c47d1b8b5d845237',
  2_000_000: 'bd36de07b6fa4a981d0e283f8ad127b0e3fcfd34a87a91634adccb89ed47959c',
  3_000_000: '1c4dd6896f4a795132e9857c8bbc09bcc63828247a8aec45b7c259dd103a4ab3',
  5_000_000: 'd76d404606138a9ff379e93952b7b49141cecd8146b87214bc00f82ebf80b094',
};

// PBKDF2-HMAC-SHA512, dkLen = 64 (TON / BIP39 path). Same password + salt as
// the sha-256 vectors above. Cross-verified with Node `crypto.pbkdf2Sync` and
// `@noble/hashes/pbkdf2` + `@noble/hashes/sha512`. This protects the
// `@ton/crypto-primitives` -> `react-native-fast-pbkdf2.derive(... 'sha-512')`
// chain that all TON mnemonic flows depend on at runtime.
const AES_GCM_V2_PBKDF2_SHA512_KEY_LENGTH = 64;
const AES_GCM_V2_PBKDF2_SHA512_EXPECTED: Record<number, string> = {
  5000: 'cd3c233aa936e7c60ab3c0b4805c520cddd9252923d407751db75b8ef73af0ca31806f29dda7d0b88693ae2571f2bee8fb6054c284521c75a2e8aee20d262c80',
  6000: '6c69912d9b96d5b4ab357b98d2100784b3381ddac6d3785444476af3dffa8faa8cbbb8d417092b531105afdab8e15a6d2ee210b1cff4964bbc2bb6db6690e16f',
  7000: 'f3af99963b65c8d6af7b49af857bf014a545778255e62d9ce1b3635be05ca5d36f2497a52ff9e15b0c170e467563de773d6914749c78e0efc568876953b49938',
  8000: 'f814e1dcf7c42d32d7e5364809c04a791cdc321957e5145925fb3fbc3facbd83728b01cffca5296e6a1d1038490e96f57a2572d1b3a2c927fff91f114504e13b',
  9000: '9b07bbcaa4d18e728c27a2d52aacb0337b492b93ed49c9dc47f6bfcae9cd1603c2ce82b93469698f2ff599acb3ba7d56f30f705d27a0fa8e798edc40aa4584c1',
  10_000:
    '1f7224c0ab55f14d7a00868f40163d2ea5334487c935ca5bee77c5ab62c362ac218a7386c129d89c3a188ff117d18855fb88d7e08d56e7db7ee3d795a39d2a9b',
  20_000:
    '8e8fe967dfe7bf8de32f0722e33ecbde6b2d0fc5e89d890733be3e3408c755e89b26d2529669b231a4e0e2f44f46e5d6d59f77fe96bbe7c5a62a8bf50f6f16b7',
  50_000:
    '7b1acb1ea03ed97dd0dcadef1c2d0d0dfc6171a226e18788a429e4840a507244e3dac2af2d87e542e15751f12a6b5762c2ca80a39a981aa2e166fdfc04fe86c0',
  100_000:
    '13bf3c7443ebb865f13c5ccf094d273ab250c25f1d66d2828700628dce883c18def3b4578b558f8502c7e6f86b253dfacdacd86a224f1d893f4368e531f53315',
  400_000:
    'e137c79d100cec230f8ee30912bc775ecee64826255dc3cf17f2d54b362bace69332724986010656c8aa4efdc8d1f8d40f506f1d4b13d93b44a10898cf38ea7d',
  600_000:
    '61c136276cff0706297c8aa9c7eeae5ae1e9743668ec08cfe2edcd858cdf0e861609d39d853c24092da4273b34faa8e7836c7b16969d1563907f6507500a2614',
  800_000:
    '4fef7c43ad150b53e598a2f8b5876ad4b0080428afe7d90c3f3cf7a1fb5aca79ecfb34fa1dce4c3efb9f45c7320ab34dc2f51f356479f280c32ab0ef692bc63b',
  1_000_000:
    'a0b63d29e5b19788b6cfbbb56300cab23bfcb4b9ea0a0c0890bffab67764a7b286c660721ce420563c79e90e27a9231baa85de031a6ad25260115abf0d834f1f',
  1_500_000:
    '8a2c13a5d4a36e8d726b14ea763e8739659a4ec32919d6b20d46ec0e39d62babcc3ca7bdac619893608c5cbe8650f1c16baafdf91771082c664b793b97b40cc8',
  2_000_000:
    '906578898bb3e45bbe173679d50ecdd32163339bbe21604991c66dca61ce31e9439e28dcf3b7687889a9194388c1c69cf9ef21ae4d680f64fc6035cadde1f5e4',
  3_000_000:
    '8597c425d12f6665a3c4fcfccf3d1528eec91a9d96bba1054951c1d1945088e5b5844250834e17a85adf3cefcdac34043bb3b85a21b5b2e770918a55ac2c74cf',
  5_000_000:
    '181ddb90f4af03a10870271ec9bf7ee32aa304c42facb8663702de3a8c140a24cdd846b7a659e7476d71b58eb541c0e7382c42cfece96c9a2b53723cab7f2948',
};

type IPbkdf2ActualOutputs = {
  iter: number;
  sha256: {
    defaultBackend?: string;
    fastNative?: string;
    native?: string;
    noble?: string;
  };
  sha512: {
    fastNative?: string;
    native?: string;
    noble?: string;
  };
};

async function pbkdf2Sha512ByRNAes(
  passwordHex: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const key = await RN_AES.pbkdf2(
    passwordHex,
    saltHex,
    iterations,
    AES_GCM_V2_PBKDF2_SHA512_KEY_LENGTH * 8,
    'sha512',
  );
  return key;
}

async function pbkdf2Sha512ByRNFast(
  passwordBytes: Buffer,
  saltBytes: Buffer,
  iterations: number,
): Promise<string> {
  const key = await RN_FAST_PBKDF2.derive(
    bufferUtils.bytesToBase64(passwordBytes),
    bufferUtils.bytesToBase64(saltBytes),
    iterations,
    AES_GCM_V2_PBKDF2_SHA512_KEY_LENGTH,
    'sha-512',
  );
  return bufferUtils.bytesToHex(bufferUtils.base64ToBytes(key));
}

async function pbkdf2Sha512ByNoble(
  passwordBytes: Buffer,
  saltBytes: Buffer,
  iterations: number,
): Promise<string> {
  const key = await nobleP2Async(nobleSha512, passwordBytes, saltBytes, {
    c: iterations,
    dkLen: AES_GCM_V2_PBKDF2_SHA512_KEY_LENGTH,
  });
  return bufferUtils.bytesToHex(Buffer.from(key));
}

function waitForAesGcmV2BenchmarkCooldown() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, AES_GCM_V2_BENCHMARK_COOLDOWN_MS);
  });
}

type IAesGcmV2TableRow = {
  opName: string;
  iter: number | null;
  fastNative: number | undefined;
  noble: number | undefined;
  native: number | undefined;
  // 'primitive' : AES-GCM raw consistency test, no iter.
  // 'selected'  : the iter the user picked in the Select.
  // 'default'   : production default iter (600,000) — always measured.
  // 'both'      : selected === default (single row, treated as selected).
  category: 'primitive' | 'selected' | 'default' | 'both';
};

type IAesGcmV2TableBackend = 'fastNative' | 'noble' | 'native';

function classifyAesGcmV2TaskName(
  name: string,
  defaultIter: number,
): {
  op:
    | 'AES-GCM'
    | 'PBKDF2'
    | 'encryptAsync'
    | 'decryptAsync'
    | 'probe'
    | 'other';
  iter: number | undefined;
  backend: IAesGcmV2TableBackend | '—';
  isProbe: boolean;
} {
  let op:
    | 'AES-GCM'
    | 'PBKDF2'
    | 'encryptAsync'
    | 'decryptAsync'
    | 'probe'
    | 'other' = 'other';
  if (/^encryptAsync\b/.test(name)) op = 'encryptAsync';
  else if (/^decryptAsync\b/.test(name)) op = 'decryptAsync';
  else if (/^PBKDF2\b/.test(name)) op = 'PBKDF2';
  else if (/^AES-GCM\b/.test(name)) op = 'AES-GCM';
  else if (/^actual\b/.test(name)) op = 'probe';

  const isProbe =
    op === 'probe' ||
    /^encryptAsync\s+\S+\s+actual/.test(name) ||
    /^decryptAsync\s+\S+\s+actual/.test(name) ||
    /^PBKDF2\s+default\(/.test(name) ||
    /^encryptAsync\s+(default writes|default iterations|v2 prefix)/.test(
      name,
    ) ||
    /^actual\s+payload|^actual\s+PBKDF2|^actual\s+AES-GCM/.test(name);

  let iter: number | undefined;
  let backend: IAesGcmV2TableBackend | '—' = '—';
  if (op === 'AES-GCM') {
    iter = undefined;
    backend = /^AES-GCM\s+noble\b/.test(name) ? 'noble' : 'native';
  } else if (op === 'PBKDF2') {
    const m = name.match(/\b(\d{4,})\b/);
    if (m) iter = Number(m[1]);
    if (/react-native-fast-pbkdf2|\bfast-native\b/.test(name)) {
      backend = 'fastNative';
    } else if (/\bnoble\b/.test(name)) backend = 'noble';
    else if (/\bnative\b/.test(name) || /\bdefault\b/.test(name))
      backend = 'native';
  } else if (op === 'encryptAsync' || op === 'decryptAsync') {
    const m = name.match(/\b(\d{4,})\b/);
    if (m) iter = Number(m[1]);
    if (/react-native-fast-pbkdf2|\bfast-native\b/.test(name)) {
      backend = 'fastNative';
    } else if (/\bnoble\b/.test(name)) backend = 'noble';
    else if (/\bnative\b/.test(name)) backend = 'native';
    else if (
      /default writes|default iterations|reads v2 payload/.test(name) ||
      /^encryptAsync\s+default\b/.test(name)
    ) {
      backend = 'native';
      if (!iter) iter = defaultIter;
    }
  }
  return { op, iter, backend, isProbe };
}

function buildAesGcmV2TableRows(payload: {
  tasks: { name: string; time: number }[];
  actualEncryptRuns: {
    requestedIterations: number | 'default';
    payloadIterations: number;
    time: number;
    pbkdf2Invocation?: { backend?: string };
  }[];
  selectedIter: number;
  defaultIter: number;
}): IAesGcmV2TableRow[] {
  const pivot: Record<string, Record<string, Record<string, number>>> = {};
  const fill = (
    op: string,
    iter: number | undefined,
    backend: string,
    time: number,
  ) => {
    const iterKey = iter === undefined ? '__no_iter' : String(iter);
    pivot[iterKey] = pivot[iterKey] || {};
    pivot[iterKey][op] = pivot[iterKey][op] || {};
    if (pivot[iterKey][op][backend] === undefined) {
      pivot[iterKey][op][backend] = time;
    }
  };
  for (const t of payload.tasks) {
    const c = classifyAesGcmV2TaskName(t.name, payload.defaultIter);
    if (
      !c.isProbe &&
      ['AES-GCM', 'PBKDF2', 'encryptAsync', 'decryptAsync'].includes(c.op) &&
      c.backend !== '—'
    ) {
      fill(c.op, c.iter, c.backend, t.time);
    }
  }
  for (const run of payload.actualEncryptRuns) {
    const iter =
      run.requestedIterations === 'default'
        ? payload.defaultIter
        : Number(run.requestedIterations);
    let backend: IAesGcmV2TableBackend = 'native';
    if (run.pbkdf2Invocation?.backend === 'react-native-fast-pbkdf2') {
      backend = 'fastNative';
    } else if (run.pbkdf2Invocation?.backend === 'noble') {
      backend = 'noble';
    }
    fill('encryptAsync', iter, backend, run.time);
  }
  const lookup = (
    op: string,
    iter: number | null,
    backend: IAesGcmV2TableBackend,
  ) => pivot[iter === null ? '__no_iter' : String(iter)]?.[op]?.[backend];

  const selectedIsDefault = payload.selectedIter === payload.defaultIter;
  const categorize = (
    iter: number | null,
  ): 'primitive' | 'selected' | 'default' | 'both' => {
    if (iter === null) return 'primitive';
    if (selectedIsDefault && iter === payload.defaultIter) return 'both';
    if (iter === payload.selectedIter) return 'selected';
    return 'default';
  };
  const rowDefs: { opName: string; op: string; iter: number | null }[] = [
    { opName: 'AES-GCM', op: 'AES-GCM', iter: null },
    { opName: 'pbkdf2', op: 'PBKDF2', iter: payload.selectedIter },
    { opName: 'pbkdf2', op: 'PBKDF2', iter: payload.defaultIter },
    { opName: 'encryptAsync', op: 'encryptAsync', iter: payload.selectedIter },
    { opName: 'encryptAsync', op: 'encryptAsync', iter: payload.defaultIter },
    { opName: 'decryptAsync', op: 'decryptAsync', iter: payload.selectedIter },
    { opName: 'decryptAsync', op: 'decryptAsync', iter: payload.defaultIter },
  ];
  const seen = new Set<string>();
  const rows: IAesGcmV2TableRow[] = [];
  for (const r of rowDefs) {
    const k = `${r.op}::${r.iter ?? 'null'}`;
    if (!seen.has(k)) {
      seen.add(k);
      rows.push({
        opName: r.opName,
        iter: r.iter,
        fastNative: lookup(r.op, r.iter, 'fastNative'),
        noble: lookup(r.op, r.iter, 'noble'),
        native: lookup(r.op, r.iter, 'native'),
        category: categorize(r.iter),
      });
    }
  }
  return rows;
}

function AESGcmV2Test() {
  const [resultJson, setResultJson] = useState('');
  const [tableRows, setTableRows] = useState<IAesGcmV2TableRow[]>([]);
  const [actualOutputs, setActualOutputs] =
    useState<IPbkdf2ActualOutputs | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastRunSelectedIter, setLastRunSelectedIter] = useState<number | null>(
    null,
  );
  const [lastRunDefaultTableBackend, setLastRunDefaultTableBackend] =
    useState<IAesGcmV2TableBackend | null>(null);
  const [selectedIter, setSelectedIter] = useState<string>(
    String(AES_GCM_V2_ITER_OPTIONS[0]),
  );
  const [running, setRunning] = useState(false);
  const { copyText } = useClipboard();

  const testAESGcmV2 = async (
    iterationsToRun: number[] = [AES_GCM_V2_DEFAULT_ITER],
  ) => {
    try {
      const { decryptAsync, decryptAsyncWithMetadata, encryptAsync } =
        await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const data = Buffer.from('onekey-aes-gcm-v2-gallery-test', 'utf8');
      const key = Buffer.from(
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
        'hex',
      );
      const nonce = Buffer.from('202122232425262728292a2b', 'hex');
      const aad = Buffer.from('onekey-gallery-aad-v1', 'utf8');
      const password = 'onekey-gallery-password';
      const v2MagicText = '1K_ENC_V2';
      const v2MagicHex = Buffer.from(v2MagicText, 'utf8').toString('hex');
      const legacyGcmMagicText = appCrypto.consts.AES_GCM_ENCRYPTION_MAGIC;
      const legacyGcmMagicHex = Buffer.from(
        legacyGcmMagicText,
        'utf8',
      ).toString('hex');
      const defaultPbkdf2Backend =
        appCrypto.pbkdf2.getPbkdf2BackendForCurrentPlatform();
      const defaultAesGcmBackend =
        appCrypto.aesGcm.getAesGcmBackendForCurrentPlatform();
      const expectedDefaultIterations =
        appCrypto.consts.PBKDF2_CURRENT_NUM_OF_ITERATIONS;
      const actualEncryptRuns: Array<{
        aesGcmInvocation: ReturnType<
          typeof appCrypto.aesGcm.getLastAesGcmInvocation
        >;
        pbkdf2Invocation: ReturnType<
          typeof appCrypto.pbkdf2.getLastPbkdf2Invocation
        >;
        payloadHeaderHex?: string;
        payloadHeaderKind:
          | 'legacy-cbc-no-magic-header'
          | 'legacy-gcm'
          | 'unknown'
          | 'v2';
        payloadHeaderText?: string;
        payloadIterations: number;
        payloadVersion: string;
        requestedIterations: number | 'default';
        time: number;
      }> = [];
      let shouldCooldownBeforeBenchmarkTask = false;
      const waitBeforeBenchmarkTask = async () => {
        if (!shouldCooldownBeforeBenchmarkTask) {
          shouldCooldownBeforeBenchmarkTask = true;
          return;
        }
        await waitForAesGcmV2BenchmarkCooldown();
      };

      const getKnownPayloadHeader = (encryptedHex: string) => {
        if (encryptedHex.startsWith(v2MagicHex)) {
          return {
            payloadHeaderHex: v2MagicHex,
            payloadHeaderKind: 'v2' as const,
            payloadHeaderText: v2MagicText,
          };
        }
        if (encryptedHex.startsWith(legacyGcmMagicHex)) {
          return {
            payloadHeaderHex: legacyGcmMagicHex,
            payloadHeaderKind: 'legacy-gcm' as const,
            payloadHeaderText: legacyGcmMagicText,
          };
        }
        return {
          payloadHeaderKind: 'legacy-cbc-no-magic-header' as const,
        };
      };

      const encryptWithActualProbe = async (iterations?: number) => {
        const debugCryptoProbeId = `crypto-gallery-${Date.now()}-${
          actualEncryptRuns.length
        }`;
        appCrypto.pbkdf2.clearLastPbkdf2Invocation();
        appCrypto.aesGcm.clearLastAesGcmInvocation();
        appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        appCrypto.aesGcm.clearAesGcmInvocationByProbeId(debugCryptoProbeId);
        const start = Date.now();
        const encrypted = await encryptAsync({
          password,
          data,
          allowRawPassword: true,
          ...(iterations ? { iterations } : undefined),
          debugCryptoProbeId,
        });
        const time = Date.now() - start;
        const pbkdf2Invocation =
          appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(debugCryptoProbeId);
        const aesGcmInvocation =
          appCrypto.aesGcm.getAesGcmInvocationByProbeId(debugCryptoProbeId);
        const encryptedHex = bufferUtils.bytesToHex(encrypted);
        const payloadHeader = getKnownPayloadHeader(encryptedHex);
        const metadata = await decryptAsyncWithMetadata({
          password,
          data: encrypted,
          allowRawPassword: true,
        });
        const requestedIterations: number | 'default' = iterations ?? 'default';
        const actualRun = {
          aesGcmInvocation,
          pbkdf2Invocation,
          ...payloadHeader,
          payloadIterations: metadata.iterations,
          payloadVersion: metadata.version,
          requestedIterations,
          time,
        };
        actualEncryptRuns.push(actualRun);
        appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        appCrypto.aesGcm.clearAesGcmInvocationByProbeId(debugCryptoProbeId);
        return {
          ...actualRun,
          encrypted,
          encryptedHex,
          metadata,
        };
      };

      const nobleEncrypted = appCrypto.aesGcm.aesGcmEncryptByNoble({
        nonce,
        key,
        data,
        aad,
      });

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(nobleEncrypted),
          name: 'AES-GCM default wrapper matches noble',
          fn: () =>
            appCrypto.aesGcm.aesGcmEncrypt({
              nonce,
              key,
              data,
              aad,
            }),
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(nobleEncrypted),
          name: 'AES-GCM native wrapper matches noble',
          fn: () =>
            appCrypto.aesGcm.aesGcmEncryptByRNAes({
              nonce,
              key,
              data,
              aad,
            }),
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(data),
          name: 'AES-GCM native decrypt',
          fn: () =>
            appCrypto.aesGcm.aesGcmDecryptByRNAes({
              nonce,
              key,
              data: nobleEncrypted,
              aad,
            }),
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(nobleEncrypted),
          name: 'AES-GCM noble encrypt',
          fn: () =>
            appCrypto.aesGcm.aesGcmEncryptByNoble({
              nonce,
              key,
              data,
              aad,
            }),
        }),
      );

      // Boundary vectors aligned with upstream PR
      // https://github.com/OneKeyHQ/app-modules/pull/55 Codex review +
      // strict empty-string guard rolled out in commit 75031eb: empty
      // plaintext must be rejected at the JS invoke check, native must
      // reject empty AAD, and both backends must reject truncated /
      // tampered ciphertexts. These are the cases jest-on-node alone
      // cannot fully exercise because they cross into native CryptoKit
      // and Android Cipher.
      const emptyData = Buffer.alloc(0);
      const emptyAad = Buffer.alloc(0);
      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM noble rejects empty plaintext',
          fn: () => {
            try {
              appCrypto.aesGcm.aesGcmEncryptByNoble({
                nonce,
                key,
                data: emptyData,
                aad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM native rejects empty plaintext',
          fn: async () => {
            try {
              await appCrypto.aesGcm.aesGcmEncryptByRNAes({
                nonce,
                key,
                data: emptyData,
                aad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      // Empty AAD is rejected at the JS invoke check so noble and native
      // stay in lockstep across platforms (otherwise desktop/web on noble
      // would silently accept an empty AAD that mobile native rejects).
      // Both backends must surface the same REJECTED result.
      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM noble rejects empty AAD',
          fn: () => {
            try {
              appCrypto.aesGcm.aesGcmEncryptByNoble({
                nonce,
                key,
                data,
                aad: emptyAad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM native rejects empty AAD',
          fn: async () => {
            try {
              await appCrypto.aesGcm.aesGcmEncryptByRNAes({
                nonce,
                key,
                data,
                aad: emptyAad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      // 8-byte ciphertext is shorter than the 16-byte GCM tag. Both
      // backends must reject; otherwise tag verification could be skipped.
      const shortCiphertext = Buffer.from('0011223344556677', 'hex');
      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM native rejects ciphertext shorter than tag',
          fn: async () => {
            try {
              await appCrypto.aesGcm.aesGcmDecryptByRNAes({
                nonce,
                key,
                data: shortCiphertext,
                aad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM noble rejects ciphertext shorter than tag',
          fn: () => {
            try {
              appCrypto.aesGcm.aesGcmDecryptByNoble({
                nonce,
                key,
                data: shortCiphertext,
                aad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      // Tampered AAD must fail tag verification, even when the ciphertext
      // bytes are otherwise valid.
      const wrongAad = Buffer.from('onekey-gallery-aad-WRONG', 'utf8');
      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM native rejects decrypt with wrong AAD',
          fn: async () => {
            try {
              await appCrypto.aesGcm.aesGcmDecryptByRNAes({
                nonce,
                key,
                data: nobleEncrypted,
                aad: wrongAad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'REJECTED',
          name: 'AES-GCM noble rejects decrypt with wrong AAD',
          fn: () => {
            try {
              appCrypto.aesGcm.aesGcmDecryptByNoble({
                nonce,
                key,
                data: nobleEncrypted,
                aad: wrongAad,
              });
              return 'NOT_REJECTED';
            } catch {
              return 'REJECTED';
            }
          },
        }),
      );

      const hashedPassword = await appCrypto.hash.sha256(
        Buffer.from(password, 'utf8'),
      );
      const salt = Buffer.from(
        '303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f',
        'hex',
      );

      // Always include the production default iteration count so the report
      // shows a real number for `pbkdf2 600,000 native` / `encryptAsync
      // 600,000 native` / etc. (the test function always probes the default
      // path at the end anyway). Noble at 600k+ is gated below.
      const NOBLE_KDF_MAX_ITER = 10_000;
      const userSelectedIter = iterationsToRun[0] ?? expectedDefaultIterations;
      const effectiveIterations = Array.from(
        new Set([...iterationsToRun, expectedDefaultIterations]),
      ).toSorted((a, b) => a - b);

      const capturedOutputs: IPbkdf2ActualOutputs = {
        iter: userSelectedIter,
        sha256: {},
        sha512: {},
      };
      const captureIfSelectedIter = (
        bucket: 'sha256' | 'sha512',
        backend: 'defaultBackend' | 'fastNative' | 'native' | 'noble',
        iter: number,
        hex: string | undefined,
      ) => {
        if (iter !== userSelectedIter || !hex) return;
        const target = capturedOutputs[bucket] as Record<
          string,
          string | undefined
        >;
        target[backend] = Buffer.from(hex, 'hex').toString('base64');
      };
      const hashedPasswordHex = bufferUtils.bytesToHex(hashedPassword);
      const saltHex = bufferUtils.bytesToHex(salt);

      for (const iterations of effectiveIterations) {
        await waitBeforeBenchmarkTask();
        const defaultKey = await appCrypto.pbkdf2.pbkdf2({
          password: hashedPassword,
          salt,
          iterations,
        });

        // Pin every backend at this iter to a canonical third-party hex
        // (Node crypto / noble pre-computed offline). Falls back to
        // intra-device consistency if a new iter is added without updating
        // AES_GCM_V2_PBKDF2_EXPECTED.
        const canonicalHex: string | undefined =
          AES_GCM_V2_PBKDF2_EXPECTED[iterations];
        const expectedHex = canonicalHex ?? bufferUtils.bytesToHex(defaultKey);
        captureIfSelectedIter(
          'sha256',
          'defaultBackend',
          iterations,
          bufferUtils.bytesToHex(defaultKey),
        );

        // Marked `actual ...` so the classifier treats it as a probe and
        // excludes it from the timing pivot. It is a pure correctness check
        // that re-hashes a pre-computed buffer — its time would otherwise
        // pollute the native column (first-write-wins in pivot).
        tasks.push(
          await runAppCryptoTestTask({
            expect: expectedHex,
            name: `actual PBKDF2 canonical default(${defaultPbkdf2Backend}) ${iterations}`,
            fn: () => bufferUtils.bytesToHex(defaultKey),
          }),
        );

        await waitBeforeBenchmarkTask();
        tasks.push(
          await runAppCryptoTestTask({
            expect: expectedHex,
            name: `PBKDF2 default(${defaultPbkdf2Backend}) ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2({
                password: hashedPassword,
                salt,
                iterations,
              }),
          }),
        );

        await waitBeforeBenchmarkTask();
        const nativeTask = await runAppCryptoTestTask({
          expect: expectedHex,
          name: `PBKDF2 native ${iterations}`,
          fn: () =>
            appCrypto.pbkdf2.pbkdf2ByRNAes({
              password: hashedPassword,
              salt,
              iterations,
            }),
        });
        tasks.push(nativeTask);
        captureIfSelectedIter(
          'sha256',
          'native',
          iterations,
          nativeTask.result,
        );

        if (platformEnv.isNative) {
          await waitBeforeBenchmarkTask();
          const fastTask = await runAppCryptoTestTask({
            expect: expectedHex,
            name: `PBKDF2 fast-native ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2ByRNFastPbkdf2({
                password: hashedPassword,
                salt,
                iterations,
              }),
          });
          tasks.push(fastTask);
          captureIfSelectedIter(
            'sha256',
            'fastNative',
            iterations,
            fastTask.result,
          );
        }

        if (iterations <= NOBLE_KDF_MAX_ITER) {
          await waitBeforeBenchmarkTask();
          const nobleTask = await runAppCryptoTestTask({
            expect: expectedHex,
            name: `PBKDF2 noble ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2ByNoble({
                password: hashedPassword,
                salt,
                iterations,
              }),
          });
          tasks.push(nobleTask);
          captureIfSelectedIter(
            'sha256',
            'noble',
            iterations,
            nobleTask.result,
          );
        }

        // SHA-512 backends (TON / BIP39 path protection). All names are
        // `actual ...` so they bypass the timing pivot — correctness is
        // still recorded via tasks[] and the JSON result blob, and the
        // selected-iter captures feed the "actual outputs" panel above the
        // table. Skip when no canonical vector is pinned (defensive: future
        // iter additions should not silently break the assertion).
        const sha512Canonical: string | undefined =
          AES_GCM_V2_PBKDF2_SHA512_EXPECTED[iterations];
        if (sha512Canonical) {
          await waitBeforeBenchmarkTask();
          const nativeSha512Task = await runAppCryptoTestTask({
            expect: sha512Canonical,
            name: `actual PBKDF2-SHA512 native ${iterations}`,
            fn: () =>
              pbkdf2Sha512ByRNAes(hashedPasswordHex, saltHex, iterations),
          });
          tasks.push(nativeSha512Task);
          captureIfSelectedIter(
            'sha512',
            'native',
            iterations,
            nativeSha512Task.result,
          );

          if (platformEnv.isNative) {
            await waitBeforeBenchmarkTask();
            const fastSha512Task = await runAppCryptoTestTask({
              expect: sha512Canonical,
              name: `actual PBKDF2-SHA512 fast-native ${iterations}`,
              fn: () => pbkdf2Sha512ByRNFast(hashedPassword, salt, iterations),
            });
            tasks.push(fastSha512Task);
            captureIfSelectedIter(
              'sha512',
              'fastNative',
              iterations,
              fastSha512Task.result,
            );
          }

          if (iterations <= NOBLE_KDF_MAX_ITER) {
            await waitBeforeBenchmarkTask();
            const nobleSha512Task = await runAppCryptoTestTask({
              expect: sha512Canonical,
              name: `actual PBKDF2-SHA512 noble ${iterations}`,
              fn: () => pbkdf2Sha512ByNoble(hashedPassword, salt, iterations),
            });
            tasks.push(nobleSha512Task);
            captureIfSelectedIter(
              'sha512',
              'noble',
              iterations,
              nobleSha512Task.result,
            );
          }
        }

        await waitBeforeBenchmarkTask();
        const encryptedByIterations = await encryptWithActualProbe(iterations);

        tasks.push(
          await runAppCryptoTestTask({
            expect: 'true',
            name: `encryptAsync v2 prefix ${iterations}`,
            fn: () =>
              String(encryptedByIterations.encryptedHex.startsWith(v2MagicHex)),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: String(iterations),
            name: `actual payload iterations ${iterations}`,
            fn: () => String(encryptedByIterations.metadata.iterations),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: String(iterations),
            name: `actual PBKDF2 probe iterations ${iterations}`,
            fn: () =>
              String(
                encryptedByIterations.pbkdf2Invocation?.iterations ?? 'missing',
              ),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: defaultPbkdf2Backend,
            name: `actual PBKDF2 probe backend ${iterations}`,
            fn: () =>
              encryptedByIterations.pbkdf2Invocation?.backend ?? 'missing',
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: defaultAesGcmBackend,
            name: `actual AES-GCM probe backend ${iterations}`,
            fn: () =>
              encryptedByIterations.aesGcmInvocation?.backend ?? 'missing',
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: 'encrypt',
            name: `actual AES-GCM probe operation ${iterations}`,
            fn: () =>
              encryptedByIterations.aesGcmInvocation?.operation ?? 'missing',
          }),
        );

        // Backend matrix: cover encryptAsync + decryptAsync for every iter
        // that appears in the table. Native/fast-native use concrete PBKDF2
        // backends so the DevSettings fast switch cannot alter these timings.
        // The native path runs at any iter; the noble path is gated by
        // NOBLE_KDF_MAX_ITER because noble PBKDF2 above ~10k iterations
        // freezes the device for tens of seconds.
        const backendConfigs = [
          {
            enabled: true,
            expectedGcmBackend: 'react-native-aes-crypto',
            expectedPbkdf2Backend: 'react-native-aes-crypto',
            gcmBackend: 'native',
            kdfBackend: 'react-native-aes-crypto',
            label: 'native',
          },
          {
            enabled: platformEnv.isNative,
            expectedGcmBackend: 'react-native-aes-crypto',
            expectedPbkdf2Backend: 'react-native-fast-pbkdf2',
            gcmBackend: 'native',
            kdfBackend: 'react-native-fast-pbkdf2',
            label: 'fast-native',
          },
          {
            enabled: iterations <= NOBLE_KDF_MAX_ITER,
            expectedGcmBackend: 'noble',
            expectedPbkdf2Backend: 'noble',
            gcmBackend: 'noble',
            kdfBackend: 'noble',
            label: 'noble',
          },
        ] as const;
        for (const backendConfig of backendConfigs.filter((b) => b.enabled)) {
          const encProbeId = `crypto-gallery-mx-${backendConfig.label}-enc-${iterations}-${Date.now()}-${tasks.length}`;
          appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(encProbeId);
          appCrypto.aesGcm.clearAesGcmInvocationByProbeId(encProbeId);
          let encryptedByBackend: Buffer | undefined;
          await waitBeforeBenchmarkTask();
          tasks.push(
            await runAppCryptoTestTask({
              expect: 'true',
              name: `encryptAsync ${backendConfig.label} ${iterations}`,
              fn: async () => {
                encryptedByBackend = await encryptAsync({
                  password,
                  data,
                  allowRawPassword: true,
                  iterations,
                  debugCryptoProbeId: encProbeId,
                  kdfBackend: backendConfig.kdfBackend,
                  gcmBackend: backendConfig.gcmBackend,
                });
                return String(
                  bufferUtils
                    .bytesToHex(encryptedByBackend)
                    .startsWith(v2MagicHex),
                );
              },
            }),
          );
          const encPbkdf2 =
            appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(encProbeId);
          const encAesGcm =
            appCrypto.aesGcm.getAesGcmInvocationByProbeId(encProbeId);
          tasks.push(
            await runAppCryptoTestTask({
              expect: backendConfig.expectedPbkdf2Backend,
              name: `encryptAsync ${backendConfig.label} actual pbkdf2 backend ${iterations}`,
              fn: () => encPbkdf2?.backend ?? 'missing',
            }),
          );
          tasks.push(
            await runAppCryptoTestTask({
              expect: backendConfig.expectedGcmBackend,
              name: `encryptAsync ${backendConfig.label} actual aesGcm backend ${iterations}`,
              fn: () => encAesGcm?.backend ?? 'missing',
            }),
          );
          appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(encProbeId);
          appCrypto.aesGcm.clearAesGcmInvocationByProbeId(encProbeId);

          if (encryptedByBackend) {
            const decProbeId = `crypto-gallery-mx-${backendConfig.label}-dec-${iterations}-${Date.now()}-${tasks.length}`;
            appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(decProbeId);
            appCrypto.aesGcm.clearAesGcmInvocationByProbeId(decProbeId);
            await waitBeforeBenchmarkTask();
            tasks.push(
              await runAppCryptoTestTask({
                expect: bufferUtils.bytesToHex(data),
                name: `decryptAsync ${backendConfig.label} ${iterations}`,
                fn: () =>
                  decryptAsync({
                    password,
                    data: encryptedByBackend!,
                    allowRawPassword: true,
                    debugCryptoProbeId: decProbeId,
                    kdfBackend: backendConfig.kdfBackend,
                    gcmBackend: backendConfig.gcmBackend,
                  }),
              }),
            );
            const decPbkdf2 =
              appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(decProbeId);
            const decAesGcm =
              appCrypto.aesGcm.getAesGcmInvocationByProbeId(decProbeId);
            tasks.push(
              await runAppCryptoTestTask({
                expect: backendConfig.expectedPbkdf2Backend,
                name: `decryptAsync ${backendConfig.label} actual pbkdf2 backend ${iterations}`,
                fn: () => decPbkdf2?.backend ?? 'missing',
              }),
            );
            tasks.push(
              await runAppCryptoTestTask({
                expect: backendConfig.expectedGcmBackend,
                name: `decryptAsync ${backendConfig.label} actual aesGcm backend ${iterations}`,
                fn: () => decAesGcm?.backend ?? 'missing',
              }),
            );
            appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(decProbeId);
            appCrypto.aesGcm.clearAesGcmInvocationByProbeId(decProbeId);
          }
        }
      }

      await waitBeforeBenchmarkTask();
      const encryptedV2 = await encryptWithActualProbe();

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'true',
          name: 'encryptAsync default writes 1K_ENC_V2',
          fn: () => String(encryptedV2.encryptedHex.startsWith(v2MagicHex)),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: String(expectedDefaultIterations),
          name: 'encryptAsync default iterations',
          fn: () => String(encryptedV2.metadata.iterations),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: String(expectedDefaultIterations),
          name: 'actual default PBKDF2 probe iterations',
          fn: () =>
            String(encryptedV2.pbkdf2Invocation?.iterations ?? 'missing'),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: defaultPbkdf2Backend,
          name: 'actual default PBKDF2 probe backend',
          fn: () => encryptedV2.pbkdf2Invocation?.backend ?? 'missing',
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: defaultAesGcmBackend,
          name: 'actual default AES-GCM probe backend',
          fn: () => encryptedV2.aesGcmInvocation?.backend ?? 'missing',
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'encrypt',
          name: 'actual default AES-GCM probe operation',
          fn: () => encryptedV2.aesGcmInvocation?.operation ?? 'missing',
        }),
      );

      await waitBeforeBenchmarkTask();
      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(data),
          name: 'decryptAsync reads v2 payload',
          fn: () =>
            decryptAsync({
              password,
              data: encryptedV2.encrypted,
              allowRawPassword: true,
            }),
        }),
      );

      const resultPayload = stringUtils.stableStringify(
        {
          platform: {
            isNative: platformEnv.isNative,
            isNativeIOS: platformEnv.isNativeIOS,
            isNativeAndroid: platformEnv.isNativeAndroid,
          },
          actualEncryptRuns,
          defaultPath: {
            pbkdf2: defaultPbkdf2Backend,
            aesGcm: defaultAesGcmBackend,
            iterations: expectedDefaultIterations,
          },
          v2MagicHex,
          v2MagicText,
          legacyGcmMagicHex,
          legacyGcmMagicText,
          encryptedV2Header: getKnownPayloadHeader(encryptedV2.encryptedHex),
          tasks,
        },
        stringUtils.STRINGIFY_REPLACER.bufferToHex,
        2,
      );
      setResultJson(resultPayload);
      setLastRunSelectedIter(userSelectedIter);
      setLastRunDefaultTableBackend(() => {
        const actualDefaultPbkdf2Backend =
          encryptedV2.pbkdf2Invocation?.backend;
        if (actualDefaultPbkdf2Backend === 'react-native-fast-pbkdf2') {
          return 'fastNative';
        }
        if (actualDefaultPbkdf2Backend === 'react-native-aes-crypto') {
          return 'native';
        }
        if (actualDefaultPbkdf2Backend === 'noble') {
          return 'noble';
        }
        return null;
      });
      setTableRows(
        buildAesGcmV2TableRows({
          tasks: tasks.map((t) => ({ name: t.name, time: t.time })),
          actualEncryptRuns,
          selectedIter: userSelectedIter,
          defaultIter: expectedDefaultIterations,
        }),
      );
      setActualOutputs(capturedOutputs);
      setErrorMessage('');

      const allPassed = tasks.every(
        (t) => t.isCorrect === AppCryptoTestEmoji.isCorrect,
      );
      if (allPassed) {
        Toast.success({
          title: 'AES-GCM v2 test passed',
        });
      } else {
        Toast.error({
          title: 'AES-GCM v2 test failed',
        });
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      setResultJson('');
      setTableRows([]);
      setActualOutputs(null);
      setLastRunDefaultTableBackend(null);
      Toast.error({
        title: `AES-GCM v2 failed: ${(error as Error).message}`,
      });
    }
  };

  const selectedIterNumber = Number(selectedIter);
  const fmtCell = (v: number | undefined) =>
    v === undefined ? '—' : `${v} ms`;
  // Tiered color for ms values:
  //   undefined         → muted '—'
  //   ≤ 10 ms           → success (green)
  //   < 100 ms          → default text
  //   100 .. < 500 ms   → caution (yellow/orange)
  //   ≥ 500 ms          → critical (red)
  const msColor = (v: number | undefined): string => {
    if (v === undefined) return '$textDisabled';
    if (v <= 10) return '$textSuccess';
    if (v < 100) return '$text';
    if (v < 500) return '$textCaution';
    return '$textCritical';
  };
  const formatBase64AsShortHex = (value: string) => {
    const hex = Buffer.from(value, 'base64').toString('hex');
    return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
  };
  const renderBackendHeader = (
    backend: IAesGcmV2TableBackend,
    title: string,
  ) => (
    <YStack alignItems="flex-end">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {title}
      </SizableText>
      {lastRunDefaultTableBackend === backend ? (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          (default)
        </SizableText>
      ) : null}
    </YStack>
  );
  return (
    <PartContainer title="AES-GCM v2 Test">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Select
          items={AES_GCM_V2_ITER_OPTIONS.map((iter) => ({
            value: String(iter),
            label: `${iter.toLocaleString()} iterations`,
          }))}
          value={selectedIter}
          onChange={setSelectedIter}
          title="PBKDF2 iterations"
          renderTrigger={({ label, onPress, disabled }) => (
            <Button onPress={onPress} disabled={disabled}>
              {label || `${selectedIterNumber.toLocaleString()} iterations`}
            </Button>
          )}
        />
        <Button
          variant="primary"
          loading={running}
          disabled={running}
          onPress={async () => {
            setRunning(true);
            try {
              await testAESGcmV2([selectedIterNumber]);
            } finally {
              setRunning(false);
            }
          }}
        >
          Run Test
        </Button>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        Will run iter={selectedIterNumber.toLocaleString()} AND iter=
        {AES_GCM_V2_DEFAULT_ITER.toLocaleString()} (production default is always
        measured). Fast/native timings force concrete backends and ignore the
        DevSettings fast switch. Fast native runs on Android/iOS. Noble is
        skipped for iter &gt; 10,000. Benchmark tasks wait{' '}
        {AES_GCM_V2_BENCHMARK_COOLDOWN_MS}ms between runs.
      </SizableText>

      {actualOutputs &&
      (Object.values(actualOutputs.sha256).some(Boolean) ||
        Object.values(actualOutputs.sha512).some(Boolean)) ? (
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$2"
          overflow="hidden"
        >
          <XStack
            backgroundColor="$bgSubdued"
            paddingVertical="$2"
            paddingHorizontal="$3"
            borderBottomWidth={1}
            borderBottomColor="$border"
          >
            <SizableText size="$bodySmMedium" color="$textSubdued">
              PBKDF2 actual output @ iter ={' '}
              {actualOutputs.iter.toLocaleString()} (base64 + hex preview,
              cross-device compare)
            </SizableText>
          </XStack>
          {(
            [
              ['sha256', 'noble', 'sha-256 noble'],
              ['sha256', 'native', 'sha-256 native (aes-crypto)'],
              ['sha256', 'fastNative', 'sha-256 fast (fast-pbkdf2)'],
              ['sha256', 'defaultBackend', 'sha-256 default backend'],
              ['sha512', 'noble', 'sha-512 noble'],
              ['sha512', 'native', 'sha-512 native (aes-crypto)'],
              ['sha512', 'fastNative', 'sha-512 fast (fast-pbkdf2)'],
            ] as const
          ).map(([bucket, backend, label]) => {
            const value = (
              actualOutputs[bucket] as Record<string, string | undefined>
            )[backend];
            if (!value) return null;
            return (
              <XStack
                key={`${bucket}-${backend}`}
                paddingVertical="$1.5"
                paddingHorizontal="$3"
                gap="$2"
                alignItems="flex-start"
              >
                <Stack flexBasis="40%">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {label}
                  </SizableText>
                </Stack>
                <Stack flex={1}>
                  <SizableText size="$bodySm" selectable>
                    {value}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued" selectable>
                    hex {formatBase64AsShortHex(value)}
                  </SizableText>
                </Stack>
              </XStack>
            );
          })}
          <XStack
            paddingVertical="$2"
            paddingHorizontal="$3"
            borderTopWidth={1}
            borderTopColor="$borderSubdued"
          >
            <Button
              size="small"
              onPress={() => {
                copyText(JSON.stringify(actualOutputs, null, 2));
              }}
            >
              Copy actual outputs
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {tableRows.length > 0 ? (
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$2"
          overflow="hidden"
        >
          <XStack
            backgroundColor="$bgSubdued"
            paddingVertical="$2"
            paddingHorizontal="$3"
            borderBottomWidth={1}
            borderBottomColor="$border"
          >
            <Stack flexBasis="40%">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                operation
              </SizableText>
            </Stack>
            <Stack flexBasis="20%" alignItems="flex-end">
              {renderBackendHeader('noble', 'noble')}
            </Stack>
            <Stack flexBasis="20%" alignItems="flex-end">
              {renderBackendHeader('fastNative', 'fast')}
            </Stack>
            <Stack flexBasis="20%" alignItems="flex-end">
              {renderBackendHeader('native', 'native')}
            </Stack>
          </XStack>
          {tableRows.map((row, idx) => {
            // Only the iter number for the production default row (600,000)
            // gets primary color — the op name and ms values render exactly
            // like every other row.
            const isDefaultIterRow = row.category === 'default';
            return (
              <XStack
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                paddingVertical="$2.5"
                paddingHorizontal="$3"
                borderBottomWidth={idx === tableRows.length - 1 ? 0 : 1}
                borderBottomColor="$borderSubdued"
                alignItems="center"
              >
                <Stack flexBasis="40%">
                  <SizableText size="$bodyMd">{row.opName}</SizableText>
                  {row.iter !== null ? (
                    <SizableText
                      size="$bodySmMedium"
                      color={
                        isDefaultIterRow ? '$textInteractive' : '$textSubdued'
                      }
                    >
                      {row.iter.toLocaleString()}
                    </SizableText>
                  ) : null}
                </Stack>
                <Stack flexBasis="20%" alignItems="flex-end">
                  <SizableText size="$bodyMd" color={msColor(row.noble)}>
                    {fmtCell(row.noble)}
                  </SizableText>
                </Stack>
                <Stack flexBasis="20%" alignItems="flex-end">
                  <SizableText size="$bodyMd" color={msColor(row.fastNative)}>
                    {fmtCell(row.fastNative)}
                  </SizableText>
                </Stack>
                <Stack flexBasis="20%" alignItems="flex-end">
                  <SizableText size="$bodyMd" color={msColor(row.native)}>
                    {fmtCell(row.native)}
                  </SizableText>
                </Stack>
              </XStack>
            );
          })}
        </YStack>
      ) : null}

      {resultJson ? (
        <Button
          size="small"
          onPress={() => {
            copyText(resultJson);
          }}
        >
          Copy JSON result
        </Button>
      ) : null}

      {lastRunSelectedIter !== null && tableRows.length > 0 ? (
        <SizableText size="$bodySm" color="$textSubdued">
          Last run: iter={lastRunSelectedIter.toLocaleString()} (production
          default {AES_GCM_V2_DEFAULT_ITER.toLocaleString()} always included).
        </SizableText>
      ) : null}

      {errorMessage ? (
        <SizableText size="$bodyMd" color="$textCritical">
          Error: {errorMessage}
        </SizableText>
      ) : null}
    </PartContainer>
  );
}

/**
 * Test crypto.subtle polyfill
 * This polyfill is required for Supabase Auth PKCE flow on React Native
 * @see packages/shared/src/appCrypto/cryptoSubtlePolyfill.js
 */
function CryptoSubtlePolyfillTest() {
  const [result, setResult] = useState('');

  const testCryptoSubtle = async () => {
    try {
      const tasks: IRunAppCryptoTestTaskResult[] = [];

      // Test 1: Check if crypto.subtle exists
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'true',
          name: 'crypto.subtle exists',
          fn: async () => {
            return String(
              typeof crypto !== 'undefined' &&
                typeof crypto.subtle !== 'undefined' &&
                typeof crypto.subtle.digest === 'function',
            );
          },
        }),
      );

      // Test 2: SHA-256 digest test
      // Hash of "hello" in SHA-256 should be:
      // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const testData = new TextEncoder().encode('hello');
      const expectedSha256 =
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha256,
          name: 'crypto.subtle.digest(SHA-256)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-256', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 3: SHA-512 digest test
      // Hash of "hello" in SHA-512
      const expectedSha512 =
        '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha512,
          name: 'crypto.subtle.digest(SHA-512)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-512', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 4: SHA-1 digest test
      // Hash of "hello" in SHA-1
      const expectedSha1 = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha1,
          name: 'crypto.subtle.digest(SHA-1)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-1', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 5: Supabase PKCE simulation test
      // Simulate the actual PKCE flow that Supabase uses
      const codeVerifier = 'test-code-verifier-for-pkce-flow';
      const verifierData = new TextEncoder().encode(codeVerifier);

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'f0c2f8b2aad90ad913c0561953b38bf3d435f59b5e4ef24eebc6605b0b444907',
          name: 'crypto.subtle.digest(PKCE simulation)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest(
              'SHA-256',
              verifierData,
            );
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );

      const allPassed = tasks.every(
        (t) => t.isCorrect === AppCryptoTestEmoji.isCorrect,
      );
      if (allPassed) {
        Toast.success({
          title: 'crypto.subtle polyfill test passed',
        });
      } else {
        Toast.error({
          title: 'crypto.subtle polyfill test failed',
        });
      }
    } catch (error) {
      setResult(`Error: ${(error as Error).message}`);
      Toast.error({
        title: `crypto.subtle test failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="crypto.subtle Polyfill Test">
      <Button variant="primary" onPress={testCryptoSubtle}>
        Test crypto.subtle Polyfill
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function SecretFunctionsTest() {
  const [result, setResult] = useState('');

  const testSecretFunctions = async () => {
    try {
      const {
        batchGetPublicKeys,
        decodeSensitiveTextAsync,
        decryptAsync,
        encodeSensitiveTextAsync,
        encryptAsync,
        encryptRevealableSeed,
        generateRootFingerprintHexAsync,
        mnemonicFromEntropyAsync,
        mnemonicToRevealableSeed,
        mnemonicToSeedAsync,
      } = await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];

      const testPasswordRaw = 'password123';
      const encodeSensitiveTextKey =
        'ENCODE_KEY::755174C1-6480-401A-8C3D-84ADB2E0C376::cf6e2e1c-e53b-431e-a6e4-3f27c9a7ac0b';

      let customSalt = bufferUtils.toBuffer(
        '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87eb',
      );
      let customIv = bufferUtils.toBuffer('ad76f31087e49bbc59ac0f08d679e4c0');
      // const customSalt = crypto.randomBytes(PBKDF2_SALT_LENGTH);
      // const customIv = crypto.randomBytes(AES256_IV_LENGTH);

      let testPasswordEncoded = '';
      testPasswordEncoded = await encodeSensitiveTextAsync({
        text: testPasswordRaw,
        key: encodeSensitiveTextKey,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '⚠️ Wrong password',
          name: 'decodeSensitiveTextAsync(Wrong password) 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText:
                'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::91bd9aee6525991dbde19d4d51f7265904d5db1592c6b0dfcdcc6ecfddd447883b2797a16926ddbea96c80acaaf99c0bee98282c0f966938095e1369da781ca7',
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveTextAsync 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText: testPasswordEncoded,
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveTextAsync(2) 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText:
                'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::4148c9fc99fa20bb83d3c925b6b94f9cd8e1ba45e21ddfc40b9d3627b17adcc9dbaf4805799fd7da5b581ea70bd31b7876d2bbf6a53d6956c2afb17adbbc5f2f',
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      // console.log('testPasswordEncoded', {
      //   encryptAsyncTestResult: bufferUtils.bytesToHex(encryptAsyncTestResult),
      //   // customIv: bufferUtils.bytesToHex(customIv),
      //   // customIvLength: customIv.length,
      //   // customSalt: bufferUtils.bytesToHex(customSalt),
      //   // customSaltLength: customSalt.length,
      //   testPasswordRaw,
      //   testPasswordEncoded,
      //   testPasswordDecoded,
      //   testPasswordDecoded2,
      //   // testPasswordDecoded3: testPasswordDecoded3 || '---',
      // });

      let testPassword = '';
      testPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        });

      let rawTestPassword = '';
      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveText 😃',
          fn: async () => {
            rawTestPassword =
              await backgroundApiProxy.servicePassword.decodeSensitiveText({
                encodedText: testPassword,
              });
            return rawTestPassword;
          },
        }),
      );

      const testSeed: IBip39RevealableSeed = {
        entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
        seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      };
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      let encryptedSeed = '';
      encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      const batchGetPublicKeysExpect =
        '039963f5256af9f48d9d4a340e352f8cec3719b48d9f8514a5495785bb7d7bdac3';
      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useWebembedApi) 😃',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useWebembedApi, byAsyncSubCalls) 😃',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              byAsyncSubCalls: true,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useRnJsCrypto)',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              useWebembedApi: false,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useRnJsCrypto, byAsyncSubCalls)',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              byAsyncSubCalls: true,
              useWebembedApi: false,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87ebad76f31087e49bbc59ac0f08d679e4c0869f9babcc7ec4c2557a42abebb072b4',
          name: 'encryptAsync 😃',
          fn: async () =>
            encryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: bufferUtils.utf8ToBytes(testPasswordRaw),
              customIv,
              customSalt,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87ebad76f31087e49bbc59ac0f08d679e4c0869f9babcc7ec4c2557a42abebb072b4',
          name: 'encryptAsync(useWebembedApi)',
          fn: async () => {
            return encryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: bufferUtils.utf8ToBytes(testPasswordRaw),
              useWebembedApi: true,
              customIv,
              customSalt,
            });
          },
        }),
      );

      const r6 = await encryptAsync({
        password: await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        }),
        data: bufferUtils.utf8ToBytes(testPasswordRaw),
        useWebembedApi: true,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '70617373776f7264313233',
          name: 'decryptAsync 😃',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: r6,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '⚠️ Wrong password',
          name: 'decryptAsync (wrong password) 😃',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: `1111`,
                }),
              data: r6,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '70617373776f7264313233',
          name: 'decryptAsync(useWebembedApi)',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: r6,
              useWebembedApi: true,
            }),
        }),
      );

      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'test test test test test test test test test test test junk',
          name: 'mnemonicFromEntropyAsync(useRnJsCrypto)😃',
          fn: async () => {
            return mnemonicFromEntropyAsync({
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'test test test test test test test test test test test junk',
          name: 'mnemonicFromEntropyAsync(useWebembedApi)',
          fn: async () => {
            return mnemonicFromEntropyAsync({
              hdCredential,
              password: testPassword,
              useWebembedApi: true,
            });
          },
        }),
      );

      const testPassphrase = 'optional passphrase';

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'bc0d03ab4f8871dd4a7a68423894bb88fb54973899e4721c9dffd09a5b589171b5712b27da764f7be0653ba361f445b4f9251b490525833b644b7a13eebc7e2c',
          name: 'mnemonicToSeedAsync(useWebembedApi)😃',
          fn: async () => {
            return mnemonicToSeedAsync({
              mnemonic: testMnemonic,
              passphrase: testPassphrase,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'bc0d03ab4f8871dd4a7a68423894bb88fb54973899e4721c9dffd09a5b589171b5712b27da764f7be0653ba361f445b4f9251b490525833b644b7a13eebc7e2c',
          name: 'mnemonicToSeedAsync(useRnJsCrypto)',
          fn: async () => {
            return mnemonicToSeedAsync({
              mnemonic: testMnemonic,
              passphrase: testPassphrase,
              useWebembedApi: false,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useRnJsCrypto)😃',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useWebembedApi)',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
              useWebembedApi: true,
            });
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          // null,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );
    } catch (error) {
      Toast.error({
        title: `SecretFunctions failed: ${(error as Error).message}`,
      });
    }
  };

  const testSecretFunctions2 = async () => {
    try {
      const {
        encryptRevealableSeed,
        generateRootFingerprintHexAsync,
        mnemonicToRevealableSeed,
      } = await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const testPasswordRaw = 'password123';

      let testPassword = '';
      testPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        });

      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useRnJsCrypto)😃',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          // null,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );
    } catch (error) {
      Toast.error({
        title: `SecretFunctions2 failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="SecretFunctions Test">
      <Button variant="primary" onPress={testSecretFunctions}>
        Test SecretFunctions
      </Button>
      <Button variant="primary" onPress={testSecretFunctions2}>
        Test SecretFunctions2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function JotaiDemoPriceInfo() {
  const [demoPriceInfo, setDemoPriceInfo] = useDemoPriceInfoAtom();

  return (
    <DebugRenderTracker>
      <Stack>
        <SizableText size="$bodyMd">
          {JSON.stringify(demoPriceInfo, null, 2)}
        </SizableText>
        <Button
          variant="primary"
          onPress={() =>
            setDemoPriceInfo((prev) => ({ ...prev, price: 10, info: 'info' }))
          }
        >
          setDemoPriceInfo(new object)
        </Button>
        <Button
          variant="primary"
          onPress={() => setDemoPriceInfo((prev) => prev)}
        >
          setDemoPriceInfo(prev object)
        </Button>
      </Stack>
    </DebugRenderTracker>
  );
}

const CryptoGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Crypto"
    elements={[
      {
        title: 'Default',
        element: (
          <Stack>
            <SizableText mb="$4" size="$bodyMd">
              {JSON.stringify(AppCryptoTestEmoji, null, 2)}
            </SizableText>
            <CustomAccordion>
              <CustomAccordionItem title="PBKDF2 Test">
                <PBKDF2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="KeyGen Test">
                <KeyGenTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="Hash Test">
                <HashTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="AES-CBC Test">
                <AESCbcTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="AES-GCM v2 Test">
                <AESGcmV2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="crypto.subtle Polyfill Test">
                <CryptoSubtlePolyfillTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="SecretFunctions Test">
                <SecretFunctionsTest />
              </CustomAccordionItem>
            </CustomAccordion>
            <JotaiDemoPriceInfo />
          </Stack>
        ),
      },
    ]}
  />
);

export default CryptoGallery;
