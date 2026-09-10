import { useCallback, useState } from 'react';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import type {
  IZcashStorageBenchmarkCase,
  IZcashStorageBenchmarkPreset,
  IZcashStorageBenchmarkResult,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

const TESTS: readonly {
  id: IZcashStorageBenchmarkCase;
  title: string;
  design: string;
  passCondition: string;
}[] = [
  {
    id: 'capability',
    title: '1. Worker 与后端能力',
    design: '启动一个全新的专用 Worker，在隔离命名空间里安装每种 VFS。',
    passCondition: '安装成功；不支持与测试失败分开上报。',
  },
  {
    id: 'crud',
    title: '2. 增删改查、吞吐与完整性',
    design:
      '创建相同的 schema 和确定性数据，记录批量读写延迟，然后更新和删除行。',
    passCondition:
      '剩余行数精确一致，quick_check=ok，无外键违规，抽样数据无不匹配。',
  },
  {
    id: 'reopen',
    title: '3. 延迟替换 Worker',
    design:
      '写入并关闭 SQLite，让 Worker 存活一段固定等待时间后销毁，再由新 Worker 验证。同时暴露 relaxed-IDB 缺少显式刷盘屏障的问题。',
    passCondition: '重新打开后完整指纹与完整性检查一致。',
  },
  {
    id: 'crashRecovery',
    title: '4. 提交确认后立即终止',
    design:
      'SQLite 报告写入完成后立即终止写入 Worker，新 Worker 不等待直接重开并验证。',
    passCondition: '每一条已确认的行都保留，数据库保持健康。',
  },
  {
    id: 'concurrentAccess',
    title: '5. 双 Worker 所有权与丢失更新测试',
    design:
      '两个新 Worker 并发向同一测试库追加互不重叠的数据集，再由第三个 Worker 验证结果。',
    passCondition:
      'IndexedDB 保留两个写入方的数据；OPFS 只允许一个 SyncAccessHandle 持有者，并保留该持有者的数据。',
  },
  {
    id: 'largeDatabase',
    title: '6. 大库重开与 WASM 内存开销',
    design:
      '构建更大的确定性数据库，替换 Worker，报告安装/预载/打开耗时以及前后的 WASM 内存。',
    passCondition: '指纹精确一致；耗时和内存只是测量值，不是硬性通过阈值。',
  },
  {
    id: 'cleanup',
    title: '7. 基准测试清理',
    design: '检查并删除两个隔离后端里所有固定的 quick/stress 基准测试数据库。',
    passCondition: '每次清理调用都完成；绝不接受钱包数据库名。',
  },
];

function BackendResult({
  label,
  result,
}: {
  label: string;
  result: IZcashStorageBenchmarkResult['backends']['relaxedIdb'];
}) {
  const writePhase = Object.values(result.phases).find(
    (phase) => 'action' in phase && phase.action === 'replace',
  );
  const reopenPhase = Object.values(result.phases).find(
    (phase) => 'action' in phase && phase.action === 'verify',
  );
  let color = '$textSubdued';
  if (result.status === 'passed') {
    color = '$textSuccess';
  } else if (result.status === 'failed') {
    color = '$textCritical';
  }

  return (
    <YStack gap="$1" flex={1} minWidth={280}>
      <SizableText size="$bodyMd" fontWeight="bold" color={color}>
        {label}: {result.status.toUpperCase()}
      </SizableText>
      <SizableText size="$bodySm">{result.verdict}</SizableText>
      {writePhase && 'actionMetrics' in writePhase ? (
        <SizableText size="$bodySm" color="$textSubdued">
          写入：{writePhase.actionMetrics?.rowsPerSecond?.toFixed(1) ?? 'n/a'}{' '}
          行/秒，{' '}
          {writePhase.actionMetrics?.payloadMiBPerSecond?.toFixed(2) ?? 'n/a'}{' '}
          MiB/秒；p95 提交批次{' '}
          {writePhase.actionMetrics?.batchLatencyMs?.p95.toFixed(2) ?? 'n/a'} ms
        </SizableText>
      ) : null}
      {reopenPhase && 'timingsMs' in reopenPhase ? (
        <SizableText size="$bodySm" color="$textSubdued">
          重开：预载 {reopenPhase.timingsMs.preload?.toFixed(2) ?? 'n/a'}{' '}
          ms，打开 {reopenPhase.timingsMs.open?.toFixed(2) ?? 'n/a'} ms；WASM
          内存变化{' '}
          {(
            (reopenPhase.memoryBytes.afterAction -
              reopenPhase.memoryBytes.start) /
            (1024 * 1024)
          ).toFixed(2)}{' '}
          MiB
        </SizableText>
      ) : null}
      {result.assertions.map((item) => (
        <SizableText
          key={item.name}
          size="$bodySm"
          color={item.passed ? '$textSuccess' : '$textCritical'}
        >
          {item.passed ? 'PASS' : 'FAIL'} — {item.name}
        </SizableText>
      ))}
    </YStack>
  );
}

export default function ZcashStorageBenchmark() {
  const [preset, setPreset] = useState<IZcashStorageBenchmarkPreset>('quick');
  const [runningCase, setRunningCase] =
    useState<IZcashStorageBenchmarkCase | null>(null);
  const [results, setResults] = useState<
    Partial<Record<IZcashStorageBenchmarkCase, IZcashStorageBenchmarkResult>>
  >({});
  const [error, setError] = useState('');

  const execute = useCallback(
    async (testCases: readonly IZcashStorageBenchmarkCase[]) => {
      setError('');
      for (const testCase of testCases) {
        setRunningCase(testCase);
        try {
          const result =
            await backgroundApiProxy.serviceDemo.zcashStorageBenchmark({
              $$devOnlyPassword: `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`,
              testCase,
              preset,
            });
          setResults((current) => ({ ...current, [testCase]: result }));
        } catch (runError) {
          setError(
            `${testCase}: ${
              runError instanceof Error ? runError.message : String(runError)
            }`,
          );
          break;
        }
      }
      setRunningCase(null);
    },
    [preset],
  );

  return (
    <YStack gap="$4">
      <SizableText size="$bodySm" color="$textSubdued">
        本测试绝不打开 zcash-main.db。两个后端在仅供基准测试的 VFS 命名空间下
        接收相同的 schema、负载和确定性数据。持久性单独上报：relaxed IndexedDB
        只接受 synchronous=OFF，OPFS 以 synchronous=FULL 测试。Quick 每次大库
        运行约占 4 MiB，Stress 约 32 MiB。浏览器 origin 用量包含无关数据，因此
        SQLite 逻辑字节数与 WASM 内存分开上报。开发构建自带诊断 runtime；生产
        测试构建必须显式设置 ZCASH_STORAGE_BENCHMARK=1。
      </SizableText>

      <Stack flexDirection="row" flexWrap="wrap" gap="$2">
        <Button
          variant={preset === 'quick' ? 'primary' : 'secondary'}
          disabled={runningCase !== null}
          onPress={() => setPreset('quick')}
        >
          Quick 预设
        </Button>
        <Button
          variant={preset === 'stress' ? 'primary' : 'secondary'}
          disabled={runningCase !== null}
          onPress={() => setPreset('stress')}
        >
          Stress 预设
        </Button>
        <Button
          variant="primary"
          loading={runningCase !== null}
          onPress={() => void execute(TESTS.map((test) => test.id))}
        >
          运行完整 {preset} 套件
        </Button>
        <Button disabled={runningCase !== null} onPress={() => setResults({})}>
          清空显示结果
        </Button>
      </Stack>

      {runningCase ? (
        <SizableText size="$bodyMd">运行中：{runningCase}</SizableText>
      ) : null}
      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}

      {TESTS.map((test) => {
        const result = results[test.id];
        return (
          <YStack
            key={test.id}
            gap="$2"
            p="$3"
            bg="$bgSubdued"
            borderRadius="$3"
          >
            <Stack
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              flexWrap="wrap"
            >
              <SizableText size="$headingSm">{test.title}</SizableText>
              <Button
                size="small"
                loading={runningCase === test.id}
                disabled={runningCase ? runningCase !== test.id : false}
                onPress={() => void execute([test.id])}
              >
                运行此测试
              </Button>
            </Stack>
            <SizableText size="$bodySm">设计：{test.design}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              通过条件：{test.passCondition}
            </SizableText>
            {result ? (
              <YStack gap="$3" mt="$2">
                <Stack flexDirection="row" flexWrap="wrap" gap="$4">
                  <BackendResult
                    label="Relaxed IndexedDB"
                    result={result.backends.relaxedIdb}
                  />
                  <BackendResult
                    label="OPFS SAH-pool"
                    result={result.backends.opfsSahpool}
                  />
                </Stack>
                <SizableText size="$bodySm" color="$textSubdued">
                  总耗时 {result.durationMs} ms；origin 用量前{' '}
                  {String(result.execution.originUsageBeforeBytes)}，后{' '}
                  {String(result.execution.originUsageAfterBytes)} 字节。
                </SizableText>
                <Stack p="$3" bg="$bg" borderRadius="$2">
                  <SizableText size="$bodySm">
                    {JSON.stringify(result, null, 2)}
                  </SizableText>
                </Stack>
              </YStack>
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );
}
