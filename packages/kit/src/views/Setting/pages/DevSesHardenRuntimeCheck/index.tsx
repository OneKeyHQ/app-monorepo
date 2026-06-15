// cspell:ignore lockdown evalTaming tamper
import { useCallback, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  Dialog,
  Page,
  SizableText,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  SES_HARDEN_LEVEL_STORAGE_KEY,
  SES_HARDEN_PATCH_WARNING_LIMIT,
  getSesHardenLevelFromRuntime,
  getSesHardenPatchWarnings,
  isSesHardenPatchWarningMonitorEnabled,
} from '@onekeyhq/shared/src/security/sesHarden';
import type {
  ISesHardenLevel,
  ISesHardenPatchWarning,
  ISesHardenRuntimeState,
} from '@onekeyhq/shared/src/security/sesHarden';

type ISesHardenDevGlobal = typeof globalThis & {
  __ONEKEY_SES_HARDEN_STATE__?: ISesHardenRuntimeState;
  __ONEKEY_SES_HARDEN_PATCH_WARNINGS__?: ISesHardenPatchWarning[];
  __ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__?: number;
  __ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__?: boolean;
  __ONEKEY_SET_SES_HARDEN_LEVEL__?: (level?: ISesHardenLevel | null) => void;
  harden?: (value: unknown) => unknown;
  location?: Location;
  localStorage?: Storage;
  navigator?: Navigator;
};

type ISesCheckStatus = 'pass' | 'fail' | 'info';
type ISesCheckDimension =
  | 'runtime-state'
  | 'functionality'
  | 'tamper-resistance';

type ISesRuntimeCheckItem = {
  name: string;
  dimension: ISesCheckDimension;
  status: ISesCheckStatus;
  purpose: string;
  detail: string;
};

type ISesRuntimeCheckCoverageItem = {
  name: string;
  dimension: ISesCheckDimension;
  title: string;
  functionality: string;
  hardening: string;
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

type ISesCheckDimensionSummary = Record<
  ISesCheckDimension,
  {
    total: number;
    passed: number;
    failed: number;
  }
>;

type ISesRuntimeCheckReport = {
  createdAt: string;
  level: ISesHardenLevel;
  runtime: {
    href?: string;
    userAgent?: string;
  };
  state?: ISesHardenRuntimeState;
  summary: {
    total: number;
    passed: number;
    failed: number;
    byDimension: ISesCheckDimensionSummary;
  };
  patchWarnings: {
    enabled: boolean;
    installed: boolean;
    limit: number;
    uniqueCount: number;
    totalRecorded: number;
    items: readonly ISesHardenPatchWarning[];
  };
  coverage: readonly ISesRuntimeCheckCoverageItem[];
  checks: ISesRuntimeCheckItem[];
};

const SES_RUNTIME_CHECK_COVERAGE: readonly ISesRuntimeCheckCoverageItem[] = [
  {
    name: 'Runtime state',
    dimension: 'runtime-state',
    title: 'Runtime state / 当前 SES 状态',
    functionality: '读取当前页面里的 SES 安装状态、运行端、等级和实际选项。',
    hardening:
      '确认当前 runtime 到底是 L0 未启用，还是 L1/L2 已执行 lockdown，避免误判测试环境。',
  },
  {
    name: 'lockdownApplied',
    dimension: 'runtime-state',
    title: 'lockdownApplied / lockdown 是否执行',
    functionality:
      '根据当前 L0/L1/L2 等级，检查 runtime 是否应该已经执行 lockdown。',
    hardening:
      'L1/L2 通过代表 SES lockdown 已进入当前 JS realm；L0 通过代表当前保持原生 JS 行为。',
  },
  {
    name: 'Object.prototype frozen',
    dimension: 'tamper-resistance',
    title: 'Object.prototype frozen / Object 原型冻结',
    functionality: '检查 Object.prototype 是否已经被冻结。',
    hardening:
      '这是核心硬化项之一。冻结后第三方代码不能再篡改 Object.prototype 来污染所有普通对象。',
  },
  {
    name: 'Array.prototype frozen',
    dimension: 'tamper-resistance',
    title: 'Array.prototype frozen / Array 原型冻结',
    functionality: '检查 Array.prototype 是否已经被冻结。',
    hardening:
      '这是核心硬化项之一。冻结后第三方代码不能再篡改数组方法影响全局数组行为。',
  },
  {
    name: 'global harden',
    dimension: 'runtime-state',
    title: 'global harden / SES harden 函数',
    functionality: '检查 lockdown 后 globalThis.harden 是否可用。',
    hardening:
      'harden 是 SES 提供的对象图冻结能力，用来冻结我们显式传给不可信代码的 API facade。',
  },
  {
    name: 'Patch warning monitor',
    dimension: 'runtime-state',
    title: 'Patch warning monitor / patch 失败提醒',
    functionality:
      '检查 dev mode 下 L1/L2 是否安装了 post-lockdown patch warning monitor，并统计去重后的最近记录。',
    hardening:
      '当 harden 后代码继续尝试改写被冻结对象并抛出只读/不可扩展错误时，monitor 会按 fingerprint 去重记录提醒，方便判断是启动顺序问题还是异常篡改。',
  },
  {
    name: 'harden deep freeze',
    dimension: 'tamper-resistance',
    title: 'harden deep freeze / 对象图深冻结',
    functionality:
      '创建嵌套对象后调用 harden，检查根对象和内部对象是否都被冻结。',
    hardening:
      '确认 harden 不只是浅冻结，而是能递归冻结对象图，防止 facade 内部对象被改写。',
  },
  {
    name: 'Function global escape',
    dimension: 'tamper-resistance',
    title: 'Function global escape / 动态函数逃逸',
    functionality:
      "执行 Function('return this')()，检查动态函数是否还能拿到 globalThis。",
    hardening:
      'L1 允许原生动态执行，所以应保持 native；L2 开启 safe-eval 后应阻止这种 globalThis 逃逸。',
  },
  {
    name: 'JSON roundtrip',
    dimension: 'functionality',
    title: 'JSON roundtrip / JSON 序列化',
    functionality: '检查 JSON.stringify 和 JSON.parse 是否仍能正常工作。',
    hardening:
      '这是兼容性检查，不是新增硬化项。用于确认 lockdown 没有破坏基础序列化能力。',
  },
  {
    name: 'Promise microtask',
    dimension: 'functionality',
    title: 'Promise microtask / Promise 微任务',
    functionality: '检查 Promise.resolve 和微任务调度是否仍能正常工作。',
    hardening:
      '这是兼容性检查，不是新增硬化项。用于确认异步任务调度没有被 harden 影响。',
  },
  {
    name: 'Intl.NumberFormat',
    dimension: 'functionality',
    title: 'Intl.NumberFormat / 金额与本地化格式化',
    functionality: '检查 Intl.NumberFormat 金额格式化是否仍能正常工作。',
    hardening:
      '这是兼容性检查。当前 localeTaming 保持 unsafe，目的是避免金额和本地化显示被改坏。',
  },
  {
    name: 'RegExp',
    dimension: 'functionality',
    title: 'RegExp / 正则表达式',
    functionality: '检查基础正则匹配是否仍能正常工作。',
    hardening:
      '这是兼容性检查。当前 regExpTaming 保持 unsafe，目的是避免改动正则行为影响业务逻辑。',
  },
  {
    name: 'Error stack',
    dimension: 'functionality',
    title: 'Error stack / 错误堆栈',
    functionality: '检查 Error.stack 是否仍然存在且可读。',
    hardening:
      '这是诊断能力检查。当前 errorTaming 使用 unsafe-debug，保留原始 stack，方便 Sentry 排查问题。',
  },
  {
    name: 'Tamper Object.prototype',
    dimension: 'tamper-resistance',
    title: 'Tamper Object.prototype / 尝试污染 Object 原型',
    functionality: '主动尝试给 Object.prototype 写入新属性。',
    hardening:
      'L1/L2 应阻止写入和 defineProperty，避免原型污染扩散到所有普通对象。',
  },
  {
    name: 'Tamper Array.prototype.push',
    dimension: 'tamper-resistance',
    title: 'Tamper Array.prototype.push / 尝试替换数组方法',
    functionality: '主动尝试替换 Array.prototype.push。',
    hardening: 'L1/L2 应阻止替换数组内建方法，避免第三方代码改写全局数组行为。',
  },
  {
    name: 'Tamper JSON.stringify',
    dimension: 'tamper-resistance',
    title: 'Tamper JSON.stringify / 尝试替换 JSON 序列化',
    functionality: '主动尝试替换 JSON.stringify。',
    hardening: 'L1/L2 应阻止改写 JSON.stringify，避免序列化结果被全局劫持。',
  },
  {
    name: 'Tamper Promise.resolve',
    dimension: 'tamper-resistance',
    title: 'Tamper Promise.resolve / 尝试替换 Promise.resolve',
    functionality: '主动尝试替换 Promise.resolve。',
    hardening: 'L1/L2 应阻止改写 Promise.resolve，避免异步控制流被全局劫持。',
  },
  {
    name: 'Tamper RegExp.prototype.test',
    dimension: 'tamper-resistance',
    title: 'Tamper RegExp.prototype.test / 尝试替换正则方法',
    functionality: '主动尝试替换 RegExp.prototype.test。',
    hardening: 'L1/L2 应阻止改写正则匹配方法，避免校验逻辑被全局篡改。',
  },
  {
    name: 'Tamper Error.prototype.stack',
    dimension: 'tamper-resistance',
    title: 'Tamper Error.prototype.stack / 尝试注入错误堆栈 getter',
    functionality: '主动尝试在 Error.prototype 上定义 stack getter。',
    hardening:
      'L1/L2 应阻止在 Error.prototype 上注入 stack getter，避免诊断信息被全局劫持。',
  },
  {
    name: 'Tamper hardened object',
    dimension: 'tamper-resistance',
    title: 'Tamper hardened object / 尝试修改 harden 后对象',
    functionality: '主动尝试修改 harden 后对象的根属性和嵌套属性。',
    hardening:
      'harden 后对象图应不可改写，适合保护暴露给不可信代码的 API facade。',
  },
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
      'overrideTaming 控制对属性覆盖/override 的兼容策略，moderate 是 SES 推荐的兼容折中档。',
    l0: {
      emoji: '❌',
      detail: 'L0 不启用 SES，因此没有 overrideTaming。',
    },
    l1: {
      emoji: '✅',
      detail:
        "L1 使用 'moderate'，降低 prototype override 风险，同时保留一定兼容性。",
    },
    l2: {
      emoji: '✅',
      detail: "L2 与 L1 一样使用 'moderate'。",
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
      detail: 'L0 是默认值、紧急回滚和对照组。',
    },
    l1: {
      emoji: '✅',
      detail: 'L1 是第一阶段灰度推荐值，先验证基础功能和防篡改。',
    },
    l2: {
      emoji: '✅',
      detail: 'L2 是第二阶段收紧，需在 L1 全量回归稳定后推进。',
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

function arePropertyDescriptorsEquivalent(
  left?: PropertyDescriptor,
  right?: PropertyDescriptor,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;

  const leftGet = Reflect.get(left, 'get') as unknown;
  const rightGet = Reflect.get(right, 'get') as unknown;
  const leftSet = Reflect.get(left, 'set') as unknown;
  const rightSet = Reflect.get(right, 'set') as unknown;
  const accessorsEquivalent =
    Object.is(leftGet, rightGet) && Object.is(leftSet, rightSet);

  return (
    left.configurable === right.configurable &&
    left.enumerable === right.enumerable &&
    left.writable === right.writable &&
    Object.is(left.value, right.value) &&
    accessorsEquivalent
  );
}

function restorePropertyDescriptor(
  target: object,
  propertyKey: PropertyKey,
  originalDescriptor?: PropertyDescriptor,
) {
  if (originalDescriptor) {
    Reflect.defineProperty(target, propertyKey, originalDescriptor);
  } else {
    Reflect.deleteProperty(target, propertyKey);
  }
}

function buildCheck(
  name: string,
  dimension: ISesCheckDimension,
  purpose: string,
  passed: boolean,
  detail: string,
): ISesRuntimeCheckItem {
  return {
    name,
    dimension,
    status: passed ? 'pass' : 'fail',
    purpose,
    detail,
  };
}

function runPropertyTamperCheck({
  name,
  purpose,
  target,
  propertyKey,
  replacement,
  defineDescriptor,
}: {
  name: string;
  purpose: string;
  target: object;
  propertyKey: PropertyKey;
  replacement: unknown;
  defineDescriptor?: PropertyDescriptor;
}): ISesRuntimeCheckItem {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    target,
    propertyKey,
  );
  let assignmentResult: boolean | 'threw' = false;
  let assignmentError: string | undefined;
  let assignmentMutated = false;
  let definePropertyResult: boolean | 'threw' = false;
  let definePropertyError: string | undefined;
  let definePropertyMutated = false;

  try {
    assignmentResult = Reflect.set(target, propertyKey, replacement);
    assignmentMutated = !arePropertyDescriptorsEquivalent(
      originalDescriptor,
      Object.getOwnPropertyDescriptor(target, propertyKey),
    );
  } catch (error) {
    assignmentResult = 'threw';
    assignmentError = getErrorMessage(error);
  } finally {
    restorePropertyDescriptor(target, propertyKey, originalDescriptor);
  }

  try {
    definePropertyResult = Reflect.defineProperty(
      target,
      propertyKey,
      defineDescriptor ?? {
        value: replacement,
        configurable: true,
        writable: true,
      },
    );
    definePropertyMutated = !arePropertyDescriptorsEquivalent(
      originalDescriptor,
      Object.getOwnPropertyDescriptor(target, propertyKey),
    );
  } catch (error) {
    definePropertyResult = 'threw';
    definePropertyError = getErrorMessage(error);
  } finally {
    restorePropertyDescriptor(target, propertyKey, originalDescriptor);
  }

  const finalRestored = arePropertyDescriptorsEquivalent(
    originalDescriptor,
    Object.getOwnPropertyDescriptor(target, propertyKey),
  );
  const passed = !assignmentMutated && !definePropertyMutated && finalRestored;

  return buildCheck(
    name,
    'tamper-resistance',
    purpose,
    passed,
    JSON.stringify({
      assignmentResult,
      assignmentError,
      assignmentMutated,
      definePropertyResult,
      definePropertyError,
      definePropertyMutated,
      finalRestored,
    }),
  );
}

function runHardenedObjectTamperCheck(
  g: ISesHardenDevGlobal,
): ISesRuntimeCheckItem {
  const purpose =
    '验证 harden 后对象图不能被改写，包括根属性、嵌套属性和新增属性。';

  if (typeof g.harden !== 'function') {
    return buildCheck(
      'Tamper hardened object',
      'tamper-resistance',
      purpose,
      false,
      'globalThis.harden is not available',
    );
  }

  const value = {
    enabled: true,
    nested: {
      ok: true,
    },
  };
  const hardenedValue = g.harden(value) as typeof value & {
    extra?: boolean;
  };

  let rootSetResult: boolean | 'threw' = false;
  let rootSetError: string | undefined;
  let nestedSetResult: boolean | 'threw' = false;
  let nestedSetError: string | undefined;
  let defineExtraResult: boolean | 'threw' = false;
  let defineExtraError: string | undefined;

  try {
    rootSetResult = Reflect.set(hardenedValue, 'enabled', false);
  } catch (error) {
    rootSetResult = 'threw';
    rootSetError = getErrorMessage(error);
  }

  try {
    nestedSetResult = Reflect.set(hardenedValue.nested, 'ok', false);
  } catch (error) {
    nestedSetResult = 'threw';
    nestedSetError = getErrorMessage(error);
  }

  try {
    defineExtraResult = Reflect.defineProperty(hardenedValue, 'extra', {
      value: true,
      configurable: true,
      writable: true,
    });
  } catch (error) {
    defineExtraResult = 'threw';
    defineExtraError = getErrorMessage(error);
  }

  const rootMutated = hardenedValue.enabled !== true;
  const nestedMutated = hardenedValue.nested.ok !== true;
  const extraAdded = Object.prototype.hasOwnProperty.call(
    hardenedValue,
    'extra',
  );
  const passed = !rootMutated && !nestedMutated && !extraAdded;

  return buildCheck(
    'Tamper hardened object',
    'tamper-resistance',
    purpose,
    passed,
    JSON.stringify({
      rootSetResult,
      rootSetError,
      rootMutated,
      nestedSetResult,
      nestedSetError,
      nestedMutated,
      defineExtraResult,
      defineExtraError,
      extraAdded,
    }),
  );
}

function buildDimensionSummary(
  checks: ISesRuntimeCheckItem[],
): ISesCheckDimensionSummary {
  const summary: ISesCheckDimensionSummary = {
    'runtime-state': {
      total: 0,
      passed: 0,
      failed: 0,
    },
    functionality: {
      total: 0,
      passed: 0,
      failed: 0,
    },
    'tamper-resistance': {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };

  checks.forEach((check) => {
    summary[check.dimension].total += 1;
    if (check.status === 'pass') {
      summary[check.dimension].passed += 1;
    } else if (check.status === 'fail') {
      summary[check.dimension].failed += 1;
    }
  });

  return summary;
}

function runFunctionGlobalEscapeCheck(
  level: ISesHardenLevel,
): ISesRuntimeCheckItem {
  try {
    const getGlobal = Reflect.construct(Function, [
      'return this',
    ]) as () => unknown;
    const result = getGlobal();
    const reachesGlobal = result === globalThis;
    const expected = level === 'L2' ? !reachesGlobal : reachesGlobal;

    return buildCheck(
      'Function global escape',
      'tamper-resistance',
      '验证 L2 safe-eval 后动态函数不能逃逸拿到 globalThis。',
      expected,
      `reachesGlobal=${String(reachesGlobal)}, expected ${
        level === 'L2' ? 'blocked' : 'native'
      }`,
    );
  } catch (error) {
    return buildCheck(
      'Function global escape',
      'tamper-resistance',
      '验证 L2 safe-eval 后动态函数不能逃逸拿到 globalThis。',
      level === 'L2',
      `threw=${getErrorMessage(error)}`,
    );
  }
}

async function buildSesRuntimeCheckReport(): Promise<ISesRuntimeCheckReport> {
  const g = getSesGlobal();
  const level = getSesHardenLevelFromRuntime();
  const state = g.__ONEKEY_SES_HARDEN_STATE__;
  const checks: ISesRuntimeCheckItem[] = [];
  const shouldBeLockedDown = level !== 'L0';
  const patchWarnings = getSesHardenPatchWarnings();
  const patchWarningMonitorEnabled = isSesHardenPatchWarningMonitorEnabled();
  const patchWarningMonitorInstalled =
    g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__ === true;
  const shouldInstallPatchWarningMonitor =
    shouldBeLockedDown && patchWarningMonitorEnabled;
  const totalPatchWarningsRecorded =
    g.__ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__ ?? patchWarnings.length;

  checks.push(
    buildCheck(
      'Runtime state',
      'runtime-state',
      '确认当前运行端实际启用的 SES harden 等级和状态。',
      !!state,
      state ? JSON.stringify(state) : 'missing __ONEKEY_SES_HARDEN_STATE__',
    ),
  );

  checks.push(
    buildCheck(
      'lockdownApplied',
      'runtime-state',
      '确认 L1/L2 已执行 lockdown，L0 没有执行 lockdown。',
      shouldBeLockedDown
        ? state?.lockdownApplied === true
        : state?.lockdownApplied !== true,
      `actual=${String(state?.lockdownApplied)}, level=${level}`,
    ),
  );

  checks.push(
    buildCheck(
      'Object.prototype frozen',
      'tamper-resistance',
      '确认 Object.prototype 已被冻结，作为防原型污染的基础状态。',
      shouldBeLockedDown
        ? Object.isFrozen(Object.prototype)
        : !Object.isFrozen(Object.prototype),
      `Object.isFrozen(Object.prototype)=${String(
        Object.isFrozen(Object.prototype),
      )}`,
    ),
  );

  checks.push(
    buildCheck(
      'Array.prototype frozen',
      'tamper-resistance',
      '确认 Array.prototype 已被冻结，作为防全局数组行为篡改的基础状态。',
      shouldBeLockedDown
        ? Object.isFrozen(Array.prototype)
        : !Object.isFrozen(Array.prototype),
      `Object.isFrozen(Array.prototype)=${String(
        Object.isFrozen(Array.prototype),
      )}`,
    ),
  );

  const hasHarden = typeof g.harden === 'function';
  checks.push(
    buildCheck(
      'global harden',
      'runtime-state',
      '确认 lockdown 后 SES 提供的 harden 函数是否存在。',
      shouldBeLockedDown ? hasHarden : !hasHarden,
      `typeof harden=${typeof g.harden}`,
    ),
  );

  checks.push(
    buildCheck(
      'Patch warning monitor',
      'runtime-state',
      '确认 dev mode 下 L1/L2 已安装 harden 后 patch 失败提醒，L0 和生产环境不安装。',
      shouldInstallPatchWarningMonitor
        ? patchWarningMonitorInstalled
        : !patchWarningMonitorInstalled,
      JSON.stringify({
        enabled: patchWarningMonitorEnabled,
        installed: patchWarningMonitorInstalled,
        uniqueWarningCount: patchWarnings.length,
        limit: SES_HARDEN_PATCH_WARNING_LIMIT,
        totalRecorded: totalPatchWarningsRecorded,
      }),
    ),
  );

  if (hasHarden) {
    const value = { nested: { ok: true } };
    const hardenedValue = g.harden?.(value);
    checks.push(
      buildCheck(
        'harden deep freeze',
        'tamper-resistance',
        '确认 harden 会递归冻结对象图。',
        Object.isFrozen(hardenedValue) && Object.isFrozen(value.nested),
        `rootFrozen=${String(
          Object.isFrozen(hardenedValue),
        )}, nestedFrozen=${String(Object.isFrozen(value.nested))}`,
      ),
    );
  }

  checks.push(runFunctionGlobalEscapeCheck(level));

  try {
    const parsed = JSON.parse(JSON.stringify({ ok: true })) as { ok: boolean };
    checks.push(
      buildCheck(
        'JSON roundtrip',
        'functionality',
        '确认 harden 后 JSON.stringify 和 JSON.parse 仍然可用。',
        parsed.ok === true,
        'ok=true',
      ),
    );
  } catch (error) {
    checks.push(
      buildCheck(
        'JSON roundtrip',
        'functionality',
        '确认 harden 后 JSON.stringify 和 JSON.parse 仍然可用。',
        false,
        getErrorMessage(error),
      ),
    );
  }

  try {
    const promiseValue = await Promise.resolve(42);
    checks.push(
      buildCheck(
        'Promise microtask',
        'functionality',
        '确认 harden 后 Promise.resolve 和微任务调度仍然可用。',
        promiseValue === 42,
        `value=${promiseValue}`,
      ),
    );
  } catch (error) {
    checks.push(
      buildCheck(
        'Promise microtask',
        'functionality',
        '确认 harden 后 Promise.resolve 和微任务调度仍然可用。',
        false,
        getErrorMessage(error),
      ),
    );
  }

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(1234.5);
    checks.push(
      buildCheck(
        'Intl.NumberFormat',
        'functionality',
        '确认 harden 后金额和本地化格式化仍然可用。',
        formatted.includes('1,234.50'),
        formatted,
      ),
    );
  } catch (error) {
    checks.push(
      buildCheck(
        'Intl.NumberFormat',
        'functionality',
        '确认 harden 后金额和本地化格式化仍然可用。',
        false,
        getErrorMessage(error),
      ),
    );
  }

  try {
    const matched = /^onekey-\d+$/.test('onekey-2026');
    checks.push(
      buildCheck(
        'RegExp',
        'functionality',
        '确认 harden 后正则表达式匹配仍然可用。',
        matched,
        `matched=${String(matched)}`,
      ),
    );
  } catch (error) {
    checks.push(
      buildCheck(
        'RegExp',
        'functionality',
        '确认 harden 后正则表达式匹配仍然可用。',
        false,
        getErrorMessage(error),
      ),
    );
  }

  const error = new OneKeyLocalError('ses harden stack check');
  const { stack } = error;
  checks.push(
    buildCheck(
      'Error stack',
      'functionality',
      '确认 harden 后错误堆栈仍然可用于 Sentry 和问题排查。',
      typeof stack === 'string' && stack.length > 0,
      `stackLength=${String(stack?.length ?? 0)}`,
    ),
  );

  const tamperedFunction = () => 'tampered';
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Object.prototype',
      purpose:
        '验证 Object.prototype 不能被新增属性，防止全局普通对象被原型污染。',
      target: Object.prototype,
      propertyKey: '__onekeySesTamperProbe__',
      replacement: true,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Array.prototype.push',
      purpose: '验证 Array.prototype.push 不能被替换，防止全局数组行为被篡改。',
      target: Array.prototype,
      propertyKey: 'push',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper JSON.stringify',
      purpose: '验证 JSON.stringify 不能被替换，防止全局序列化行为被劫持。',
      target: JSON,
      propertyKey: 'stringify',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Promise.resolve',
      purpose: '验证 Promise.resolve 不能被替换，防止异步控制流被全局劫持。',
      target: Promise,
      propertyKey: 'resolve',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper RegExp.prototype.test',
      purpose:
        '验证 RegExp.prototype.test 不能被替换，防止正则校验逻辑被全局篡改。',
      target: RegExp.prototype,
      propertyKey: 'test',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Error.prototype.stack',
      purpose:
        '验证 Error.prototype 不能被注入 stack getter，防止错误诊断信息被全局劫持。',
      target: Error.prototype,
      propertyKey: 'stack',
      replacement: 'tampered stack',
      defineDescriptor: {
        configurable: true,
        get: () => 'tampered stack',
      },
    }),
  );
  checks.push(runHardenedObjectTamperCheck(g));

  const failed = checks.filter((check) => check.status === 'fail').length;
  const byDimension = buildDimensionSummary(checks);

  return {
    createdAt: new Date().toISOString(),
    level,
    runtime: {
      href: g.location?.href,
      userAgent: g.navigator?.userAgent,
    },
    state,
    summary: {
      total: checks.length,
      passed: checks.length - failed,
      failed,
      byDimension,
    },
    patchWarnings: {
      enabled: patchWarningMonitorEnabled,
      installed: patchWarningMonitorInstalled,
      limit: SES_HARDEN_PATCH_WARNING_LIMIT,
      uniqueCount: patchWarnings.length,
      totalRecorded: totalPatchWarningsRecorded,
      items: patchWarnings,
    },
    coverage: SES_RUNTIME_CHECK_COVERAGE,
    checks,
  };
}

export default function DevSesHardenRuntimeCheck() {
  const { copyText } = useClipboard();
  const [report, setReport] = useState<ISesRuntimeCheckReport>();
  const [isRunning, setIsRunning] = useState(false);

  const hasFailures = useMemo(
    () => report?.checks.some((check) => check.status === 'fail') ?? false,
    [report],
  );

  const reportText = useMemo(
    () => (report ? JSON.stringify(report, null, 2) : ''),
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
      const nextReport = await buildSesRuntimeCheckReport();
      setReport(nextReport);
      if (nextReport.checks.some((check) => check.status === 'fail')) {
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

  const setLevelAndReload = useCallback((level: ISesHardenLevel | null) => {
    const g = getSesGlobal();
    if (typeof g.__ONEKEY_SET_SES_HARDEN_LEVEL__ === 'function') {
      g.__ONEKEY_SET_SES_HARDEN_LEVEL__(level);
      return;
    }

    try {
      if (level) {
        g.localStorage?.setItem(SES_HARDEN_LEVEL_STORAGE_KEY, level);
      } else {
        g.localStorage?.removeItem(SES_HARDEN_LEVEL_STORAGE_KEY);
      }
    } catch {
      // Best-effort fallback for dev-only runtime switching.
    }

    g.location?.reload();
  }, []);

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

          <YStack gap="$3">
            <SizableText size="$headingLg">L0 / L1 / L2 区别</SizableText>
            <SizableText color="$textSubdued">
              lockdown 在当前 JS realm 内不可逆。页面里的 Set L0/L1/L2
              会写入本地配置并 reload，下一次启动时按新等级初始化。当前实现里 L2
              相比 L1 只额外把 evalTaming 从 unsafe-eval 收紧到 safe-eval。
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
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            <Button
              testID="ses-harden-set-l0"
              variant="secondary"
              onPress={() => setLevelAndReload('L0')}
            >
              Set L0 & Reload
            </Button>
            <Button
              testID="ses-harden-set-l1"
              variant="secondary"
              onPress={() => setLevelAndReload('L1')}
            >
              Set L1 & Reload
            </Button>
            <Button
              testID="ses-harden-set-l2"
              variant="secondary"
              onPress={() => setLevelAndReload('L2')}
            >
              Set L2 & Reload
            </Button>
            <Button
              testID="ses-harden-clear-level"
              variant="secondary"
              onPress={() => setLevelAndReload(null)}
            >
              Clear & Reload
            </Button>
          </XStack>

          <YStack gap="$3">
            <SizableText size="$headingLg">测试项目与结果</SizableText>
            <SizableText color="$textSubdued">
              每张卡片同时展示测试说明和运行结果。核心硬化验证是 Object/Array
              原型冻结、harden 深冻结，以及 L2 的动态函数逃逸限制。Tamper
              测试会主动尝试 set 和 defineProperty，确认 harden
              后不能篡改原型、内建函数和 hardened object。
            </SizableText>

            {report ? (
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodyLgMedium">总体结果</SizableText>
                <Badge
                  badgeType={hasFailures ? 'critical' : 'success'}
                  badgeSize="sm"
                >
                  <Badge.Text>{hasFailures ? 'Failed' : 'Passed'}</Badge.Text>
                </Badge>
              </XStack>
            ) : null}

            {report ? (
              <XStack gap="$2" flexWrap="wrap">
                {(
                  [
                    'runtime-state',
                    'functionality',
                    'tamper-resistance',
                  ] as const
                ).map((dimension) => {
                  const dimensionSummary =
                    report.summary.byDimension[dimension];
                  return (
                    <Badge
                      key={dimension}
                      badgeType={
                        dimensionSummary.failed > 0 ? 'critical' : 'success'
                      }
                      badgeSize="sm"
                    >
                      <Badge.Text>
                        {getDimensionLabel(dimension)}:{' '}
                        {dimensionSummary.passed}/{dimensionSummary.total}
                      </Badge.Text>
                    </Badge>
                  );
                })}
              </XStack>
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
                      {report.patchWarnings.enabled ? 'enabled' : 'disabled'}
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
                    <YStack
                      key={warning.id}
                      gap="$1"
                      p="$2"
                      borderWidth="$px"
                      borderColor="$borderSubdued"
                      borderRadius="$1"
                    >
                      <SizableText size="$bodyMdMedium">
                        #{warning.id} {warning.kind} count={warning.count}{' '}
                        lastSeenAt={warning.lastSeenAt}
                      </SizableText>
                      <SizableText color="$textSubdued">
                        createdAt={warning.createdAt}
                      </SizableText>
                      <SizableText color="$textSubdued">
                        {warning.message}
                      </SizableText>
                      <SizableText color="$textSubdued">
                        fingerprint={warning.fingerprint}
                      </SizableText>
                      {warning.source ? (
                        <SizableText color="$textSubdued">
                          {warning.source}:{warning.lineno ?? 0}:
                          {warning.colno ?? 0}
                        </SizableText>
                      ) : null}
                    </YStack>
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
                <LabeledLine label="硬化点：" value={coverageItem.hardening} />

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
                <SizableText size="$bodyLgMedium">复制结果 JSON</SizableText>
                <TextAreaInput
                  value={reportText}
                  editable={false}
                  minHeight={220}
                />
              </YStack>
            ) : null}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
