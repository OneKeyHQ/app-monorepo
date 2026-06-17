// cspell:ignore lockdown evalTaming tamper IndexedDB XHR randomBytes isNormalized oneKey
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Accordion,
  Badge,
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Stack,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getSesHardenLevelFromRuntime } from '@onekeyhq/shared/src/security/sesHarden';
import type {
  ISesHardenLevel,
  ISesHardenRuntime,
  ISesHardenRuntimeState,
} from '@onekeyhq/shared/src/security/sesHarden';
import {
  SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE,
  SES_RUNTIME_CHECK_COVERAGE,
  buildSesRuntimeCheckReport,
} from '@onekeyhq/shared/src/security/sesHarden/runtimeCheck';
import type {
  ISesCheckDimension,
  ISesCheckStatus,
  ISesHardenRuntimeCheckResponse,
  ISesRuntimeCheckReport,
} from '@onekeyhq/shared/src/security/sesHarden/runtimeCheck';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';

type ISesHardenDevGlobal = typeof globalThis & {
  __ONEKEY_SES_HARDEN_STATE__?: ISesHardenRuntimeState;
};

type ISesLevelMatrixRow = {
  item: string;
  description: string;
  l0: ISesLevelMatrixCell;
  l1: ISesLevelMatrixCell;
  l2: ISesLevelMatrixCell;
};

type ISesLevelMatrixCell = {
  emoji: string;
  detail: string;
};

type IExtensionRuntimeCheckTarget = {
  runtime: ISesHardenRuntime;
  required: boolean;
  unavailableMessage: string;
};

type IExtensionRuntimeCheckResult = {
  runtime: ISesHardenRuntime;
  status: ISesCheckStatus;
  report?: ISesRuntimeCheckReport;
  error?: string;
};

type IAggregatedSesRuntimeCheckReport = ISesRuntimeCheckReport & {
  extensionRuntimeReports?: readonly IExtensionRuntimeCheckResult[];
};

type ISesDimensionSummary =
  ISesRuntimeCheckReport['summary']['byDimension'][ISesCheckDimension];

type IRuntimeSummaryForCopy = {
  runtime?: ISesHardenRuntime;
  status: ISesCheckStatus;
  level?: ISesHardenLevel;
  lockdownApplied?: boolean;
  state?: ISesHardenRuntimeState;
  error?: string;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    dimensions: Record<
      ISesCheckDimension,
      {
        label: string;
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        actionableTotal: number;
      }
    >;
  };
};

type IChromeRuntimeForSesCheck = {
  lastError?: {
    message?: string;
  };
  sendMessage?: (
    message: {
      type: typeof SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE;
      targetRuntime: ISesHardenRuntime;
    },
    callback: (response?: ISesHardenRuntimeCheckResponse) => void,
  ) => void;
};

const EXTENSION_RUNTIME_CHECK_TARGETS: readonly IExtensionRuntimeCheckTarget[] =
  [
    {
      runtime: 'ext-background',
      required: true,
      unavailableMessage: 'background runtime should be reachable.',
    },
    {
      runtime: 'ext-offscreen',
      required: false,
      unavailableMessage:
        'offscreen runtime is checked only when the offscreen document is alive.',
    },
    {
      runtime: 'ext-passkey',
      required: false,
      unavailableMessage:
        'passkey runtime is checked only when the passkey page is open.',
    },
  ];

const SES_CHECK_DIMENSIONS = [
  'runtime-state',
  'functionality',
  'tamper-resistance',
] as const;

const SES_LEVEL_MATRIX: readonly ISesLevelMatrixRow[] = [
  {
    item: 'SES lockdown',
    description:
      'SES lockdown 会在当前 JS realm 内冻结语言内建对象，并安装 SES 的安全运行时能力。这是 L1/L2 生效的入口。',
    l0: {
      emoji: '❌',
      detail: 'L0 不加载 SES，也不执行 lockdown，行为和之前代码一致。',
    },
    l1: {
      emoji: '✅',
      detail: 'L1 执行 SES lockdown，开始冻结当前 realm 的 intrinsics。',
    },
    l2: {
      emoji: '✅',
      detail: 'L2 同样执行 SES lockdown，硬化基础与 L1 相同。',
    },
  },
  {
    item: 'Intrinsics hardening',
    description:
      'Intrinsics 是 JS 语言底座对象，例如 Object.prototype、Array.prototype、Function.prototype。本方案不是自己逐个 freeze，而是在加载 ses 后调用 globalThis.lockdown(options)，由 SES 在当前 realm 内完成硬化。',
    l0: {
      emoji: '❌',
      detail:
        'L0 不冻结 intrinsics，Object.prototype / Array.prototype 保持原生可变状态。',
    },
    l1: {
      emoji: '✅',
      detail:
        'L1 通过 globalThis.lockdown(options) 冻结 intrinsics，Object.prototype / Array.prototype 不允许被篡改。',
    },
    l2: {
      emoji: '✅',
      detail:
        'L2 与 L1 一样，通过 globalThis.lockdown(options) 冻结 intrinsics。',
    },
  },
  {
    item: 'globalThis.harden',
    description:
      'harden 是 SES 提供的对象图冻结函数，用来冻结暴露给不可信代码的 API facade。',
    l0: {
      emoji: '❌',
      detail: 'L0 不执行 lockdown，因此没有 SES 安装的 globalThis.harden。',
    },
    l1: {
      emoji: '✅',
      detail: 'L1 执行 lockdown 后，globalThis.harden 可用。',
    },
    l2: {
      emoji: '✅',
      detail: 'L2 执行 lockdown 后，globalThis.harden 可用。',
    },
  },
  {
    item: 'errorTaming',
    description:
      'errorTaming 控制 Error 构造器、Error.prototype 和 stack 相关能力是否被 SES 收紧。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 errorTaming。',
    },
    l1: {
      emoji: '❌',
      detail:
        "L1 没有开启 safe error taming，当前使用 'unsafe-debug'，保留完整 stack 方便 Sentry 排查。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍没有开启 safe error taming，继续使用 'unsafe-debug'。",
    },
  },
  {
    item: 'consoleTaming',
    description:
      'consoleTaming 控制是否用 SES causal console 替换原始 console。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 consoleTaming。',
    },
    l1: {
      emoji: '❌',
      detail:
        "L1 没有开启 safe console taming，当前使用 'unsafe'，保留原始 console。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍没有开启 safe console taming，继续使用 'unsafe'。",
    },
  },
  {
    item: 'reporting',
    description:
      'reporting 控制 SES 自己在 repair / lockdown 过程中的诊断信息输出方式。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 reporting。',
    },
    l1: {
      emoji: '✅',
      detail: "L1 使用 'console'，让 internal/dev 能看到 SES 诊断输出。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'console'。",
    },
  },
  {
    item: 'localeTaming',
    description:
      'localeTaming 控制 locale-sensitive 原生方法是否被替换成更确定性的行为，例如部分 toLocale* 方法。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 localeTaming。',
    },
    l1: {
      emoji: '❌',
      detail:
        "L1 没有开启 safe locale taming，当前使用 'unsafe'，避免影响金额、价格、日期和本地化展示。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍没有开启 safe locale taming，继续使用 'unsafe'。",
    },
  },
  {
    item: 'regExpTaming',
    description:
      'regExpTaming 控制 RegExp 构造器和 RegExp.prototype 的部分旧行为是否被 SES 收紧。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 regExpTaming。',
    },
    l1: {
      emoji: '❌',
      detail:
        "L1 没有开启 safe RegExp taming，当前使用 'unsafe'，避免改变正则兼容行为。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍没有开启 safe RegExp taming，继续使用 'unsafe'。",
    },
  },
  {
    item: 'evalTaming',
    description:
      'evalTaming 控制 eval 和 Function constructor。safe-eval 会替换动态求值路径，限制 Function constructor 等路径逃逸拿到当前 globalThis。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 evalTaming。',
    },
    l1: {
      emoji: '❌',
      detail: "L1 使用 'unsafe-eval'，保留原生 eval / Function 兼容性。",
    },
    l2: {
      emoji: '✅',
      detail:
        "L2 使用 'safe-eval'，限制 Function('return this')() 拿到当前 globalThis。",
    },
  },
  {
    item: 'evalTaming: no-eval',
    description:
      'no-eval 是比 safe-eval 更严格的模式，会直接禁用动态求值，兼容风险更高。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 no-eval。',
    },
    l1: {
      emoji: '❌',
      detail: 'L1 不启用 no-eval。',
    },
    l2: {
      emoji: '❌',
      detail: 'L2 不启用 no-eval，只启用 safe-eval。',
    },
  },
  {
    item: 'overrideTaming',
    description:
      "overrideTaming 控制 override mistake 的兼容策略。打包后的依赖（axios/decimal.js 等）会在初始化时往继承自 Object.prototype 的对象上赋值 constructor，需用 'severe' 才能放行（与 MetaMask 一致）；severe 不削弱 intrinsic 冻结，仅允许在接收者自身 shadow。",
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 overrideTaming。',
    },
    l1: {
      emoji: '✅',
      detail:
        "L1 使用 'severe'，让打包依赖的 override 赋值在接收者自身 shadow，避免撞到冻结的 Object.prototype。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'severe'。",
    },
  },
  {
    item: 'overrideDebug',
    description:
      'overrideDebug 是 overrideTaming 的调试辅助项，用来定位哪些 override 被 SES 处理。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 overrideDebug。',
    },
    l1: {
      emoji: '❌',
      detail:
        'L1 不配置 overrideDebug，保持默认空数组；只在定位兼容问题时临时打开。',
    },
    l2: {
      emoji: '❌',
      detail: 'L2 与 L1 一样不配置 overrideDebug。',
    },
  },
  {
    item: 'stackFiltering',
    description:
      'stackFiltering 控制 SES console 输出错误栈时如何过滤 stack frames。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 stackFiltering。',
    },
    l1: {
      emoji: '✅',
      detail: "L1 使用 'verbose'，保留更完整 stack 方便 Sentry 和本地排查。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'verbose'。",
    },
  },
  {
    item: 'domainTaming',
    description:
      'domainTaming 控制旧式 HTML domain 相关能力的处理，主要面向浏览器环境的 legacy 行为。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 domainTaming。',
    },
    l1: {
      emoji: '✅',
      detail: "L1 使用 'safe'。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'safe'。",
    },
  },
  {
    item: 'legacyRegeneratorRuntimeTaming',
    description:
      'legacyRegeneratorRuntimeTaming 处理旧 regeneratorRuntime 全局兼容问题，避免 legacy runtime 暴露可变全局能力。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 legacyRegeneratorRuntimeTaming。',
    },
    l1: {
      emoji: '✅',
      detail: "L1 使用 'safe'。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'safe'。",
    },
  },
  {
    item: 'errorTrapping',
    description:
      'errorTrapping 控制 SES 是否接管全局 error trapping。本轮避免和现有 Sentry / logger 链路叠加。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 errorTrapping。',
    },
    l1: {
      emoji: '❌',
      detail: "L1 使用 'none'，不让 SES 接管全局 error trapping。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍使用 'none'。",
    },
  },
  {
    item: 'unhandledRejectionTrapping',
    description:
      'unhandledRejectionTrapping 控制 SES 是否接管未处理 Promise rejection。本轮避免影响现有 Promise 错误处理和 Sentry。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 unhandledRejectionTrapping。',
    },
    l1: {
      emoji: '❌',
      detail: "L1 使用 'none'，不让 SES 接管 unhandled rejection trapping。",
    },
    l2: {
      emoji: '❌',
      detail: "L2 仍使用 'none'。",
    },
  },
  {
    item: 'dateTaming',
    description:
      'dateTaming 是 SES 2.2.0 仍接受但已废弃的选项；上游源码里标明传入后不生效，未来可能变成错误。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 dateTaming。',
    },
    l1: {
      emoji: '❌',
      detail: 'L1 不配置 dateTaming，因为它已经废弃且不生效。',
    },
    l2: {
      emoji: '❌',
      detail: 'L2 与 L1 一样不配置 dateTaming。',
    },
  },
  {
    item: 'mathTaming',
    description:
      'mathTaming 是 SES 2.2.0 仍接受但已废弃的选项；上游源码里标明传入后不生效，未来可能变成错误。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 mathTaming。',
    },
    l1: {
      emoji: '❌',
      detail: 'L1 不配置 mathTaming，因为它已经废弃且不生效。',
    },
    l2: {
      emoji: '❌',
      detail: 'L2 与 L1 一样不配置 mathTaming。',
    },
  },
  {
    item: '__hardenTaming__',
    description:
      '__hardenTaming__ 是 SES 内部/实验选项，用来控制 harden 本身的 taming；业务方案不应依赖它。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 __hardenTaming__。',
    },
    l1: {
      emoji: '➖',
      detail: "L1 不显式配置 __hardenTaming__，由 SES 使用默认值 'safe'。",
    },
    l2: {
      emoji: '➖',
      detail:
        "L2 与 L1 一样不显式配置 __hardenTaming__，由 SES 使用默认值 'safe'。",
    },
  },
  {
    item: '推荐用途',
    description:
      '推荐用途说明每个 level 在 rollout 中承担的角色，不是 SES 选项。',
    l0: {
      emoji: '➖',
      detail: 'L0 用于紧急回滚和对照组，不再作为当前默认值。',
    },
    l1: {
      emoji: '✅',
      detail: 'L1 是第一阶段灰度推荐值，先验证基础功能和防篡改。',
    },
    l2: {
      emoji: '✅',
      detail:
        'L2 是当前默认值，在 L1 基础上额外启用 safe-eval，限制动态函数逃逸。',
    },
  },
] as const;

function getSesGlobal(): ISesHardenDevGlobal {
  return globalThis as ISesHardenDevGlobal;
}

function getCheckBadgeType(status: ISesCheckStatus): IBadgeType {
  if (status === 'pass') return 'success';
  if (status === 'fail') return 'critical';
  return 'info';
}

function getDimensionLabel(dimension: ISesCheckDimension): string {
  if (dimension === 'runtime-state') return '状态确认';
  if (dimension === 'functionality') return '正常工作';
  return '防篡改';
}

function getDimensionSummaryStats(
  dimension: ISesCheckDimension,
  dimensionSummary: ISesDimensionSummary,
) {
  const skipped =
    dimensionSummary.total - dimensionSummary.passed - dimensionSummary.failed;
  const actionableTotal = dimensionSummary.passed + dimensionSummary.failed;

  return {
    label: getDimensionLabel(dimension),
    total: dimensionSummary.total,
    passed: dimensionSummary.passed,
    failed: dimensionSummary.failed,
    skipped,
    actionableTotal,
  };
}

function getDimensionSummaryText(
  dimension: ISesCheckDimension,
  dimensionSummary: ISesDimensionSummary,
): string {
  const stats = getDimensionSummaryStats(dimension, dimensionSummary);
  return `${stats.label}: ${stats.passed}/${stats.actionableTotal}${
    stats.skipped > 0 ? ` 跳过 ${stats.skipped}` : ''
  }`;
}

function getDimensionSummaryBadgeType(
  dimensionSummary: ISesDimensionSummary,
): IBadgeType {
  return dimensionSummary.failed > 0 ? 'critical' : 'success';
}

function DimensionSummaryBadges({
  runtimeReport,
}: {
  runtimeReport: ISesRuntimeCheckReport;
}) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {SES_CHECK_DIMENSIONS.map((dimension) => {
        const dimensionSummary = runtimeReport.summary.byDimension[dimension];
        return (
          <Badge
            key={dimension}
            badgeType={getDimensionSummaryBadgeType(dimensionSummary)}
            badgeSize="sm"
          >
            <Badge.Text>
              {getDimensionSummaryText(dimension, dimensionSummary)}
            </Badge.Text>
          </Badge>
        );
      })}
    </XStack>
  );
}

function LabeledLine({ label, value }: { label: string; value: string }) {
  return (
    <SizableText color="$textSubdued">
      <SizableText color="$text" fontWeight="600">
        {label}
      </SizableText>
      {value}
    </SizableText>
  );
}

// Renders a single post-lockdown patch warning. Shared between this runtime's
// own warnings and the warnings pulled from each extension runtime (background
// /offscreen/passkey) so the offending module (`culprit`) and full stack are
// visible no matter which runtime recorded it.
function PatchWarningItem({
  warning,
}: {
  warning: ISesRuntimeCheckReport['patchWarnings']['items'][number];
}) {
  return (
    <YStack
      gap="$1"
      p="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$1"
    >
      <SizableText size="$bodyMdMedium">
        #{warning.id} {warning.kind} count={warning.count} lastSeenAt=
        {warning.lastSeenAt}
      </SizableText>
      {warning.culprit ? (
        <SizableText size="$bodyMdMedium" color="$textCritical">
          报错模块: {warning.culprit}
        </SizableText>
      ) : null}
      <SizableText color="$textSubdued">
        createdAt={warning.createdAt}
      </SizableText>
      <SizableText color="$textSubdued">{warning.message}</SizableText>
      <SizableText color="$textSubdued">
        fingerprint={warning.fingerprint}
      </SizableText>
      {warning.source ? (
        <SizableText color="$textSubdued">
          {warning.source}:{warning.lineno ?? 0}:{warning.colno ?? 0}
        </SizableText>
      ) : null}
      {warning.stack ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {warning.stack}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function showLevelMatrixItemDialog(item: ISesLevelMatrixRow) {
  Dialog.show({
    title: item.item,
    renderContent: (
      <YStack gap="$2">
        <LabeledLine label="功能：" value={item.description} />
      </YStack>
    ),
  });
}

function showLevelMatrixCellDialog({
  item,
  level,
  cell,
}: {
  item: ISesLevelMatrixRow;
  level: ISesHardenLevel;
  cell: ISesLevelMatrixCell;
}) {
  Dialog.show({
    title: `${item.item} / ${level}`,
    renderContent: (
      <YStack gap="$2">
        <LabeledLine label="状态：" value={cell.emoji} />
        <LabeledLine label="说明：" value={cell.detail} />
      </YStack>
    ),
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getGlobalRecord(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function isExtensionRuntime(runtime?: string): boolean {
  return runtime?.startsWith('ext-') === true;
}

function getChromeRuntimeForSesCheck(): IChromeRuntimeForSesCheck | undefined {
  const chromeApi = getGlobalRecord().chrome as
    | {
        runtime?: IChromeRuntimeForSesCheck;
      }
    | undefined;

  return chromeApi?.runtime;
}

function hasReportFailures(report?: IAggregatedSesRuntimeCheckReport): boolean {
  if (!report) return false;
  if (report.checks.some((check) => check.status === 'fail')) return true;

  return (
    report.extensionRuntimeReports?.some(
      (runtimeReport) =>
        runtimeReport.status === 'fail' ||
        runtimeReport.report?.checks.some((check) => check.status === 'fail'),
    ) ?? false
  );
}

function getRuntimeResultStatus(
  report: ISesRuntimeCheckReport,
): ISesCheckStatus {
  return report.summary.failed > 0 ? 'fail' : 'pass';
}

function buildRuntimeSummaryForCopy(
  runtimeReport: ISesRuntimeCheckReport,
  status: ISesCheckStatus,
): IRuntimeSummaryForCopy {
  const dimensionEntries = SES_CHECK_DIMENSIONS.map((dimension) => [
    dimension,
    getDimensionSummaryStats(
      dimension,
      runtimeReport.summary.byDimension[dimension],
    ),
  ]);

  return {
    runtime: runtimeReport.state?.runtime,
    status,
    level: runtimeReport.level,
    lockdownApplied: runtimeReport.state?.lockdownApplied,
    state: runtimeReport.state,
    summary: {
      total: runtimeReport.summary.total,
      passed: runtimeReport.summary.passed,
      failed: runtimeReport.summary.failed,
      dimensions: Object.fromEntries(dimensionEntries) as Record<
        ISesCheckDimension,
        ReturnType<typeof getDimensionSummaryStats>
      >,
    },
  };
}

function buildCopyableReport(
  report: IAggregatedSesRuntimeCheckReport,
): IAggregatedSesRuntimeCheckReport & {
  runtimeSummaries: readonly IRuntimeSummaryForCopy[];
} {
  const extensionRuntimeSummaries =
    report.extensionRuntimeReports?.map((runtimeReport) =>
      runtimeReport.report
        ? buildRuntimeSummaryForCopy(runtimeReport.report, runtimeReport.status)
        : {
            runtime: runtimeReport.runtime,
            status: runtimeReport.status,
            error: runtimeReport.error,
          },
    ) ?? [];

  return {
    ...report,
    runtimeSummaries: [
      buildRuntimeSummaryForCopy(report, getRuntimeResultStatus(report)),
      ...extensionRuntimeSummaries,
    ],
  };
}

async function requestExtensionRuntimeCheckReport(
  target: IExtensionRuntimeCheckTarget,
): Promise<IExtensionRuntimeCheckResult> {
  const chromeRuntime = getChromeRuntimeForSesCheck();

  if (!chromeRuntime?.sendMessage) {
    return {
      runtime: target.runtime,
      status: target.required ? 'fail' : 'info',
      error: `chrome.runtime.sendMessage is unavailable. ${target.unavailableMessage}`,
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutRef: {
      current?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = (result: IExtensionRuntimeCheckResult) => {
      if (settled) return;
      settled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      resolve(result);
    };

    timeoutRef.current = setTimeout(() => {
      finish({
        runtime: target.runtime,
        status: target.required ? 'fail' : 'info',
        error: `runtime check timed out. ${target.unavailableMessage}`,
      });
    }, 10_000);

    try {
      chromeRuntime.sendMessage?.(
        {
          type: SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE,
          targetRuntime: target.runtime,
        },
        (response) => {
          const lastErrorMessage = chromeRuntime.lastError?.message;
          if (lastErrorMessage) {
            finish({
              runtime: target.runtime,
              status: target.required ? 'fail' : 'info',
              error: `${lastErrorMessage}. ${target.unavailableMessage}`,
            });
            return;
          }

          if (!response) {
            finish({
              runtime: target.runtime,
              status: target.required ? 'fail' : 'info',
              error: `empty response. ${target.unavailableMessage}`,
            });
            return;
          }

          if (!response.ok) {
            finish({
              runtime: target.runtime,
              status: 'fail',
              error: response.error,
            });
            return;
          }

          const runtimeReport = response.report;
          finish({
            runtime: target.runtime,
            status: getRuntimeResultStatus(runtimeReport),
            report: runtimeReport,
          });
        },
      );
    } catch (error) {
      finish({
        runtime: target.runtime,
        status: target.required ? 'fail' : 'info',
        error: `${getErrorMessage(error)}. ${target.unavailableMessage}`,
      });
    }
  });
}

async function collectExtensionRuntimeReports(
  currentRuntime?: ISesHardenRuntime,
): Promise<readonly IExtensionRuntimeCheckResult[] | undefined> {
  if (!isExtensionRuntime(currentRuntime)) {
    return undefined;
  }

  return Promise.all(
    EXTENSION_RUNTIME_CHECK_TARGETS.filter(
      (target) => target.runtime !== currentRuntime,
    ).map((target) => requestExtensionRuntimeCheckReport(target)),
  );
}

function CollapsibleSection({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        borderWidth={0}
        bg="$transparent"
        py="$3"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
          outlineOffset: 0,
        }}
      >
        {({ open }: { open: boolean }) => (
          <>
            <SizableText size="$headingLg">{title}</SizableText>
            <Stack
              animation="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '-180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                color={open ? '$iconActive' : '$iconSubdued'}
                size="$6"
              />
            </Stack>
          </>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          unstyled
          animation="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          pt="$3"
        >
          {children}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

export default function DevSesHardenRuntimeCheck() {
  const { copyText } = useClipboard();
  const [report, setReport] = useState<IAggregatedSesRuntimeCheckReport>();
  const [isRunning, setIsRunning] = useState(false);

  const hasFailures = useMemo(() => hasReportFailures(report), [report]);

  const reportText = useMemo(
    () => (report ? JSON.stringify(buildCopyableReport(report), null, 2) : ''),
    [report],
  );
  const checksWithCoverage = useMemo(
    () =>
      SES_RUNTIME_CHECK_COVERAGE.map((coverageItem) => ({
        coverageItem,
        check: report?.checks.find((item) => item.name === coverageItem.name),
      })),
    [report],
  );

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    try {
      const currentReport = await buildSesRuntimeCheckReport();
      const extensionRuntimeReports = await collectExtensionRuntimeReports(
        currentReport.state?.runtime,
      );
      const nextReport: IAggregatedSesRuntimeCheckReport =
        extensionRuntimeReports?.length
          ? {
              ...currentReport,
              extensionRuntimeReports,
            }
          : currentReport;
      setReport(nextReport);
      if (hasReportFailures(nextReport)) {
        Toast.error({ title: 'SES harden check failed' });
      } else {
        Toast.success({ title: 'SES harden check passed' });
      }
    } catch (error) {
      Toast.error({
        title: 'SES harden check crashed',
        message: getErrorMessage(error),
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  const copyReport = useCallback(() => {
    if (!reportText) {
      Toast.error({ title: 'Run checks first' });
      return;
    }
    copyText(reportText);
    Toast.success({ title: 'Copied' });
  }, [copyText, reportText]);

  const openPassKeyRuntime = useCallback(async () => {
    try {
      // Open the passkey page (ui-passkey.html) in idle mode so its SES
      // runtime-check message handler stays registered and the window keeps
      // responding to the ext-passkey runtime check, instead of "The message
      // port closed before a response was received".
      await extUtils.openPassKeyWindowForDevCheck();
      Toast.success({
        title: 'PassKey runtime opened',
        message: 'Keep the window open, then click Run Checks again.',
      });
    } catch (error) {
      Toast.error({
        title: 'Open PassKey runtime failed',
        message: getErrorMessage(error),
      });
    }
  }, []);

  // Auto-run the checks once when the page mounts. The ref guard keeps it to a
  // single run even under React StrictMode's dev double-invoke, so we don't fire
  // two runs (and two toasts) on entry.
  const didAutoRunRef = useRef(false);
  useEffect(() => {
    if (didAutoRunRef.current) {
      return;
    }
    didAutoRunRef.current = true;
    void runChecks();
  }, [runChecks]);

  return (
    <Page scrollEnabled>
      <Page.Header title="SES Harden Runtime Check" />
      <Page.Body>
        <YStack p="$4" gap="$4">
          <YStack gap="$2">
            <SizableText size="$headingLg">当前 Runtime</SizableText>
            <SizableText color="$textSubdued">
              Level: {getSesHardenLevelFromRuntime()}
            </SizableText>
            <SizableText color="$textSubdued">
              State:{' '}
              {JSON.stringify(getSesGlobal().__ONEKEY_SES_HARDEN_STATE__)}
            </SizableText>
          </YStack>

          <Accordion type="multiple" gap="$4" defaultValue={['checks']}>
            <CollapsibleSection value="checks" title="测试项目与结果">
              <YStack gap="$3">
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    testID="ses-harden-run-checks"
                    variant="primary"
                    loading={isRunning}
                    onPress={() => {
                      void runChecks();
                    }}
                  >
                    Run Checks
                  </Button>
                  <Button
                    testID="ses-harden-copy-report"
                    variant="secondary"
                    onPress={copyReport}
                  >
                    Copy Test Result
                  </Button>
                  {platformEnv.isExtension ? (
                    <Button
                      testID="ses-harden-open-passkey-runtime"
                      variant="secondary"
                      onPress={() => {
                        void openPassKeyRuntime();
                      }}
                    >
                      Open PassKey runtime
                    </Button>
                  ) : null}
                </XStack>
                <SizableText color="$textSubdued">
                  每张卡片同时展示测试说明和运行结果。核心硬化验证是
                  Object/Array 原型冻结、harden 深冻结，以及 L2
                  的动态函数逃逸限制。Tamper 测试会主动尝试 set 和
                  defineProperty，确认 harden 后不能篡改原型、内建函数和
                  hardened object。同时会检查
                  IndexedDB、fetch、timer、crypto、desktop/ext bridge
                  等启动期关键 patch 是否仍然安装且可用。在 extension UI
                  中还会请求 background、offscreen、passkey runtime
                  各自执行同一套检查。
                </SizableText>

                {report ? (
                  <XStack alignItems="center" gap="$2">
                    <SizableText size="$bodyLgMedium">总体结果</SizableText>
                    <Badge
                      badgeType={hasFailures ? 'critical' : 'success'}
                      badgeSize="sm"
                    >
                      <Badge.Text>
                        {hasFailures ? 'Failed' : 'Passed'}
                      </Badge.Text>
                    </Badge>
                  </XStack>
                ) : null}

                {report ? (
                  <DimensionSummaryBadges runtimeReport={report} />
                ) : null}

                {report?.extensionRuntimeReports?.length ? (
                  <YStack
                    gap="$2"
                    p="$3"
                    borderWidth="$px"
                    borderColor="$borderSubdued"
                    borderRadius="$2"
                  >
                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                      <Badge
                        badgeType={
                          report.extensionRuntimeReports.some(
                            (item) => item.status === 'fail',
                          )
                            ? 'critical'
                            : 'success'
                        }
                        badgeSize="sm"
                      >
                        <Badge.Text>
                          {
                            report.extensionRuntimeReports.filter(
                              (item) => item.status === 'pass',
                            ).length
                          }
                          /{report.extensionRuntimeReports.length}
                        </Badge.Text>
                      </Badge>
                      <SizableText size="$bodyLgMedium">
                        Extension 多 Runtime 结果
                      </SizableText>
                    </XStack>
                    <LabeledLine
                      label="功能："
                      value="从当前扩展 UI 通过 chrome.runtime.sendMessage 请求 background、offscreen、passkey 在各自独立 JS realm 内执行同一套 SES runtime checks。"
                    />
                    <LabeledLine
                      label="硬化点："
                      value="验证每个扩展 runtime 自己的 lockdown 状态、intrinsics 冻结、防篡改结果，以及启动期 bridge/fetch/timer/crypto/IndexedDB patch。"
                    />
                    <LabeledLine
                      label="目的："
                      value="避免只验证 UI runtime，却漏掉 background/offscreen/passkey 这些独立 JS heap 的 harden 和关键 patch 顺序。"
                    />
                    {report.extensionRuntimeReports.map((runtimeReport) => (
                      <YStack
                        key={runtimeReport.runtime}
                        gap="$1"
                        p="$2"
                        borderWidth="$px"
                        borderColor="$borderSubdued"
                        borderRadius="$1"
                      >
                        <XStack alignItems="center" gap="$2" flexWrap="wrap">
                          <Badge
                            badgeType={getCheckBadgeType(runtimeReport.status)}
                            badgeSize="sm"
                          >
                            <Badge.Text>{runtimeReport.status}</Badge.Text>
                          </Badge>
                          <SizableText size="$bodyMdMedium">
                            {runtimeReport.runtime}
                          </SizableText>
                        </XStack>
                        {runtimeReport.report ? (
                          <>
                            <DimensionSummaryBadges
                              runtimeReport={runtimeReport.report}
                            />
                            <LabeledLine
                              label="结果："
                              value={`level=${runtimeReport.report.level}, lockdownApplied=${String(
                                runtimeReport.report.state?.lockdownApplied,
                              )}`}
                            />
                            <LabeledLine
                              label="状态："
                              value={JSON.stringify(runtimeReport.report.state)}
                            />
                            {runtimeReport.report.patchWarnings.items.length ? (
                              <>
                                <SizableText size="$bodyMdMedium">
                                  Post-lockdown patch warnings (
                                  {
                                    runtimeReport.report.patchWarnings.items
                                      .length
                                  }
                                  )
                                </SizableText>
                                {runtimeReport.report.patchWarnings.items.map(
                                  (warning) => (
                                    <PatchWarningItem
                                      key={warning.id}
                                      warning={warning}
                                    />
                                  ),
                                )}
                              </>
                            ) : null}
                          </>
                        ) : (
                          <LabeledLine
                            label="结果："
                            value={runtimeReport.error ?? 'not available'}
                          />
                        )}
                      </YStack>
                    ))}
                  </YStack>
                ) : null}

                {report ? (
                  <YStack
                    gap="$2"
                    p="$3"
                    borderWidth="$px"
                    borderColor="$borderSubdued"
                    borderRadius="$2"
                  >
                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                      <Badge
                        badgeType={
                          report.patchWarnings.enabled ? 'success' : 'info'
                        }
                        badgeSize="sm"
                      >
                        <Badge.Text>
                          {report.patchWarnings.enabled
                            ? 'enabled'
                            : 'disabled'}
                        </Badge.Text>
                      </Badge>
                      <Badge
                        badgeType={
                          report.patchWarnings.installed ? 'success' : 'info'
                        }
                        badgeSize="sm"
                      >
                        <Badge.Text>
                          {report.patchWarnings.installed
                            ? 'installed'
                            : 'not installed'}
                        </Badge.Text>
                      </Badge>
                      <Badge
                        badgeType={
                          report.patchWarnings.items.length > 0
                            ? 'warning'
                            : 'success'
                        }
                        badgeSize="sm"
                      >
                        <Badge.Text>
                          unique: {report.patchWarnings.uniqueCount}/
                          {report.patchWarnings.limit}
                        </Badge.Text>
                      </Badge>
                      <SizableText size="$bodyLgMedium">
                        Post-lockdown patch warnings
                      </SizableText>
                    </XStack>
                    <LabeledLine
                      label="功能："
                      value={`仅 dev mode 下记录 lockdown 后尝试 patch 冻结对象并抛出的只读/不可扩展错误，最多保留最近 ${report.patchWarnings.limit} 类唯一提醒。`}
                    />
                    <LabeledLine
                      label="硬化点："
                      value="不改变业务函数行为，只监听 error/unhandledrejection，并按 kind + message + source/stack 生成 fingerprint 去重。"
                    />
                    <LabeledLine
                      label="目的："
                      value="用于判断某个 patch 是否应该移动到 harden 之前，还是属于异常篡改行为；生产环境不安装，降低运行时开销。"
                    />
                    <LabeledLine
                      label="结果："
                      value={`enabled=${String(
                        report.patchWarnings.enabled,
                      )}, installed=${String(
                        report.patchWarnings.installed,
                      )}, unique=${report.patchWarnings.uniqueCount}, totalRecorded=${
                        report.patchWarnings.totalRecorded
                      }`}
                    />
                    {report.patchWarnings.items.length === 0 ? (
                      <SizableText color="$textSubdued">
                        当前没有记录到 post-lockdown patch warning。
                      </SizableText>
                    ) : (
                      report.patchWarnings.items.map((warning) => (
                        <PatchWarningItem key={warning.id} warning={warning} />
                      ))
                    )}
                  </YStack>
                ) : null}

                {checksWithCoverage.map(({ coverageItem, check }) => (
                  <YStack
                    key={coverageItem.name}
                    gap="$1"
                    p="$3"
                    borderWidth="$px"
                    borderColor="$borderSubdued"
                    borderRadius="$2"
                  >
                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                      <Badge badgeType="info" badgeSize="sm">
                        <Badge.Text>
                          {getDimensionLabel(coverageItem.dimension)}
                        </Badge.Text>
                      </Badge>
                      {check ? (
                        <Badge
                          badgeType={getCheckBadgeType(check.status)}
                          badgeSize="sm"
                        >
                          <Badge.Text>{check.status}</Badge.Text>
                        </Badge>
                      ) : (
                        <Badge badgeType="info" badgeSize="sm">
                          <Badge.Text>not run</Badge.Text>
                        </Badge>
                      )}
                      <SizableText size="$bodyLgMedium">
                        {coverageItem.title}
                      </SizableText>
                    </XStack>

                    <LabeledLine
                      label="功能："
                      value={coverageItem.functionality}
                    />
                    <LabeledLine
                      label="硬化点："
                      value={coverageItem.hardening}
                    />

                    {check ? (
                      <>
                        <LabeledLine label="目的：" value={check.purpose} />
                        <LabeledLine label="结果：" value={check.detail} />
                      </>
                    ) : null}
                  </YStack>
                ))}

                {report ? (
                  <YStack gap="$2">
                    <SizableText size="$bodyLgMedium">
                      复制结果 JSON
                    </SizableText>
                    <TextAreaInput
                      value={reportText}
                      editable={false}
                      minHeight={220}
                    />
                  </YStack>
                ) : null}
              </YStack>
            </CollapsibleSection>
            <CollapsibleSection value="levels" title="L0 / L1 / L2 区别">
              <YStack gap="$3">
                <SizableText color="$textSubdued">
                  lockdown 在当前 JS realm 内不可逆。当前等级只由
                  packages/shared/src/security/sesHarden/config.ts
                  的同步常量控制； 修改 L0/L1/L2 后需要重新构建或 reload
                  让入口按新常量初始化。当前实现里 L2 相比 L1 只额外把
                  evalTaming 从 unsafe-eval 收紧到 safe-eval。
                </SizableText>
                <SizableText color="$textSubdued">
                  图例：✅ 启用或收紧；❌ 未启用或未收紧；➖
                  保持原生兼容、默认值或回滚用途。
                </SizableText>
                <YStack
                  borderWidth="$px"
                  borderColor="$borderSubdued"
                  borderRadius="$2"
                  overflow="hidden"
                >
                  <XStack bg="$bgSubdued" borderBottomWidth="$px">
                    <YStack width={168} p="$3">
                      <SizableText size="$bodyMd" fontWeight="600">
                        配置项
                      </SizableText>
                    </YStack>
                    <YStack flex={1} p="$3" alignItems="flex-end">
                      <SizableText
                        size="$bodyMd"
                        fontWeight="600"
                        textAlign="right"
                      >
                        L0
                      </SizableText>
                    </YStack>
                    <YStack flex={1} p="$3" alignItems="flex-end">
                      <SizableText
                        size="$bodyMd"
                        fontWeight="600"
                        textAlign="right"
                      >
                        L1
                      </SizableText>
                    </YStack>
                    <YStack flex={1} p="$3" alignItems="flex-end">
                      <SizableText
                        size="$bodyMd"
                        fontWeight="600"
                        textAlign="right"
                      >
                        L2
                      </SizableText>
                    </YStack>
                  </XStack>
                  {SES_LEVEL_MATRIX.map((item) => (
                    <XStack key={item.item} borderTopWidth="$px">
                      <YStack width={168} p="$3">
                        <SizableText
                          size="$bodyMd"
                          fontWeight="600"
                          textDecorationLine="underline"
                          onPress={() => showLevelMatrixItemDialog(item)}
                        >
                          {item.item}
                        </SizableText>
                      </YStack>
                      <YStack flex={1} p="$3" alignItems="flex-end">
                        <SizableText
                          size="$bodyLg"
                          textAlign="right"
                          onPress={() =>
                            showLevelMatrixCellDialog({
                              item,
                              level: 'L0',
                              cell: item.l0,
                            })
                          }
                        >
                          {item.l0.emoji}
                        </SizableText>
                      </YStack>
                      <YStack flex={1} p="$3" alignItems="flex-end">
                        <SizableText
                          size="$bodyLg"
                          textAlign="right"
                          onPress={() =>
                            showLevelMatrixCellDialog({
                              item,
                              level: 'L1',
                              cell: item.l1,
                            })
                          }
                        >
                          {item.l1.emoji}
                        </SizableText>
                      </YStack>
                      <YStack flex={1} p="$3" alignItems="flex-end">
                        <SizableText
                          size="$bodyLg"
                          textAlign="right"
                          onPress={() =>
                            showLevelMatrixCellDialog({
                              item,
                              level: 'L2',
                              cell: item.l2,
                            })
                          }
                        >
                          {item.l2.emoji}
                        </SizableText>
                      </YStack>
                    </XStack>
                  ))}
                </YStack>
              </YStack>
            </CollapsibleSection>
          </Accordion>
        </YStack>
      </Page.Body>
    </Page>
  );
}
