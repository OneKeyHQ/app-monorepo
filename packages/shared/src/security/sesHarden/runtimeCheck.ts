// cspell:ignore lockdown evalTaming tamper IndexedDB XHR randomBytes isNormalized oneKey Agentation
import appGlobals from '../../appGlobals';
import { OneKeyLocalError } from '../../errors';

import { isExtensionRuntime } from './options';
import {
  SES_HARDEN_PATCH_WARNING_LIMIT,
  getSesHardenLevelFromRuntime,
  getSesHardenPatchWarnings,
  isSesHardenPatchWarningMonitorEnabled,
} from './runtime';

import type {
  ISesHardenLevel,
  ISesHardenPatchWarning,
  ISesHardenRuntime,
  ISesHardenRuntimeState,
} from './types';

export const SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE =
  'ONEKEY_SES_HARDEN_RUNTIME_CHECK';

export type ISesCheckStatus = 'pass' | 'fail' | 'info';
export type ISesCheckDimension =
  | 'runtime-state'
  | 'functionality'
  | 'tamper-resistance';

export type ISesRuntimeCheckItem = {
  name: string;
  dimension: ISesCheckDimension;
  status: ISesCheckStatus;
  purpose: string;
  detail: string;
};

export type ISesRuntimeCheckCoverageItem = {
  name: string;
  dimension: ISesCheckDimension;
  title: string;
  functionality: string;
  hardening: string;
};

export type ISesCheckDimensionSummary = Record<
  ISesCheckDimension,
  {
    total: number;
    passed: number;
    failed: number;
  }
>;

export type ISesRuntimeCheckReport = {
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

export type ISesHardenRuntimeCheckMessage = {
  type: typeof SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE;
  targetRuntime: ISesHardenRuntime;
};

export type ISesHardenRuntimeCheckResponse =
  | {
      ok: true;
      report: ISesRuntimeCheckReport;
    }
  | {
      ok: false;
      error: string;
    };

type ISesHardenDevGlobal = typeof globalThis & {
  __ONEKEY_SES_HARDEN_STATE__?: ISesHardenRuntimeState;
  __ONEKEY_SES_HARDEN_PATCH_WARNINGS__?: ISesHardenPatchWarning[];
  __ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__?: number;
  __ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__?: boolean;
  harden?: (value: unknown) => unknown;
  location?: Location;
  navigator?: Navigator;
};

type ITimerSetter = (
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
) => unknown;

type ITimerClearer = (timerId: unknown) => void;

type IMessagePortLike = {
  close?: () => void;
  onmessage: (() => void) | null;
  postMessage: (message: unknown) => void;
};

type IMessageChannelLike = {
  port1: IMessagePortLike;
  port2: IMessagePortLike;
};

type IMessageChannelCtor = new () => IMessageChannelLike;

export const SES_RUNTIME_CHECK_COVERAGE: readonly ISesRuntimeCheckCoverageItem[] =
  [
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
        'web/desktop L1 允许原生动态执行，所以应保持 native；L2 开启 safe-eval 后应阻止这种 globalThis 逃逸；扩展 runtime 强制 no-eval，任何等级下动态函数都应被阻止。',
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
      name: 'Array patch methods',
      dimension: 'functionality',
      title: 'Array patch methods / 数组 polyfill 方法',
      functionality:
        '检查 flatMap、toSorted、toReversed 是否存在且基础行为正常。',
      hardening:
        '这些方法属于启动期 Array.prototype patch 或原生能力。lockdown 后 Array.prototype 会冻结，后续不能再补或改这些方法。',
    },
    {
      name: 'IndexedDB transaction shim',
      dimension: 'functionality',
      title: 'IndexedDB transaction shim / IndexedDB 写事务 shim',
      functionality:
        '检查 IDBDatabase.prototype.transaction 是否已安装 OneKey 磁盘空间检查 wrapper。',
      hardening:
        '该 host prototype patch 必须在 lockdown 前完成；Run checks 验证 wrapper 标记仍存在，避免业务启动后才尝试 patch。',
    },
    {
      name: 'fetch interceptor',
      dimension: 'functionality',
      title: 'fetch interceptor / fetch 请求拦截器',
      functionality:
        '检查 globalThis.fetch 是否仍为 OneKey 包装后的 fetch，并保留请求拦截 marker。',
      hardening:
        'fetch 是 host global，不属于 SES intrinsics 冻结范围；这里验证启动期 patch 已完成且没有被重复覆盖。',
    },
    {
      name: 'timer interceptor',
      dimension: 'functionality',
      title: 'timer interceptor / timer 拦截器',
      functionality:
        '检查 setTimeout 和 setInterval 是否仍为 OneKey 包装后的 timer。',
      hardening:
        'timer 是 host global，不属于 SES intrinsics 冻结范围；这里验证启动期 wrapper 已完成且 marker 仍存在。',
    },
    {
      name: 'crypto shim',
      dimension: 'functionality',
      title: 'crypto shim / crypto 随机数 shim',
      functionality:
        '检查 globalThis.crypto 的 OneKey shim marker、getRandomValues 和 randomBytes。',
      hardening:
        'crypto shim 必须在业务加密、UUID 和随机数使用前完成；Run checks 验证当前 runtime 仍能安全取随机数。',
    },
    {
      name: 'Extension API shim',
      dimension: 'functionality',
      title: 'Extension API shim / 扩展 API shim',
      functionality: '在扩展 runtime 检查 chrome/browser API 是否可用。',
      hardening:
        'chrome/browser 是扩展 host global，不由 SES 冻结；这里验证 extensionApiShim 已在业务初始化前完成。',
    },
    {
      name: 'Extension XHR shim',
      dimension: 'functionality',
      title: 'Extension XHR shim / 扩展 XHR shim',
      functionality: '在扩展 runtime 检查 XMLHttpRequest 构造器是否可用。',
      hardening:
        'XHR shim 是扩展 host API 兼容层，必须在依赖 XHR 的 SDK 或请求库初始化前完成。',
    },
    {
      name: 'Desktop API proxy',
      dimension: 'functionality',
      title: 'Desktop API proxy / Desktop bridge proxy',
      functionality:
        '在 desktop renderer 检查 globalThis.desktopApiProxy 是否已安装。',
      hardening:
        'desktopApiProxy 是 Desktop renderer 能力入口，必须在 lockdown 前完成安装，业务模块在锁后读取。',
    },
    {
      name: 'Extension bridge globals',
      dimension: 'functionality',
      title: 'Extension bridge globals / 扩展 bridge 全局对象',
      functionality:
        '在扩展 runtime 检查 UI/offscreen/background bridge 关键 appGlobals 是否已连接。',
      hardening:
        'bridge 初始化是扩展通信的启动期白名单；Run checks 验证锁前初始化结果在锁后仍可被业务使用。',
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
      hardening:
        'L1/L2 应阻止替换数组内建方法，避免第三方代码改写全局数组行为。',
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

function getSesGlobal(): ISesHardenDevGlobal {
  return globalThis as ISesHardenDevGlobal;
}

function getGlobalRecord(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
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

function buildInfoCheck(
  name: string,
  dimension: ISesCheckDimension,
  purpose: string,
  detail: string,
): ISesRuntimeCheckItem {
  return {
    name,
    dimension,
    status: 'info',
    purpose,
    detail,
  };
}

function runPropertyTamperCheck({
  name,
  purpose,
  expectBlocked,
  target,
  propertyKey,
  replacement,
  defineDescriptor,
}: {
  name: string;
  purpose: string;
  expectBlocked: boolean;
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
  const blocked = !assignmentMutated && !definePropertyMutated && finalRestored;
  const allowedAndRestored =
    (assignmentMutated || definePropertyMutated) && finalRestored;
  const passed = expectBlocked ? blocked : allowedAndRestored;

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
      expectBlocked,
      blocked,
      allowedAndRestored,
    }),
  );
}

function runHardenedObjectTamperCheck(
  g: ISesHardenDevGlobal,
  level: ISesHardenLevel,
): ISesRuntimeCheckItem {
  const purpose =
    '验证 harden 后对象图不能被改写，包括根属性、嵌套属性和新增属性。';

  if (typeof g.harden !== 'function') {
    if (level === 'L0') {
      return buildInfoCheck(
        'Tamper hardened object',
        'tamper-resistance',
        purpose,
        'L0 does not install globalThis.harden, so hardened object tamper check is skipped.',
      );
    }

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

// Exported for the SES self-check test suite so the ext no-eval expectation can
// be asserted directly without standing up a full lockdown.
export function runFunctionGlobalEscapeCheck(
  level: ISesHardenLevel,
  runtime?: ISesHardenRuntime,
): ISesRuntimeCheckItem {
  // Extension runtimes are forced to `evalTaming: 'no-eval'` for every level
  // (see getSesLockdownOptions in options.ts), because the extension CSP forbids
  // host eval / new Function. On ext, `new Function('return this')()` is
  // therefore expected to be blocked entirely (throws) regardless of L1/L2, so a
  // blocked dynamic function IS the secure outcome here. For web/desktop the
  // level-based expectation stays: L1 keeps native eval, L2 (safe-eval) must
  // prevent the globalThis escape.
  const evalBlockedByDesign = isExtensionRuntime(runtime);
  const purpose =
    '验证 L2 safe-eval 或扩展 no-eval 后动态函数不能逃逸拿到 globalThis。';
  const expectsBlocked = evalBlockedByDesign || level === 'L2';

  try {
    const getGlobal = Reflect.construct(Function, [
      'return this',
    ]) as () => unknown;
    const result = getGlobal();
    const reachesGlobal = result === globalThis;
    // When eval is blocked by design, `new Function` should not even succeed;
    // if it does run and reaches globalThis here, that is the insecure outcome.
    const expected = expectsBlocked ? !reachesGlobal : reachesGlobal;

    return buildCheck(
      'Function global escape',
      'tamper-resistance',
      purpose,
      expected,
      `reachesGlobal=${String(reachesGlobal)}, runtime=${
        runtime ?? 'unknown'
      }, expected ${expectsBlocked ? 'blocked' : 'native'}`,
    );
  } catch (error) {
    // A thrown `new Function` means dynamic code execution is blocked. That is
    // the secure expectation whenever eval is blocked by design (ext, any level)
    // or for L2 safe-eval; it is only a failure when we expected native eval.
    return buildCheck(
      'Function global escape',
      'tamper-resistance',
      purpose,
      expectsBlocked,
      `threw=${getErrorMessage(error)}, runtime=${runtime ?? 'unknown'}`,
    );
  }
}

function runArrayPatchMethodsCheck(): ISesRuntimeCheckItem {
  const purpose =
    '验证启动期 Array.prototype polyfill 或原生方法在 harden 后仍然可用。';

  try {
    const flatMapResult = [1, 2]
      .flatMap((value) => [value, value * 10])
      .join(',');
    const toSorted = Reflect.get(Array.prototype, 'toSorted') as
      | ((
          this: number[],
          compareFn?: (a: number, b: number) => number,
        ) => number[])
      | undefined;
    const toReversed = Reflect.get(Array.prototype, 'toReversed') as
      | ((this: number[]) => number[])
      | undefined;
    const sorted = toSorted?.call([3, 1, 2], (a, b) => a - b).join(',');
    const reversed = toReversed?.call([1, 2, 3]).join(',');
    const passed =
      flatMapResult === '1,10,2,20' &&
      sorted === '1,2,3' &&
      reversed === '3,2,1';

    return buildCheck(
      'Array patch methods',
      'functionality',
      purpose,
      passed,
      JSON.stringify({
        flatMapResult,
        hasToSorted: typeof toSorted === 'function',
        sorted,
        hasToReversed: typeof toReversed === 'function',
        reversed,
      }),
    );
  } catch (error) {
    return buildCheck(
      'Array patch methods',
      'functionality',
      purpose,
      false,
      getErrorMessage(error),
    );
  }
}

function runIndexedDbTransactionShimCheck(
  runtime?: string,
): ISesRuntimeCheckItem {
  const purpose =
    '验证 IndexedDB 写事务磁盘空间检查 wrapper 已在 harden 前安装。';
  const dbCtor = getGlobalRecord().IDBDatabase as
    | { prototype?: Record<PropertyKey, unknown> }
    | undefined;
  const prototype = dbCtor?.prototype;

  if (!prototype) {
    return buildCheck(
      'IndexedDB transaction shim',
      'functionality',
      purpose,
      false,
      `IDBDatabase is unavailable, runtime=${runtime ?? 'unknown'}`,
    );
  }

  const transaction = prototype.transaction;
  const transactionOriginal = prototype.transactionOriginal_a7c9d6a9;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'transaction');
  const passed =
    typeof transaction === 'function' &&
    typeof transactionOriginal === 'function' &&
    transaction !== transactionOriginal;

  return buildCheck(
    'IndexedDB transaction shim',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      runtime,
      hasTransaction: typeof transaction === 'function',
      hasOriginal: typeof transactionOriginal === 'function',
      wrapperInstalled: transaction !== transactionOriginal,
      writable: descriptor?.writable,
      configurable: descriptor?.configurable,
    }),
  );
}

function runFetchInterceptorCheck(): ISesRuntimeCheckItem {
  const purpose =
    '验证 globalThis.fetch 已安装 OneKey 请求拦截 wrapper，并且 marker 未丢失。';
  const fetchFn = getGlobalRecord().fetch;
  const marker =
    typeof fetchFn === 'function' &&
    Reflect.get(fetchFn, 'isNormalizedByOneKey') === true;

  return buildCheck(
    'fetch interceptor',
    'functionality',
    purpose,
    typeof fetchFn === 'function' && marker,
    JSON.stringify({
      fetchType: typeof fetchFn,
      isNormalizedByOneKey: marker,
    }),
  );
}

function getFunctionSourceSnippet(value: unknown): string | null {
  if (typeof value !== 'function') {
    return null;
  }

  try {
    return Function.prototype.toString.call(value).slice(0, 240);
  } catch (error) {
    return `source unavailable: ${getErrorMessage(error)}`;
  }
}

function getTimerInterceptorState(
  timerFn: unknown,
  expectedMarker: string,
): {
  marker: unknown;
  markerMatches: boolean;
  sourceLooksOneKeyIntercepted: boolean;
  sourceLooksAgentationWrapped: boolean;
  installed: boolean;
  sourceSnippet: string | null;
} {
  const marker =
    typeof timerFn === 'function'
      ? Reflect.get(timerFn, '__onekeyTimerInterceptor__')
      : undefined;
  const sourceSnippet = getFunctionSourceSnippet(timerFn);
  const sourceLooksOneKeyIntercepted =
    sourceSnippet?.includes(expectedMarker) === true ||
    sourceSnippet?.includes('interceptTimeout ERROR') === true ||
    sourceSnippet?.includes('oneKeyTimerInterceptor') === true;
  const sourceLooksAgentationWrapped =
    sourceSnippet?.includes('frozenTimeoutQueue') === true ||
    sourceSnippet?.includes('_s.origSetTimeout') === true ||
    sourceSnippet?.includes('_s.origSetInterval') === true;
  const markerMatches = marker === expectedMarker;

  return {
    marker,
    markerMatches,
    sourceLooksOneKeyIntercepted,
    sourceLooksAgentationWrapped,
    installed:
      markerMatches ||
      sourceLooksOneKeyIntercepted ||
      sourceLooksAgentationWrapped,
    sourceSnippet,
  };
}

function getMessageChannelCtor(): IMessageChannelCtor | undefined {
  const ctor = getGlobalRecord().MessageChannel;
  return typeof ctor === 'function'
    ? (ctor as unknown as IMessageChannelCtor)
    : undefined;
}

function waitRuntimeTask(): Promise<string> {
  const MessageChannelCtor = getMessageChannelCtor();
  if (MessageChannelCtor) {
    return new Promise((resolve) => {
      const channel = new MessageChannelCtor();
      channel.port1.onmessage = () => {
        channel.port1.onmessage = null;
        channel.port1.close?.();
        channel.port2.close?.();
        resolve('MessageChannel');
      };
      channel.port2.postMessage(undefined);
    });
  }

  const setImmediateFn = getGlobalRecord().setImmediate;
  if (typeof setImmediateFn === 'function') {
    return new Promise((resolve) => {
      (setImmediateFn as (callback: () => void) => unknown)(() => {
        resolve('setImmediate');
      });
    });
  }

  return Promise.resolve('Promise');
}

async function waitRuntimeTasks(count: number): Promise<string> {
  let method = 'none';
  for (let i = 0; i < count; i += 1) {
    method = await waitRuntimeTask();
  }
  return method;
}

function waitWithEnabledTimer(): Promise<string> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve('setTimeout');
    }, 20);
  });
}

async function runTimerBehaviorProbe({
  clearTimer,
  disabledFlag,
  setTimer,
}: {
  clearTimer: ITimerClearer;
  disabledFlag: '$$onekeyDisabledSetTimeout' | '$$onekeyDisabledSetInterval';
  setTimer: ITimerSetter;
}): Promise<{
  disabledCallbackRan: boolean;
  enabledCallbackRan: boolean;
  error?: string;
  disabledFlagBlocksCallbacks: boolean;
  waitMethod: string;
}> {
  const g = getGlobalRecord();
  const previousFlag = g[disabledFlag];
  let enabledCallbackCount = 0;
  let disabledCallbackCount = 0;
  let waitMethod = 'none';
  let enabledTimerId: unknown;
  let disabledTimerId: unknown;

  try {
    g[disabledFlag] = undefined;
    enabledTimerId = setTimer(() => {
      enabledCallbackCount += 1;
    }, 0);
    waitMethod = await waitWithEnabledTimer();

    g[disabledFlag] = true;
    disabledTimerId = setTimer(() => {
      disabledCallbackCount += 1;
    }, 0);
    waitMethod = await waitRuntimeTasks(20);

    const enabledCallbackRan = enabledCallbackCount > 0;
    const disabledCallbackRan = disabledCallbackCount > 0;

    return {
      disabledCallbackRan,
      enabledCallbackRan,
      disabledFlagBlocksCallbacks:
        enabledCallbackRan === true && disabledCallbackRan === false,
      waitMethod,
    };
  } catch (error) {
    return {
      disabledCallbackRan: disabledCallbackCount > 0,
      enabledCallbackRan: enabledCallbackCount > 0,
      error: getErrorMessage(error),
      disabledFlagBlocksCallbacks: false,
      waitMethod,
    };
  } finally {
    if (typeof enabledTimerId !== 'undefined') {
      clearTimer(enabledTimerId);
    }
    if (typeof disabledTimerId !== 'undefined') {
      clearTimer(disabledTimerId);
    }
    g[disabledFlag] = previousFlag;
  }
}

async function runTimerInterceptorCheck(): Promise<ISesRuntimeCheckItem> {
  const purpose =
    '验证 setTimeout/setInterval 已安装 OneKey timer wrapper 或项目预期外层 wrapper，并且禁用 flag 仍能拦截回调。';
  const setTimeoutState = getTimerInterceptorState(
    globalThis.setTimeout,
    '$$onekeyDisabledSetTimeout',
  );
  const setIntervalState = getTimerInterceptorState(
    globalThis.setInterval,
    '$$onekeyDisabledSetInterval',
  );
  const setTimeoutBehavior = await runTimerBehaviorProbe({
    clearTimer: (timerId) => {
      globalThis.clearTimeout(
        timerId as ReturnType<typeof globalThis.setTimeout>,
      );
    },
    disabledFlag: '$$onekeyDisabledSetTimeout',
    setTimer: globalThis.setTimeout as unknown as ITimerSetter,
  });
  const setIntervalBehavior = await runTimerBehaviorProbe({
    clearTimer: (timerId) => {
      globalThis.clearInterval(
        timerId as ReturnType<typeof globalThis.setInterval>,
      );
    },
    disabledFlag: '$$onekeyDisabledSetInterval',
    setTimer: globalThis.setInterval as unknown as ITimerSetter,
  });
  const passed =
    setTimeoutState.installed &&
    setIntervalState.installed &&
    setTimeoutBehavior.disabledFlagBlocksCallbacks &&
    setIntervalBehavior.disabledFlagBlocksCallbacks;

  return buildCheck(
    'timer interceptor',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      setTimeout: {
        type: typeof globalThis.setTimeout,
        marker:
          typeof setTimeoutState.marker === 'undefined'
            ? null
            : setTimeoutState.marker,
        markerMatches: setTimeoutState.markerMatches,
        sourceLooksOneKeyIntercepted:
          setTimeoutState.sourceLooksOneKeyIntercepted,
        sourceLooksAgentationWrapped:
          setTimeoutState.sourceLooksAgentationWrapped,
        installed: setTimeoutState.installed,
        behavior: setTimeoutBehavior,
        sourceSnippet: setTimeoutState.sourceSnippet,
      },
      setInterval: {
        type: typeof globalThis.setInterval,
        marker:
          typeof setIntervalState.marker === 'undefined'
            ? null
            : setIntervalState.marker,
        markerMatches: setIntervalState.markerMatches,
        sourceLooksOneKeyIntercepted:
          setIntervalState.sourceLooksOneKeyIntercepted,
        sourceLooksAgentationWrapped:
          setIntervalState.sourceLooksAgentationWrapped,
        installed: setIntervalState.installed,
        behavior: setIntervalBehavior,
        sourceSnippet: setIntervalState.sourceSnippet,
      },
    }),
  );
}

function runCryptoShimCheck(): ISesRuntimeCheckItem {
  const purpose =
    '验证 crypto shim marker、getRandomValues 和 randomBytes 在 harden 后仍可用。';
  const cryptoValue = getGlobalRecord().crypto as
    | {
        $$isOneKeyShim?: boolean;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
        randomBytes?: (size: number) => { length?: number };
      }
    | undefined;
  let getRandomValuesOk = false;
  let randomBytesOk = false;
  let errorMessage: string | undefined;

  try {
    const values = new Uint8Array(8);
    const result = cryptoValue?.getRandomValues?.(values);
    getRandomValuesOk = result === values && values.length === 8;
    const randomBytes = cryptoValue?.randomBytes?.(8);
    randomBytesOk = randomBytes?.length === 8;
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  const passed =
    cryptoValue?.$$isOneKeyShim === true && getRandomValuesOk && randomBytesOk;

  return buildCheck(
    'crypto shim',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      marker: cryptoValue?.$$isOneKeyShim === true,
      hasGetRandomValues: typeof cryptoValue?.getRandomValues === 'function',
      getRandomValuesOk,
      hasRandomBytes: typeof cryptoValue?.randomBytes === 'function',
      randomBytesOk,
      errorMessage,
    }),
  );
}

function runExtensionApiShimCheck(runtime?: string): ISesRuntimeCheckItem {
  const purpose = '验证扩展 runtime 的 chrome/browser host API shim 可用。';

  if (!isExtensionRuntime(runtime)) {
    return buildInfoCheck(
      'Extension API shim',
      'functionality',
      purpose,
      `not extension runtime, runtime=${runtime ?? 'unknown'}`,
    );
  }

  const chromeApi = getGlobalRecord().chrome as
    | { runtime?: unknown }
    | undefined;
  const browserApi = getGlobalRecord().browser as
    | { runtime?: unknown }
    | undefined;
  const passed = !!chromeApi?.runtime || !!browserApi?.runtime;

  return buildCheck(
    'Extension API shim',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      runtime,
      hasChromeRuntime: !!chromeApi?.runtime,
      hasBrowserRuntime: !!browserApi?.runtime,
    }),
  );
}

function runExtensionXhrShimCheck(runtime?: string): ISesRuntimeCheckItem {
  const purpose = '验证扩展 runtime 的 XMLHttpRequest shim 可用。';

  if (!isExtensionRuntime(runtime)) {
    return buildInfoCheck(
      'Extension XHR shim',
      'functionality',
      purpose,
      `not extension runtime, runtime=${runtime ?? 'unknown'}`,
    );
  }

  let constructOk = false;
  let errorMessage: string | undefined;
  try {
    constructOk =
      typeof XMLHttpRequest === 'function' && !!new XMLHttpRequest();
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return buildCheck(
    'Extension XHR shim',
    'functionality',
    purpose,
    constructOk,
    JSON.stringify({
      runtime,
      xhrType: typeof XMLHttpRequest,
      constructOk,
      errorMessage,
    }),
  );
}

function runDesktopApiProxyCheck(runtime?: string): ISesRuntimeCheckItem {
  const purpose =
    '验证 desktop renderer 的 globalThis.desktopApiProxy 已在 harden 前安装。';

  if (runtime !== 'desktop-renderer') {
    return buildInfoCheck(
      'Desktop API proxy',
      'functionality',
      purpose,
      `not desktop renderer runtime, runtime=${runtime ?? 'unknown'}`,
    );
  }

  const desktopApiProxy = getGlobalRecord().desktopApiProxy;
  const passed =
    typeof desktopApiProxy === 'object' ||
    typeof desktopApiProxy === 'function';

  return buildCheck(
    'Desktop API proxy',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      runtime,
      desktopApiProxyType: typeof desktopApiProxy,
      installed: passed,
    }),
  );
}

function runExtensionBridgeGlobalsCheck(
  runtime?: string,
): ISesRuntimeCheckItem {
  const purpose =
    '验证扩展 UI/offscreen/background bridge 的 appGlobals 连接结果仍可用。';

  if (!isExtensionRuntime(runtime)) {
    return buildInfoCheck(
      'Extension bridge globals',
      'functionality',
      purpose,
      `not extension runtime, runtime=${runtime ?? 'unknown'}`,
    );
  }

  let propertyName: keyof typeof appGlobals;
  if (runtime === 'ext-background') {
    propertyName = '$offscreenApiProxy';
  } else if (runtime === 'ext-offscreen') {
    propertyName = 'extJsBridgeOffscreenToBg';
  } else {
    propertyName = 'extJsBridgeUiToBg';
  }

  const value = appGlobals[propertyName];
  const passed = !!value;

  return buildCheck(
    'Extension bridge globals',
    'functionality',
    purpose,
    passed,
    JSON.stringify({
      runtime,
      propertyName,
      valueType: typeof value,
      installed: passed,
    }),
  );
}

export async function buildSesRuntimeCheckReport(): Promise<ISesRuntimeCheckReport> {
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
      '确认 L1/L2（含生产环境）已安装 harden 后 patch 失败提醒，L0 不安装；提醒按 fingerprint 去重，每个 fingerprint 每个会话只输出一次。',
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

  checks.push(runFunctionGlobalEscapeCheck(level, state?.runtime));

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

  checks.push(runArrayPatchMethodsCheck());
  checks.push(runIndexedDbTransactionShimCheck(state?.runtime));
  checks.push(runFetchInterceptorCheck());
  checks.push(await runTimerInterceptorCheck());
  checks.push(runCryptoShimCheck());
  checks.push(runExtensionApiShimCheck(state?.runtime));
  checks.push(runExtensionXhrShimCheck(state?.runtime));
  checks.push(runDesktopApiProxyCheck(state?.runtime));
  checks.push(runExtensionBridgeGlobalsCheck(state?.runtime));

  const tamperedFunction = () => 'tampered';
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Object.prototype',
      purpose:
        '验证 Object.prototype 不能被新增属性，防止全局普通对象被原型污染。',
      expectBlocked: shouldBeLockedDown,
      target: Object.prototype,
      propertyKey: '__onekeySesTamperProbe__',
      replacement: true,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Array.prototype.push',
      purpose: '验证 Array.prototype.push 不能被替换，防止全局数组行为被篡改。',
      expectBlocked: shouldBeLockedDown,
      target: Array.prototype,
      propertyKey: 'push',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper JSON.stringify',
      purpose: '验证 JSON.stringify 不能被替换，防止全局序列化行为被劫持。',
      expectBlocked: shouldBeLockedDown,
      target: JSON,
      propertyKey: 'stringify',
      replacement: tamperedFunction,
    }),
  );
  checks.push(
    runPropertyTamperCheck({
      name: 'Tamper Promise.resolve',
      purpose: '验证 Promise.resolve 不能被替换，防止异步控制流被全局劫持。',
      expectBlocked: shouldBeLockedDown,
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
      expectBlocked: shouldBeLockedDown,
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
      expectBlocked: shouldBeLockedDown,
      target: Error.prototype,
      propertyKey: 'stack',
      replacement: 'tampered stack',
      defineDescriptor: {
        configurable: true,
        get: () => 'tampered stack',
      },
    }),
  );
  checks.push(runHardenedObjectTamperCheck(g, level));

  const failed = checks.filter((check) => check.status === 'fail').length;
  const passed = checks.filter((check) => check.status === 'pass').length;
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
      passed,
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

function isRuntimeCheckMessage(
  message: unknown,
): message is ISesHardenRuntimeCheckMessage {
  return (
    !!message &&
    typeof message === 'object' &&
    (message as ISesHardenRuntimeCheckMessage).type ===
      SES_HARDEN_RUNTIME_CHECK_MESSAGE_TYPE
  );
}

export function installSesHardenRuntimeCheckMessageHandler(
  runtime: ISesHardenRuntime,
): void {
  const g = getGlobalRecord();
  const installedKey = `__ONEKEY_SES_HARDEN_RUNTIME_CHECK_HANDLER_${runtime}__`;
  if (g[installedKey] === true) {
    return;
  }

  const chromeRuntime = (
    g.chrome as
      | {
          runtime?: {
            onMessage?: {
              addListener?: (
                callback: (
                  message: unknown,
                  sender: unknown,
                  sendResponse: (
                    response: ISesHardenRuntimeCheckResponse,
                  ) => void,
                ) => true | undefined,
              ) => void;
            };
          };
        }
      | undefined
  )?.runtime;

  if (!chromeRuntime?.onMessage?.addListener) {
    return;
  }

  chromeRuntime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRuntimeCheckMessage(message) || message.targetRuntime !== runtime) {
      return undefined;
    }

    void buildSesRuntimeCheckReport()
      .then((report) => {
        sendResponse({
          ok: true,
          report,
        });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: getErrorMessage(error),
        });
      });

    return true;
  });

  g[installedKey] = true;
}
