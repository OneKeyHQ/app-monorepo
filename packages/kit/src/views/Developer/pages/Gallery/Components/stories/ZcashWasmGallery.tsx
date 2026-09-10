import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

import { Layout } from './utils/Layout';
import ZcashStorageBenchmark from './ZcashStorageBenchmark';

// Preset zec--0 mainnet network id (packages/shared/src/config/presetNetworks.ts).
const ZCASH_NETWORK_ID = 'zec--0';

const SELF_TEST_STAGES = [
  'bridge',
  'worker',
  'wasm',
  'storage',
  'network',
] as const;
type ISelfTestStage = (typeof SELF_TEST_STAGES)[number];
type ISelfTestProgress = Partial<
  Record<
    ISelfTestStage,
    {
      status: 'running' | 'passed' | 'failed';
      detail?: string;
    }
  >
>;

async function runSelfTestStage(stage: ISelfTestStage) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      backgroundApiProxy.serviceDemo.zcashRuntimeSelfTest({
        $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
        stage,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new OneKeyLocalError(`zcash self-test: ${stage} timeout (60s)`),
            ),
          60_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function ZcashWasmSmokeTest() {
  const intl = useIntl();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ISelfTestProgress>({});

  const run = useCallback(async () => {
    setRunning(true);
    setProgress({});
    const nextProgress: ISelfTestProgress = {};
    try {
      for (const stage of SELF_TEST_STAGES) {
        nextProgress[stage] = { status: 'running' };
        setProgress({ ...nextProgress });
        try {
          const result = await runSelfTestStage(stage);
          nextProgress[stage] = {
            status: 'passed',
            detail: JSON.stringify(result),
          };
          setProgress({ ...nextProgress });
        } catch (error) {
          nextProgress[stage] = {
            status: 'failed',
            detail: error instanceof Error ? error.message : String(error),
          };
          setProgress({ ...nextProgress });
          break;
        }
      }
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <YStack gap="$3">
      <Button
        testID="zcash-runtime-smoke-test-button"
        loading={running}
        disabled={running}
        variant="primary"
        onPress={run}
      >
        {intl.formatMessage({ id: ETranslations.global_test })}
      </Button>
      {SELF_TEST_STAGES.map((stage) => {
        const step = progress[stage];
        const status = step
          ? {
              running: ETranslations.global_processing,
              passed: ETranslations.global_success,
              failed: ETranslations.global_failed,
            }[step.status]
          : ETranslations.global_pending;
        return (
          <YStack key={stage} gap="$1" testID={`zcash-self-test-${stage}`}>
            <SizableText
              size="$bodyMd"
              color={step?.status === 'failed' ? '$textCritical' : '$text'}
            >
              {stage}: {intl.formatMessage({ id: status })}
            </SizableText>
            {step?.detail ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {step.detail}
              </SizableText>
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );
}

function ZcashWalletDatabaseDiagnostics() {
  const [accountId, setAccountId] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<
      typeof backgroundApiProxy.serviceDemo.zcashWalletDatabaseDiagnostics
    >
  > | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await backgroundApiProxy.serviceDemo.zcashWalletDatabaseDiagnostics({
          $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
          networkId: ZCASH_NETWORK_ID,
          accountId: accountId.trim() || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [accountId]);

  let verdict = '';
  let verdictIsError = false;
  if (result) {
    if (!result.databaseExists) {
      verdict = '无数据库：没有找到持久化的主网数据库，也未新建。';
    } else if (
      !result.health?.quickCheck.ok ||
      result.health.foreignKeyViolations > 0
    ) {
      verdict = '失败：现有数据库未通过一致性检查。';
      verdictIsError = true;
    } else if (result.accountPresent === false) {
      verdict = '警告：数据库健康，但其中没有这个钱包账户。';
    } else {
      verdict = '通过：现有数据库已重新打开、完成迁移并通过检查。';
    }
  }

  return (
    <YStack gap="$3">
      <SizableText size="$bodySm" color="$textSubdued">
        Account ID 留空则检查整个数据库；填入真实 Account ID
        会同时验证该账户的钱包行和扫描游标可读。
        数据库不存在时不会新建；打开现有数据库会执行官方 schema
        迁移，但本工具绝不删除它。
      </SizableText>
      <Stack gap="$2">
        <SizableText size="$bodySm" fontWeight="bold">
          Account ID（可选）
        </SizableText>
        <Input
          value={accountId}
          onChangeText={setAccountId}
          placeholder="hd-3--m/44'/133'/0'"
          allowPaste
          allowClear
        />
      </Stack>
      <Button
        testID="zcash-database-diagnostics-button"
        loading={running}
        variant="primary"
        onPress={run}
      >
        检查现有主网数据库
      </Button>
      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      {result ? (
        <YStack gap="$2">
          <SizableText
            size="$bodyMd"
            color={verdictIsError ? '$textCritical' : '$textSuccess'}
          >
            {verdict}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            logicalBytes 是这个 SQLite 数据库的逻辑大小；originUsageBytes 是整个
            浏览器/Electron/WebView origin 的用量，因为浏览器不暴露 OPFS 中单个
            SQLite 数据库的物理字节数或系统路径。
          </SizableText>
          <Stack p="$3" bg="$bgSubdued" borderRadius="$2">
            <SizableText size="$bodySm">
              {JSON.stringify(result, null, 2)}
            </SizableText>
          </Stack>
        </YStack>
      ) : null}
    </YStack>
  );
}

// Dev-only debug tool for a REAL account already in this wallet (unlike the
// environment test above, which does not open a wallet). Paste an accountId
// from a "[zcash] shielded account meta missing" console log (e.g.
// hd-3--m/44'/133'/0') to inspect/repair it without going through any UI flow.
function ZcashRetryLocalWalletSetupDebug() {
  const [accountId, setAccountId] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const getMeta = useCallback(async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const meta =
        await backgroundApiProxy.serviceZcash.getLocalWalletAccountMetaForDebug(
          {
            $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
            networkId: ZCASH_NETWORK_ID,
            accountId,
          },
        );
      setResult(meta ?? '(no meta -- account is broken/transparent-only)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [accountId]);

  const retry = useCallback(async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      await backgroundApiProxy.serviceZcash.retryLocalWalletSetup({
        networkId: ZCASH_NETWORK_ID,
        accountId,
      });
      const meta =
        await backgroundApiProxy.serviceZcash.getLocalWalletAccountMetaForDebug(
          {
            $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
            networkId: ZCASH_NETWORK_ID,
            accountId,
          },
        );
      setResult(meta ?? '(retry returned but meta is still missing)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [accountId]);

  return (
    <YStack gap="$3">
      <Stack gap="$2">
        <SizableText size="$bodySm" fontWeight="bold">
          Account ID
        </SizableText>
        <Input
          value={accountId}
          onChangeText={setAccountId}
          placeholder="hd-3--m/44'/133'/0'"
          allowPaste
          allowClear
        />
      </Stack>
      <Stack flexDirection="row" gap="$3">
        <Button
          disabled={!accountId || running}
          loading={running}
          onPress={getMeta}
        >
          读取本地钱包元数据
        </Button>
        <Button
          disabled={!accountId || running}
          loading={running}
          variant="primary"
          onPress={retry}
        >
          重试本地钱包初始化
        </Button>
      </Stack>
      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      {result !== null ? (
        <Stack p="$3" bg="$bgSubdued" borderRadius="$2">
          <SizableText size="$bodySm">
            {typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
          </SizableText>
        </Stack>
      ) : null}
    </YStack>
  );
}

// Dev-only debug tool for the birthday-anchoring bug: an account whose meta
// only saved on a LATE retry got a birthday computed from "now" instead of
// its real creation time, so funds received in between are invisible to
// scanning (see KeyringHd.zcashDeriveAndSaveOneAccountMeta / Vault.
// rescanFromDaysAgo). Give a rough "sent it about N days ago" and this pushes
// the scan start back that far (plus a day of margin) and drops the cached
// wasm wallet DB so the next sync rescans from there.
function ZcashRescanFromDaysAgoDebug() {
  const [accountId, setAccountId] = useState('');
  const [daysAgo, setDaysAgo] = useState('7');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const rescan = useCallback(async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      await backgroundApiProxy.servicePrivacyChain.rescanFromDaysAgo({
        networkId: ZCASH_NETWORK_ID,
        accountId,
        daysAgo: Number(daysAgo),
      });
      const meta =
        await backgroundApiProxy.serviceZcash.getLocalWalletAccountMetaForDebug(
          {
            $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
            networkId: ZCASH_NETWORK_ID,
            accountId,
          },
        );
      setResult(meta ?? '（重扫已返回，但缺少元数据）');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [accountId, daysAgo]);

  const clearAndRescan = useCallback(() => {
    Dialog.show({
      title: '清除 Zcash 本地链数据？',
      description:
        '这会删除该账户可重建的扫描数据和交易历史，然后从已保存的生日重新扫描。查看密钥、私钥和资金不会被删除。',
      tone: 'warning',
      onConfirmText: '清除并重扫',
      onConfirm: async () => {
        setRunning(true);
        setError('');
        setResult(null);
        try {
          await backgroundApiProxy.servicePrivacyChain.resetLocalChainData({
            networkId: ZCASH_NETWORK_ID,
            accountId,
          });
          const meta =
            await backgroundApiProxy.serviceZcash.getLocalWalletAccountMetaForDebug(
              {
                $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
                networkId: ZCASH_NETWORK_ID,
                accountId,
              },
            );
          setResult(
            meta
              ? {
                  message: '本地链数据已清除，重扫已开始。',
                  meta,
                }
              : '（重置已返回，但缺少元数据）',
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setRunning(false);
        }
      },
    });
  }, [accountId]);

  return (
    <YStack gap="$3">
      <Stack gap="$2">
        <SizableText size="$bodySm" fontWeight="bold">
          Account ID
        </SizableText>
        <Input
          value={accountId}
          onChangeText={setAccountId}
          placeholder="hd-3--m/44'/133'/0'"
          allowPaste
          allowClear
        />
      </Stack>
      <Stack gap="$2">
        <SizableText size="$bodySm" fontWeight="bold">
          资金大约是多少天前发出的？
        </SizableText>
        <Input
          value={daysAgo}
          onChangeText={setDaysAgo}
          keyboardType="numeric"
        />
      </Stack>
      <Button
        disabled={!accountId || !daysAgo || running}
        loading={running}
        variant="primary"
        onPress={rescan}
      >
        从 N 天前开始重扫
      </Button>
      <Button
        disabled={!accountId || running}
        loading={running}
        variant="secondary"
        onPress={clearAndRescan}
      >
        清除本地链数据并从已保存的生日重扫
      </Button>
      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      {result !== null ? (
        <Stack p="$3" bg="$bgSubdued" borderRadius="$2">
          <SizableText size="$bodySm">
            {typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
          </SizableText>
        </Stack>
      ) : null}
    </YStack>
  );
}

const zcashDebugElements = [
  {
    title: 'Zcash runtime',
    element: <ZcashWasmSmokeTest />,
  },
  {
    title: '现有钱包数据库诊断',
    element: <ZcashWalletDatabaseDiagnostics />,
  },
  {
    title: '存储后端对比（隔离的测试数据库）',
    element: <ZcashStorageBenchmark />,
  },
  {
    title: '重试本地钱包初始化（真实账户，调试）',
    element: <ZcashRetryLocalWalletSetupDebug />,
  },
  {
    title: '清除或重扫本地链数据（真实账户，调试）',
    element: <ZcashRescanFromDaysAgoDebug />,
  },
];

export function ZcashDebugSettings() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  return (
    <YStack gap="$6">
      {zcashDebugElements.slice(0, 2).map(({ title, element }) => (
        <YStack key={title} gap="$3">
          <SizableText size="$headingSm">{title}</SizableText>
          {element}
        </YStack>
      ))}
      <Button
        onPress={() =>
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingDevZcashRuntimeModal,
          })
        }
      >
        {intl.formatMessage({ id: ETranslations.global_advanced_settings })}
      </Button>
    </YStack>
  );
}

const ZcashWasmGallery = () => (
  <Layout
    description="Loads the Zcash wasm through this platform's production carrier. It can inspect the existing wallet DB and run an isolated relaxed IndexedDB vs OPFS SAH-pool benchmark."
    suggestions={[
      'Every platform runs the same wallet WASM and OPFS VFS in a dedicated Worker.',
      'Extension: the offscreen document hosts the Worker transport.',
      'Desktop and Web: the page hosts the Worker transport.',
      'Mobile: web-embed hosts an inline Worker with the same wallet entry.',
      'Database diagnostics report per-DB logical size separately from whole-origin browser storage usage.',
      'Storage benchmarks use dedicated Workers and benchmark-only VFS namespaces; they never open zcash-main.db.',
    ]}
    elements={zcashDebugElements}
  />
);

export default ZcashWasmGallery;
