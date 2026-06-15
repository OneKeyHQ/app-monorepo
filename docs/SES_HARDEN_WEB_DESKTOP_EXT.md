# Web、Desktop、Extension 的 SES harden 方案

**目标：** 在不破坏热更新、Desktop preload bridge、Extension MV3 行为和现有启动期 polyfills 的前提下，提升 OneKey 自身 JavaScript 运行时的抗篡改能力。

**范围：** 仅覆盖 `apps/web`、`apps/desktop`、`apps/ext` 三个端。

**第一阶段不覆盖：** `apps/mobile`、DApp MAIN world 的 `injected.js`、运行在任意网页上的 content script、WebView 页面脚本。

---

## 结论

建议使用分阶段方案：

1. 先在 `packages/shared` 增加统一的 SES lockdown helper。
2. 先梳理稳定 capability facade，并补齐 contract tests，例如 bridge/API 对外暴露面。
3. 第二阶段再把 SES `lockdown()` 放到显式 L0/L1/L2 level 开关后面。
4. 进入最松 `lockdown()` 档位后，直接使用 SES `harden()` harden 这些稳定 facade。
5. 启用顺序建议为：Web、Desktop renderer、Extension UI/background/offscreen。
6. Mobile 暂不纳入本轮，因为它的启动流程依赖更多全局变量写入、OTA bundle loader、split-bundle loader、background-thread transport、native asset path patch 和启动性能 profiling。

第一个适合进入生产验证的里程碑应该是 **facade 清单 + contract tests + no-op helper**。这些准备工作并入 L0；真正的 SES `harden()` 从 L1 开始，必须在最松 `lockdown()` 档位通过回归后再逐步灰度。

---

## 背景

SES `lockdown()` 会 harden 当前 JavaScript realm，主要是 tamper-proof intrinsics：构造函数、prototype、共享标准对象、求值器，以及部分宿主可观察行为。它不会移除 `fetch`、storage API、Electron bridge、extension API 这类强能力全局对象。

对 OneKey 来说，`lockdown()` 能降低自身运行时里的 prototype pollution 和依赖篡改风险，但它不是这些机制的替代品：

- 更新包签名校验
- origin 校验
- bridge 方法鉴权
- WebView / DApp provider 权限边界
- 交易和签名链路安全校验

官方参考：

- SES README: https://github.com/endojs/endo/tree/master/packages/ses
- SES 2.2.0 types: https://unpkg.com/ses@2.2.0/types.d.ts
- SES 2.2.0 lockdown implementation: https://unpkg.com/ses@2.2.0/src/lockdown.js

---

## `lockdown()` 实际锁定什么

`lockdown()` 不是锁业务代码里的某个 `let`、`const`、module variable，也不是只锁 `globalThis` 上的几个属性。它的核心行为是把当前 realm 的共享基础对象变成不可篡改状态。

默认会影响的主要对象和行为：

- 标准内建构造函数及其 prototype，例如 `Object`、`Array`、`Function`、`Promise`、`Map`、`Set`、`WeakMap`、`WeakSet`、`Date`、`RegExp`、`Error` 等。
- 这些 intrinsics 可达的属性、方法和 prototype chain。
- `globalThis` 以及当前 realm 可达的共享内建对象。
- `eval` / `Function` 构造器的行为，默认是 `safe-eval`。
- `Error`、stack、console、RegExp、locale、domain、unhandled rejection 等宿主可观察行为的 taming。
- 对 prototype/property override 的限制，默认 `overrideTaming: 'moderate'`。

SES 2.2.0 里 `lockdown()` 的默认选项大致为：

```ts
lockdown({
  errorTaming: 'safe',
  errorTrapping: 'platform',
  reporting: 'platform',
  unhandledRejectionTrapping: 'report',
  regExpTaming: 'safe',
  localeTaming: 'safe',
  consoleTaming: 'safe',
  overrideTaming: 'moderate',
  stackFiltering: 'concise',
  domainTaming: 'safe',
  evalTaming: 'safe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
});
```

逐项解释：

| 选项 | 默认值 | 大概影响什么 | 对 OneKey 的关注点 |
| --- | --- | --- | --- |
| `errorTaming` | `'safe'` | tame `Error` 构造器、`Error.prototype`、V8 `Error.captureStackTrace` / `Error.prepareStackTrace` / `Error.stackTraceLimit` 等错误栈相关能力。`safe` 不是简单删除 Error 对象，而是阻止普通代码通过 `error.stack` / V8 stack API 直接拿到完整原始调用栈；SES 自己的 causal console 仍可通过内部 `getStackString` 生成受控、可过滤的 stack。 | 会明显影响 Sentry、本地日志和崩溃诊断拿到的 stack 质量。初期建议用 `'unsafe-debug'`，验证完再收紧。 |
| `errorTrapping` | `'platform'` | 在 Node / browser 运行时挂接顶层错误处理，例如 `uncaughtException`、`window.error`。浏览器侧会通过 SES console 记录 `SES_UNCAUGHT_EXCEPTION`。 | Web、Desktop renderer、Extension 都要检查是否影响已有 error boundary、Sentry capture 和页面错误默认行为。 |
| `reporting` | `'platform'` | 控制 SES 自己在 repair / lockdown 过程中的报告输出方式，例如移除非许可 intrinsics、override 处理等诊断信息。 | 建议 dev/internal 打开可见输出，生产灰度不要制造过多 console noise。 |
| `unhandledRejectionTrapping` | `'report'` | 挂接 `unhandledrejection` / `rejectionhandled` 或 Node `unhandledRejection`，通过 SES console 报告 `SES_UNHANDLED_REJECTION`。 | 可能改变未处理 Promise rejection 的日志形态。需要确认不和现有 Sentry unhandled rejection 采集重复或互相吞掉。 |
| `regExpTaming` | `'safe'` | tame `RegExp` 构造器和 `RegExp.prototype`，安全模式会删除旧的可变 `RegExp.prototype.compile`，并使用 SES 的 initial/shared RegExp 构造器。 | 通常影响小，但如果某个旧库依赖 `regexp.compile()` 会失败。需要在 Web/Extension 构建里搜索和 smoke test。 |
| `localeTaming` | `'safe'` | 把部分 locale-sensitive prototype 方法替换成确定性的非 locale 行为，例如 `String.prototype.localeCompare` 变成简单字符串比较，若干 `toLocale*` 方法转为对应非 locale 方法，`Number.prototype.toLocaleString` 转为 `toString`。 | 可能影响 UI 文案排序、数字格式化、日期格式化。OneKey 业务代码应使用既有 i18n/date/format 工具，不应依赖被 tame 后的原生 locale prototype 方法。 |
| `consoleTaming` | `'safe'` | 替换 `globalThis.console` 为 SES causal console，用于配合 redacted errors、error notes、unhandled rejection 报告。`unsafe` 则保留原始 console。 | 可能影响调试体验、日志格式和 Sentry breadcrumb。初期建议 `'unsafe'`。 |
| `overrideTaming` | `'moderate'` | 处理 JavaScript “override mistake”：当 intrinsic prototype 被 freeze 后，某些对继承属性的赋值会失败。`moderate` 会在兼容性和严格性之间折中，允许常见的 override-by-assignment 模式继续工作。 | 这是兼容性关键项。不要一开始用 `'severe'`；如果遇到第三方库赋值失败，优先改成 `Object.defineProperty` 或调整库，而不是放宽整体策略。 |
| `stackFiltering` | `'concise'` | 控制 SES console 输出错误栈时如何过滤 stack frames。`concise` 会隐藏部分基础设施栈，`verbose` 输出更完整原始栈。 | 初期应使用 `'verbose'` 方便排查启动失败；稳定后再改回 `'concise'`。 |
| `domainTaming` | `'safe'` | Node.js 相关。阻止 Node `domain` 模块初始化，因为 domain 会破坏 SES 的隔离假设。若 domain 已初始化，`lockdown()` 会失败。 | Web/Extension 基本无影响；Desktop renderer 通常也不应使用 Node domain。Desktop main process 第一阶段不启用 lockdown。 |
| `evalTaming` | `'safe-eval'` | tame `eval` 和 `Function` 构造器。`safe-eval` 会安装 SES safe evaluator；`no-eval` 直接禁用动态求值；`unsafe-eval` 保留原始能力。SES 还会替换 `Function`、GeneratorFunction、AsyncFunction、AsyncGeneratorFunction 的 prototype constructor，阻止从这些路径重新拿到原始 `Function` constructor。 | L1 先用 `'unsafe-eval'` 保持兼容；L2 再收紧到 `'safe-eval'`。Extension MV3 CSP 对 eval 本来更严格，必须实测；不要直接 `no-eval`，否则容易破坏 bundler/runtime/dev tooling。 |
| `legacyRegeneratorRuntimeTaming` | `'safe'` | 默认不做兼容 hack。`unsafe-ignore` 会把 `%IteratorPrototype%[@@iterator]` 变成忽略赋值的 accessor，用于兼容旧 regenerator runtime 对 iterator prototype 的写入。 | 如果旧 Babel/regenerator 代码在 lockdown 后报 iterator 相关赋值错误，再评估是否临时使用 `'unsafe-ignore'`；默认不要启用。 |

还有几个不是常规业务配置但需要知道的项：

- `overrideDebug`：用于调试 `overrideTaming`，可以指定调试名称，帮助定位哪些 override 被处理。默认空数组。
- `dateTaming` / `mathTaming`：已废弃，2.2.0 中传了也不生效，未来可能变成错误。
- `__hardenTaming__`：内部/实验选项，默认 `'safe'`。业务方案不要依赖这个选项。

这些默认值偏安全，但对调试和兼容性不够友好。OneKey 初期不建议直接用默认配置进入生产灰度。

### Taming 覆盖范围

SES 里的 taming 可以分两类：一类是 `lockdown(options)` 可配置的 taming，另一类是 `lockdown()` 内部固定执行的 repair/tame 流程。

可通过 options 控制的 taming：

| 场景 | 主要影响对象 | 相关 options | OneKey 本轮策略 |
| --- | --- | --- | --- |
| 动态代码执行 | `eval`、`Function` constructor、GeneratorFunction、AsyncFunction、AsyncGeneratorFunction | `evalTaming` | L1 保持 `'unsafe-eval'`，L2 单独验证 `'safe-eval'`。 |
| Error / stack | `Error`、`Error.prototype`、native error constructors、V8 `captureStackTrace` / `prepareStackTrace` / `stackTraceLimit` | `errorTaming`、`stackFiltering` | 保持 `errorTaming: 'unsafe-debug'`、`stackFiltering: 'verbose'`，避免影响 Sentry 排障。 |
| 顶层错误和 Promise rejection | browser `window.error` / `unhandledrejection`，Node `uncaughtException` / `unhandledRejection` | `errorTrapping`、`unhandledRejectionTrapping` | 保持 `'none'`，不接管现有错误采集链路。 |
| SES 自身报告输出 | lockdown repair 过程中的 diagnostics，例如移除非许可 intrinsics、override 处理日志 | `reporting` | 使用 `'console'`，便于 internal/dev 观察。 |
| Console | `globalThis.console`，SES causal console | `consoleTaming` | 保持 `'unsafe'`，不改变日志格式和 Sentry breadcrumb。 |
| RegExp | `RegExp` constructor、`RegExp.prototype`、旧的 `RegExp.prototype.compile` | `regExpTaming` | 保持 `'unsafe'`，不改变正则行为。 |
| Locale-sensitive methods | `String.prototype.localeCompare`、若干 `toLocale*`、`Number.prototype.toLocaleString` | `localeTaming` | 保持 `'unsafe'`，避免影响金额、价格、日期、本地化展示。 |
| Prototype override 兼容 | frozen intrinsic prototype 后的 override-by-assignment 兼容性 | `overrideTaming`、`overrideDebug` | 使用 `'moderate'`。`overrideDebug` 只在定位兼容问题时临时用。 |
| Node domain | Node `process.domain` / `domain` module 初始化 | `domainTaming` | 使用 `'safe'`；Desktop main process 本轮不启用。 |
| 旧 regenerator runtime 兼容 | `%IteratorPrototype%[@@iterator]` 被旧 regenerator runtime 赋值的兼容场景 | `legacyRegeneratorRuntimeTaming` | 使用 `'safe'`；只有遇到旧 regenerator 兼容问题才评估 `'unsafe-ignore'`。 |

`lockdown()` 内部固定执行、但不建议业务配置的 repair/tame：

| 场景 | 主要影响对象 | 是否可通过本轮 options 控制 |
| --- | --- | --- |
| Intrinsics hardening | `Object.prototype`、`Array.prototype`、`Function.prototype`、`Map.prototype`、`Promise.prototype` 等共享语言底座 | 不可精细控制。加载 `ses` 后由 `globalThis.lockdown(options)` 执行；只要调用它就会发生。 |
| Function constructors repair | `Function.prototype.constructor`、Generator/Async function prototype constructor 等通往原始 `Function` 的路径 | 不作为独立业务配置；和 `lockdown()` / `evalTaming` 一起验证。 |
| Function.prototype.toString repair | `Function.prototype.toString` 对 shimmed functions 的表现 | 不作为独立业务配置。 |
| Date / Math / Temporal / NaN side-channel repair | `Date`、`Math`、`Temporal`、NaN side-channel 相关内部修正 | 不作为独立业务配置；`dateTaming` / `mathTaming` 已废弃且不生效。 |
| Symbol / ModuleSource / ArrayBuffer transfer / faux data properties | 相关 intrinsics 和 shim 行为 | 不作为独立业务配置。 |
| `harden` 本身 | SES 安装到 `globalThis.harden` 的 hardener | `__hardenTaming__` 是内部/实验项，本方案不使用。 |

因此，本轮真正要验证的是：`lockdown()` 固定的 intrinsics hardening 是否兼容；SES `harden(api)` 是否兼容；以及 L2 的 `evalTaming: 'safe-eval'` 是否兼容。

### 动态代码执行白名单

`evalTaming` 是 realm 级策略，不能对某个调用点单独开“原始 eval / Function 白名单”。一旦当前 realm 执行了：

```ts
lockdown({
  evalTaming: 'safe-eval',
});
```

就不能在同一个 realm 里临时恢复某个业务场景的原始 `eval` 或 `Function`。也不建议在 `lockdown()` 前保存原始 `eval` / `Function` 引用再给某个场景使用；这等于给当前 realm 留了一个绕过点，会削弱 `evalTaming` 的意义，也很难审计和测试。

如果确实存在必须动态执行代码的场景，建议按风险从低到高选择：

1. **优先改成数据驱动或预编译。** 例如把表达式、模板、规则转换为 AST / JSON DSL，在构建期或服务端编译，不在 app runtime 做字符串执行。
2. **使用 SES `Compartment`。** 在 locked-down realm 里创建受限 compartment，只通过 endowments 显式传入需要的能力，而不是给它整个 `globalThis`。
3. **隔离到单独 runtime。** 如果必须使用原始 eval / Function，把它放到单独 Worker、iframe、Electron utility process 或独立 WebView/runtime，且不要暴露钱包核心能力；通过最小消息协议通信。
4. **保持该 runtime 在 L1。** 如果某个端确实依赖原始 eval / Function 且无法隔离，就不要把这个 runtime 升到 L2。L2 是按 runtime 灰度，不是全端强制。

推荐的 `Compartment` 形态：

```ts
const c = new Compartment({
  console,
  Math,
  Date,
  // 只传入业务允许的纯函数或 capability。
  formatAmount,
});

const result = c.evaluate(source);
```

注意：`Compartment` 不是自动安全的沙盒。安全性来自 endowments allowlist：不给 `fetch`、storage、desktop bridge、extension API、signing service、private key service，它就拿不到这些能力。动态代码的输入来源、语法范围、执行超时、返回值校验仍需要单独设计。

### 为什么配置里没有“锁对象方法和属性”

`lockdown()` 的配置项不是对象级 ACL，也不是用来描述“锁哪个业务对象、哪个方法、哪个属性”。它的配置主要控制当前 realm 的 taming 策略，例如 error stack 怎么处理、console 是否接管、eval 是否安全化、locale / RegExp / domain 等宿主或 intrinsic 行为怎么修正。

对象方法和属性的锁定应放在另一层做：

| 目标 | 使用机制 | 说明 |
| --- | --- | --- |
| 锁整个 JS realm 的共享基础对象 | `lockdown(options)` | 处理 `Object.prototype`、`Array.prototype`、`Function`、`Error`、`RegExp`、`eval` 等 intrinsics 和宿主可观察行为。 |
| 锁某个 OneKey 对外 API/facade 的方法和属性 | SES `harden()` | 例如锁 `desktopApiProxy` public facade、extension bridge facade、`BundleUpdate` facade，防止运行时新增、删除、替换公开方法。 |
| 限制不可信代码能看到什么能力 | `Compartment` endowments allowlist | 给 sandbox code 显式传入允许访问的能力，而不是让它直接拿当前 app realm 的全部 globals。 |

因此，不应该在 `getLockdownOptions(level)` 里写类似这样的配置：

```ts
lockdown({
  freezeObjects: ['desktopApiProxy', 'BundleUpdate'],
  allowMethods: ['request', 'on', 'removeListener'],
});
```

SES 没有这样的公开配置模型。对象级 hardening 应由代码显式完成，例如：

```ts
const api = {
  request,
  on,
  removeListener,
};

export const publicApi = harden(api);
```

不需要自己实现一套 harden 语义，直接使用 SES `harden()`。但需要注意：`ses@2.2.0` 的 `globalThis.harden` 是在 `lockdown()` 完成后才安装的。因此，本方案选择不使用 `Object.freeze()` 作为过渡时，不需要单独保留一个“只做清单、不改变运行时行为”的 harden level；facade 清单、调用点改造准备和 contract tests 并入 L0，实际 `harden(api)` 从 L1 开始。

建议在调用点显式使用 SES `harden()`，不要封装出语义不同的 `hardenFacade()`。OneKey helper 最多提供运行时断言或类型辅助，例如检查 `harden` 是否已经可用；不要重新实现 shallow/deep freeze 逻辑。

这样拆分的好处是：

- `lockdown()` 只负责环境级 hardening，避免配置变成脆弱的业务对象黑白名单。
- 每个 facade 的方法列表可以通过单元测试固定下来。
- 可变实现状态可以留在 closure / module scope，不会被误 freeze。
- 如果某个 facade 需要保持可扩展，可以不 harden 它，或者拆成稳定 public facade 和内部 mutable implementation。

---

## 当前 OneKey 约束

### 热更新和 bundle loading

Native 和 Desktop 的 bundle update 路径都是在重启后加载新 JS bundle，而不是在当前运行中的 module graph 里原地替换代码。

- Native `BundleUpdate.installBundle()` 安装 bundle 后，会通过 `EAppRestartMode.All` 重启。
- Desktop 启动时会解析 bundle 的 `build/index.html`，然后把它作为 renderer entry 加载。

因此，`lockdown()` 一般不会直接阻断下载、校验、安装流程。真正的兼容性风险在启动阶段：新的 JS bundle 必须能在 `lockdown()` 之前完成所有必要的全局变量、polyfill 和 bridge 初始化。

热更新相关结论：

- facade hardening 对热更新影响较小。
- 全局 `lockdown()` 如果放得太早，可能影响新 bundle 启动。
- 不要把 `lockdown()` 放进 shared polyfills 里。
- 不要让旧 app shell 加载“默认直接进入 L1/L2”的新 bundle；默认必须保持 L0，切换必须显式。
- 发布前必须验证 old shell -> new JS bundle -> builtin fallback 的完整链路。

### Web

入口：

- `apps/web/index.js`

关键启动顺序：

1. performance marker
2. `@onekeyhq/shared/src/polyfills`
3. `@onekeyhq/kit-bg/src/hydration/hydrate`
4. Sentry、Intercom、React root

`lockdown()` 不能早于 shared polyfills 和冷启动 hydration 所需的全局状态准备。

### Desktop

入口：

- `apps/desktop/index.js`
- `apps/desktop/App.tsx`
- Electron main process 的 bundle selection 在 `apps/desktop/app/app.ts`

关键启动顺序：

1. `@onekeyhq/shared/src/polyfills`
2. Desktop renderer CSS
3. `@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy`
4. React / Sentry app render

当前 renderer 仍会为既有调用方写入 `globalThis.desktopApiProxy`。`lockdown()` 必须在这个赋值之后运行，否则 `globalThis` 被 harden 后可能导致赋值失败。

第一阶段不建议覆盖 Desktop main process。它包含 Electron、auto-updater、文件系统、GPG 校验、窗口生命周期等逻辑。相比之下，renderer 是更适合先验证的目标。

### Extension

目标入口：

- `apps/ext/src/entry/ui-popup.tsx`
- `apps/ext/src/entry/ui.tsx`
- `apps/ext/src/entry/ui-passkey.tsx`
- `apps/ext/src/entry/background.ts`
- `apps/ext/src/entry/offscreen.ts`

明确排除：

- `apps/ext/src/entry/content-script-init.ts`
- 生成或复制过来的 `apps/ext/src/entry/injected.js`
- 生成或复制过来的 `apps/ext/src/entry/injected.text-js`

原因：content script 和 injected provider code 会运行在任意 DApp 页面上，或者与任意 DApp 页面强交互。不要在这些 realm 里调用 `lockdown()`。如果需要增强 provider 的抗篡改能力，应在上游 `@onekeyfe/cross-inpage-provider-injected` 包里 harden provider facade，然后重新生成复制产物。

---

## 为什么 Mobile 更复杂

Mobile 应单独设计，不建议跟 Web、Desktop、Extension 一起推进，原因是它有更多启动期全局写入和更多 runtime 形态：

1. `apps/mobile/index.ts` 会写入 `__ONEKEY_MAIN_ENTRY_START__`、`__ONEKEY_RUNTIME_KIND__` 等启动全局变量。
2. Shared native polyfills 会根据当前 OTA bundle path patch 全局对象和 native asset resolution。
3. 生产 split-bundle 启动会在 async imports 执行前，通过 `Object.defineProperty()` 安装 `globalThis.__loadBundleAsync`。
4. Metro serializer 会在 bundle prologue 注入 `globalThis.__SEGMENT_MANIFEST__`。
5. Background-thread transport 会安装 `__onekeyNativeBackgroundThreadTransport`、`__onekeyNativeBackgroundThreadBridgeRelay`、`__onekeyNativeBackgroundThreadJotaiBridge` 等全局对象。
6. 启动性能 profiling 可能 monkey-patch Metro 的 `__r`、`__d`。
7. Native OTA install 和 bundle switch 会同时重启 main/background runtimes，以避免 module-id drift。

因此，Mobile 的 `lockdown()` rollout 需要单独方案：预安装所有必要 global accessor，分别验证 main/background Hermes runtime，并完整跑 OTA rollback、split-bundle、background thread smoke test。Mobile 应作为后续项目，而不是本轮三端方案里的第四个 checkbox。

---

## 实施方案

### Phase 0：依赖评审和 helper

完成依赖评审后，在 `@onekeyhq/shared` workspace 新增 `ses` 依赖。helper 位于 shared 层，依赖也必须声明在 shared，不能只放在 root package。初期明确固定已经评审过的版本，不要无意识跟随未来 minor 版本：

```bash
yarn workspace @onekeyhq/shared add ses@2.2.0
```

新增 shared helper：

```text
packages/shared/src/security/sesHarden/index.ts
packages/shared/src/security/sesHarden/options.ts
packages/shared/src/security/sesHarden/runtime.ts
packages/shared/src/security/sesHarden/types.ts
packages/shared/src/security/sesHarden/installWeb.ts
packages/shared/src/security/sesHarden/installDesktopRenderer.ts
```

放在 `shared` 下，Web、Desktop、Extension 都能导入，并且不违反 OneKey import hierarchy。这个 helper 不能 import `kit`、`kit-bg`、`components`。

初始 API：

```ts
export type ISesHardenRuntime =
  | 'web'
  | 'desktop-renderer'
  | 'ext-ui'
  | 'ext-background'
  | 'ext-offscreen'
  | 'ext-passkey';

export type ISesHardenLevel = 'L0' | 'L1' | 'L2';

export function maybeLockdownOneKeyRuntime(options: {
  runtime: ISesHardenRuntime;
  level?: ISesHardenLevel;
}): ISesHardenRuntimeState;

export function getSesLockdownOptions(
  level: ISesHardenLevel,
): LockdownOptions | undefined;

export function getSesHarden(): Harden | undefined;
```

行为要求：

- 默认 L0 no-op，只有显式切到 L1/L2 才执行 `lockdown()`。
- L0 不加载 `ses`，也不安装 SES globals；`ses` 只在 L1/L2 路径同步加载。
- 同一个 realm 内必须幂等。
- L1/L2 如果 `lockdown()` 失败，应 fail fast，让验证环境尽早暴露兼容问题；生产稳定灰度前必须通过完整回归。
- `harden()` 不自定义实现，只通过 `getSesHarden()` 读取 SES 在 `lockdown()` 后安装的 `globalThis.harden`。

建议不要一步到位使用 SES 默认配置。OneKey 本轮目标只做核心 hardening，不接管 error stack、console、locale 和 RegExp 旧行为。初始 `lockdown()` 配置应尽量“松”，先验证 frozen intrinsics 对启动链路和第三方库的影响：

```ts
lockdown({
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'moderate',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'unsafe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
});
```

每次全量回归确认无明显问题后，只收紧 `evalTaming`。本轮推荐稳定目标不是 SES 默认配置，而是保留 OneKey 现有 error / console / locale / RegExp 行为：

```ts
lockdown({
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'moderate',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'safe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
});
```

### Phase 0.1：先松后紧的配置阶梯

收紧原则：

- 每次只调整一组相关选项，不要多个高风险选项同时变化。
- 每个 runtime 单独推进：先 Web，再 Desktop renderer，再 Extension UI/background/offscreen。
- 每次收紧后都必须完成全量回归和热更新链路验证，再进入下一档。
- 如果出现启动失败、Sentry stack 丢失、bridge 异常、DApp provider 异常，应直接回退到上一档配置，而不是继续叠加 workaround。

建议配置阶梯：

| Level | 目标 | 配置变化 | 准入条件 |
| --- | --- | --- | --- |
| L0 | no-op scaffold + facade contract tests | helper 存在，但 `maybeLockdownOneKeyRuntime()` 默认不执行 `lockdown()`；同时完成稳定 facade 清单、调用点准备和 contract tests。 | Typecheck / build 通过，确认没有 bundle size 或 import hierarchy 问题；facade public method list 被测试固定。 |
| L1 | 最松 lockdown | 启用 `lockdown()`，但使用 `errorTaming: 'unsafe-debug'`、`consoleTaming: 'unsafe'`、`regExpTaming: 'unsafe'`、`localeTaming: 'unsafe'`、`evalTaming: 'unsafe-eval'`、`errorTrapping: 'none'`、`unhandledRejectionTrapping: 'none'`。稳定 facade 只有在 L0 已完成 contract tests 后，才在对应调用点直接用 SES `harden()`。 | 重点验证 frozen intrinsics 是否导致启动失败、第三方库 prototype 写入失败、bridge 初始化失败；facade harden 只逐个对象推进，避免误 harden 可变内部状态。 |
| L2 | 只收紧动态求值 | 把 `evalTaming` 从 `'unsafe-eval'` 调整为 `'safe-eval'`；继续保持 `errorTaming: 'unsafe-debug'`、`consoleTaming: 'unsafe'`、`regExpTaming: 'unsafe'`、`localeTaming: 'unsafe'`、`errorTrapping: 'none'`、`unhandledRejectionTrapping: 'none'`。 | 确认 bundler runtime、Extension MV3、dev tooling、热更新 bundle 启动链路都没有问题。若存在必须使用原始 eval / Function 的场景，先迁移到 `Compartment` 或隔离 runtime；无法迁移时该 runtime 停在 L1。 |

L1 的推荐配置：

```ts
lockdown({
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'moderate',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'unsafe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
});
```

这 12 个选项覆盖了本轮建议显式配置的 `ses@2.2.0` 公开稳定选项：

- `errorTaming`
- `errorTrapping`
- `reporting`
- `unhandledRejectionTrapping`
- `regExpTaming`
- `localeTaming`
- `consoleTaming`
- `overrideTaming`
- `stackFiltering`
- `domainTaming`
- `evalTaming`
- `legacyRegeneratorRuntimeTaming`

对照 `ses@2.2.0` 发布包的 `types.d.ts` 和 `src/lockdown.js`，完整 `LockdownOptions` / `RepairOptions` 一共有 16 个字段。除上面 12 个显式配置项外，`ses@2.2.0` 还支持 4 个额外字段，但本方案不建议放进常规配置：

- `overrideDebug`：调试 `overrideTaming` 用，默认空数组。只在定位 override 兼容问题时临时使用。
- `dateTaming`：已废弃，当前传入也不生效，未来可能变成错误。
- `mathTaming`：已废弃，当前传入也不生效，未来可能变成错误。
- `__hardenTaming__`：内部/实验选项，默认 `'safe'`。业务方案不要依赖它。

因此，页面上的 L0/L1/L2 配置矩阵需要把这 16 个字段都列出来；只是其中 4 个不会进入常规 runtime 配置。

L2 的推荐配置：

```ts
lockdown({
  errorTaming: 'unsafe-debug',
  errorTrapping: 'none',
  reporting: 'console',
  unhandledRejectionTrapping: 'none',
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'moderate',
  stackFiltering: 'verbose',
  domainTaming: 'safe',
  evalTaming: 'safe-eval',
  legacyRegeneratorRuntimeTaming: 'safe',
});
```

理解校准：

- `L0`：没有任何 SES 硬化，和之前代码行为保持一致；不加载 `ses`，不执行 `lockdown()`。
- `L1`：执行 `lockdown()` 并 harden intrinsics；业务可感知的 taming 尽量保持原生兼容。严格说 L1 不是“完全没有 taming”，因为仍保留 `overrideTaming: 'moderate'`、`domainTaming: 'safe'`、`legacyRegeneratorRuntimeTaming: 'safe'` 这类低风险/必要配置；但不会收紧 error / console / locale / regexp / eval。
- `L2`：在 L1 基础上只把 `evalTaming` 从 `'unsafe-eval'` 收紧到 `'safe-eval'`。除动态求值外，L2 和 L1 的 hardening / taming 策略保持一致。

图例：✅ 启用或收紧；❌ 未启用或未收紧；➖ 保持原生兼容、默认值或回滚用途。

| 配置项 | L0 | L1 | L2 |
| --- | --- | --- | --- |
| SES `lockdown()` | ❌ 不执行 | ✅ 执行 | ✅ 执行 |
| Intrinsics hardening | ❌ 不冻结 | ✅ 通过 `globalThis.lockdown(options)` 冻结 | ✅ 通过 `globalThis.lockdown(options)` 冻结 |
| `globalThis.harden` | ❌ 无 | ✅ 启用 | ✅ 启用 |
| `errorTaming` | ❌ 未启用 | ❌ `safe` 未开启；`unsafe-debug` | ❌ `safe` 未开启；`unsafe-debug` |
| `consoleTaming` | ❌ 未启用 | ❌ `safe` 未开启；`unsafe` | ❌ `safe` 未开启；`unsafe` |
| `reporting` | ❌ 未启用 | ✅ `console` | ✅ `console` |
| `localeTaming` | ❌ 未启用 | ❌ `safe` 未开启；`unsafe` | ❌ `safe` 未开启；`unsafe` |
| `regExpTaming` | ❌ 未启用 | ❌ `safe` 未开启；`unsafe` | ❌ `safe` 未开启；`unsafe` |
| `evalTaming` | ❌ 未启用 | ❌ `safe-eval` 未开启；`unsafe-eval` | ✅ `safe-eval` |
| `evalTaming: no-eval` | ❌ 未启用 | ❌ 未开启 | ❌ 未开启 |
| `overrideTaming` | ❌ 未启用 | ✅ `moderate` | ✅ `moderate` |
| `overrideDebug` | ❌ 未启用 | ❌ 默认空数组 | ❌ 默认空数组 |
| `stackFiltering` | ❌ 未启用 | ✅ `verbose` | ✅ `verbose` |
| `domainTaming` | ❌ 未启用 | ✅ `safe` | ✅ `safe` |
| `legacyRegeneratorRuntimeTaming` | ❌ 未启用 | ✅ `safe` | ✅ `safe` |
| `errorTrapping` | ❌ 未启用 | ❌ `none` | ❌ `none` |
| `unhandledRejectionTrapping` | ❌ 未启用 | ❌ `none` | ❌ `none` |
| `dateTaming` | ❌ 未启用 | ❌ 废弃且不生效 | ❌ 废弃且不生效 |
| `mathTaming` | ❌ 未启用 | ❌ 废弃且不生效 | ❌ 废弃且不生效 |
| `__hardenTaming__` | ❌ 未启用 | ➖ 不显式配置，SES 默认 `safe` | ➖ 不显式配置，SES 默认 `safe` |
| 推荐用途 | ➖ 默认/回滚 | ✅ 第一阶段灰度 | ✅ 第二阶段收紧 |

L2 仍未开启的收紧项：

| 未开启项 | L2 当前值 | 没有开启的原因 |
| --- | --- | --- |
| `errorTaming: 'safe'` | `errorTaming: 'unsafe-debug'` | 保留完整错误栈，避免影响 Sentry、本地日志和排障效率。 |
| `consoleTaming: 'safe'` | `consoleTaming: 'unsafe'` | 保留原始 console，避免改变日志格式、breadcrumb 和调试体验。 |
| `localeTaming: 'safe'` | `localeTaming: 'unsafe'` | OneKey 涉及金额、价格、日期和本地化展示，先不改变 locale-sensitive 行为。 |
| `regExpTaming: 'safe'` | `regExpTaming: 'unsafe'` | 避免删除/改变旧 RegExp 行为导致第三方库或业务正则兼容问题。 |
| `evalTaming: 'no-eval'` | `evalTaming: 'safe-eval'` | L2 只阻止危险的 global escape，不直接禁用所有动态求值，避免破坏 bundler/runtime/dev tooling。 |
| `errorTrapping` | `errorTrapping: 'none'` | 本轮不让 SES 接管全局 error trapping，避免和现有错误上报链路叠加。 |
| `unhandledRejectionTrapping` | `unhandledRejectionTrapping: 'none'` | 本轮不让 SES 接管 unhandled rejection trapping，避免影响现有 promise 错误处理和 Sentry。 |

完整字段里的 `overrideDebug`、`dateTaming`、`mathTaming`、`__hardenTaming__` 不作为 L2 待开启硬化项处理：`overrideDebug` 只是调试辅助；`dateTaming` / `mathTaming` 已废弃且不生效；`__hardenTaming__` 是内部/实验项，默认 `safe`，业务方案不应依赖。

注意：`errorTaming: 'safe'`、`consoleTaming: 'safe'`、`regExpTaming: 'safe'`、`localeTaming: 'safe'` 不纳入本轮 rollout。后续如果安全收益明确，再分别作为独立 RFC 讨论，不能混入本轮 SES harden 主线。

### 本轮不处理 error / locale / RegExp taming

这些 taming 项不是 SES 的全部安全价值。即使 `errorTaming`、`localeTaming`、`regExpTaming` 保持较松，只要进入 L1 并成功执行 `lockdown()`，`Object.prototype`、`Array.prototype`、`Function.prototype` 等 intrinsics 仍会被 harden，prototype pollution 的主风险仍会下降。

本轮明确不处理这三项，原因如下：

| 项 | 保持 unsafe 的理由 | 接受的风险 | 约束 |
| --- | --- | --- | --- |
| `errorTaming: 'unsafe-debug'` | OneKey 是开源项目，暴露原始 stack 的代码保密收益有限；收紧后会直接降低 Sentry 和本地日志的排障质量。 | 普通代码、第三方 SDK 或日志链路更容易拿到完整 stack、文件路径、函数名、调用结构。 | 继续依赖现有 Sentry / logger 脱敏策略；不要把私钥、助记词、签名 payload、用户敏感数据写入 Error message、Error cause 或日志上下文。 |
| `localeTaming: 'unsafe'` | OneKey 涉及大量金额、价格、日期和本地化展示。SES safe locale 会改变部分原生 locale 方法行为，收益不明确，反而可能带来金额展示或排序风险。 | locale-sensitive 方法保留宿主差异，可能有确定性和指纹差异。 | 安全决策、签名 payload、hash、排序准入逻辑不要依赖原生 locale 方法；金额、价格、日期统一走 OneKey formatter / i18n 工具。 |
| `regExpTaming: 'unsafe'` | 收紧会删除旧的 `RegExp.prototype.compile`，可能带来第三方库兼容问题；本轮主要目标不是改变 RegExp 行为。 | 如果把 RegExp 实例当作安全策略、校验器或共享 capability 暴露出去，持有者可能通过 `compile()` 改变 pattern/flags。 | 安全校验不要跨边界共享可变 RegExp 实例；策略类正则应封装在函数闭包内，或者每次调用时创建局部 RegExp。 |

本轮安全优先级调整为：

1. `lockdown()` 本身是否能成功运行并 harden intrinsics。
2. `evalTaming` 是否从 `'unsafe-eval'` 收紧到 `'safe-eval'`。
3. 跨边界 public facade 是否在 `lockdown()` 后直接用 SES `harden()`。
4. `errorTaming`、`consoleTaming`、`localeTaming`、`regExpTaming` 保持 `unsafe`，除非后续有独立安全评审结论要求改变。

### Phase 0.2：facade 清单和契约测试

在启用 `lockdown()` 之前，先梳理稳定的 capability facade，并补齐 contract tests。这是 L0 的准备工作，不作为单独 harden level。因为本方案不自定义 harden 语义、只使用 SES `harden()`，而 SES `harden()` 要在 `lockdown()` 后才可用，所以这里不做实际 harden。

- Desktop renderer 的 `desktopApiProxy`
- Extension UI bridge facade
- Extension background bridge facade
- `AppUpdate` / `BundleUpdate` facade objects
- 其他跨边界 API 暴露面，前提是这些对象不需要在运行时动态新增方法

不要纳入 SES `harden()` 的对象：

- native module objects
- Electron `ipcRenderer` 或 `contextBridge` 对象
- Jotai atoms
- logger internals
- Sentry internals
- 可变 service instances
- caches、maps、listener registries、bridge transport state

L1 之后的推荐模式：

```ts
const api = {
  request,
  on,
  removeListener,
};

export const publicApi = harden(api);
```

可变状态应留在 closure 或 module scope 里，只把对外暴露面交给 SES `harden()`。不要把 cache、map、listener registry、transport state 作为 facade 属性暴露出去，否则 SES `harden()` 会递归 harden 这些可达对象。

### Phase 2：Web runtime lockdown

修改 `apps/web/index.js`：

```ts
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/kit-bg/src/hydration/hydrate';

import '@onekeyhq/shared/src/security/sesHarden/installWeb';
```

验证项：

- `yarn app:web`
- `yarn app:web:build`
- 登录 / 解锁 smoke test
- IndexedDB hydration smoke test
- service worker update banner smoke test
- Sentry error reporting smoke test

当前实现把 `lockdown()` 放在 shared polyfills 和 cold-start hydration 之后。这样可以避免 hydration 初始化全局状态之前就 harden realm。

### Phase 3：Desktop renderer lockdown

修改 `apps/desktop/App.tsx`：

```ts
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';
import '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';

import '@onekeyhq/shared/src/security/sesHarden/installDesktopRenderer';
```

第一阶段不要放进 Electron main process。

验证项：

- `yarn app:desktop`
- renderer 正常启动
- 从 dev settings 调用 `desktopApiProxy.system.getSystemInfo()`
- app shell update check path
- JS bundle update path：download、verify、switch、restart
- rollback to builtin bundle
- WebView 打开和 DApp connection smoke test
- Sentry stack quality check

### Phase 4：Extension UI/background/offscreen lockdown

目标文件：

- `apps/ext/src/entry/ui.tsx`
- `apps/ext/src/entry/ui-passkey.tsx`
- `apps/ext/src/entry/background.ts`
- `apps/ext/src/entry/offscreen.ts`

建议位置：

- extension-specific polyfills 之后
- 必须写入 `globalThis` 的 bridge/global setup 之后
- React UI render 或业务逻辑消费 hardened facade 之前

当前实现位置：

- UI：`uiJsBridge.init()` 和 side panel port setup 之后，`renderApp()` 之前。
- passkey：`uiJsBridge.init()` 之后，`renderPassKeyPage()` 之前。
- background：`initBackground()` 和 `appGlobals.$offscreenApiProxy` 赋值之后。
- offscreen：`offscreenSetup()` 之后，reconnect timer 之前。

不要改：

- `apps/ext/src/entry/content-script-init.ts`
- 生成或复制过来的 `injected.js`

验证项：

- `yarn app:ext`
- `yarn app:ext:build`
- popup boot
- side panel boot
- passkey page boot
- background service worker wake / suspend / wake
- offscreen bridge reconnect
- DApp provider injection 仍然正常
- MV3 CSP 没有变化

---

## Feature flags

本轮实现先使用一个显式 hardening level，默认 `L0`。只要切到 `L1` 或 `L2`，已接入的 Web、Desktop renderer、Extension UI/background/offscreen/passkey runtime 会在各自入口执行对应级别。

level 解析优先级：

1. URL query：
   - `?onekeySesHardenLevel=L1`
   - `?onekeySesHardenLevel=L2`
   - 兼容短 key：`?sesHardenLevel=L2`
2. 启动前写入的 global：
   - `globalThis.__ONEKEY_SES_HARDEN_LEVEL__ = 'L2'`
3. localStorage：
   - `ONEKEY_SES_HARDEN_LEVEL=L0/L1/L2`
4. env：
   - `ONEKEY_SES_HARDEN_LEVEL=L0/L1/L2`
   - `ONEKEY_APP_SES_HARDEN_LEVEL=L0/L1/L2`
5. 代码配置：
   - `packages/shared/src/security/sesHarden/config.ts`
   - `ONEKEY_SES_HARDEN_DEFAULT_LEVEL`
   - `ONEKEY_SES_HARDEN_RUNTIME_LEVELS`
6. 默认：
   - `L0`

运行时切换辅助函数：

```ts
globalThis.__ONEKEY_SET_SES_HARDEN_LEVEL__('L2');
globalThis.__ONEKEY_SET_SES_HARDEN_LEVEL__('L1');
globalThis.__ONEKEY_SET_SES_HARDEN_LEVEL__('L0');
globalThis.__ONEKEY_SET_SES_HARDEN_LEVEL__(null); // 清除 localStorage，回到默认 L0
```

这个函数会写入 `localStorage.ONEKEY_SES_HARDEN_LEVEL` 并 reload 当前页面。Extension background service worker 没有稳定的同步 localStorage，因此 background 更适合通过构建/env 或随 UI 一起在同源存储中验证。

`ONEKEY_SES_HARDEN_LEVEL` 必须是可测试、可灰度、可回退的显式状态。不要通过散落的 boolean 组合隐式表达 L1/L2，否则单元测试和 E2E 很难覆盖完整矩阵。

如果后续需要按 runtime 分别灰度，再增加 runtime allowlist，例如只允许 `web` 或只允许 `desktop-renderer`。不要把 per-runtime allowlist 和 L1/L2 语义混在同一个 boolean 里。

---

## 白名单和黑名单策略

不要围绕 `lockdown()` 自己做一套 per-variable whitelist / blacklist。

SES `lockdown()` 是对整个 realm 的 intrinsics 做 harden。它没有稳定的公开 API 可以表达“冻结所有东西，除了这个 global property”或者“不要冻结这个 prototype”。在业务代码里维护这种列表很脆弱，也容易产生错误安全感。

同理，也不要把“锁对象方法和属性”塞进 `lockdown()` 配置。对象级锁定应该是 facade 自己的代码契约：谁负责暴露 public API，谁负责在 `lockdown()` 后调用 SES `harden()` 并配套 facade contract tests。

建议使用这些机制：

- `lockdown()` 前：完成所有必要的 global writes；如果确实需要受控可变的全局属性，提前安装 accessor-based globals。
- `lockdown()` 后：只暴露明确的 SES `harden()` 过的 capability facades。
- 对不可信代码：使用 `Compartment`，通过 endowments 做 allowlist。
- 对 OneKey app 自身代码：避免 blacklist；把可变实现状态留在私有 closure / module scope，只 harden public surface。

---

## 风险清单

### 启动期全局写入失败

原因：`lockdown()` 早于 `desktopApiProxy`、extension bridge globals 或未来 web globals 安装；或者第三方库在 `lockdown()` 之后继续 patch intrinsic prototype。

缓解：只从平台 entry file 调用 `maybeLockdownOneKeyRuntime()`，并放在必要 bootstrap writes 之后。SES 2.2.0 不会把 `globalThis` 本身变成不可扩展，但会冻结 `Object.prototype` 等 intrinsics，仍需验证所有启动后 patch 行为。

### Error stack 可读性下降

原因：误把 `errorTaming` 改成 `'safe'`，或误启用 `consoleTaming: 'safe'` / stack filtering。

缓解：本轮固定使用 `errorTaming: 'unsafe-debug'`、`consoleTaming: 'unsafe'` 和 `stackFiltering: 'verbose'`。单元测试必须断言 L1/L2 都不会改成 safe 配置。

### 第三方库在 lockdown 后修改 prototype

原因：polyfill 或库兼容问题。

缓解：所有 polyfills 必须在 `lockdown()` 前运行。仍在启动后 patch primordials 的库不兼容，需要隔离、调整顺序、打 patch，或者排除在本轮 rollout 外。

### 热更新 bundle 的 hardening 行为不一致

原因：旧 app shell 加载了 hardening 默认值不同的新 JS bundle，或者 fallback bundle 的行为不同。

缓解：hardening 必须放在 app-shell-compatible flag 后面；bundle release diff-check 必须显式检查 `packages/shared/src/security/sesHarden` 下的变化。

### Extension DApp provider 兼容性破坏

原因：误把 `lockdown()` 放进 content script 或 MAIN world injected script。

缓解：明确排除这些 entry points，并在 CI 里加 build-time grep guard 后再启用 extension lockdown。

---

## 测试方案

必须同时有单元测试和 E2E 测试。单元测试证明 hardening helper、配置映射和 facade contract 正确；E2E 测试证明每个 runtime 在对应 harden level 下仍能完成真实启动、bridge、更新、错误上报和 DApp 交互。

### Post-lockdown patch warning

Dev mode 下，L1/L2 成功执行 `globalThis.lockdown(options)` 后，runtime 会安装一个低侵入的 patch warning monitor：

- 监听当前 realm 的 `error` 和 `unhandledrejection`。
- 如果错误信息符合 `Cannot assign to read only property`、`Cannot redefine property`、`object is not extensible`、`Cannot define property` 等 harden 后常见 patch 失败形态，会写入 `globalThis.__ONEKEY_SES_HARDEN_PATCH_WARNINGS__`。
- 生产环境不安装 monitor，避免常驻全局错误监听带来额外性能和日志噪音。
- 最多保留最近 20 类唯一提醒，而不是最近 20 次触发；同一类错误通过 `fingerprint` 去重，只更新 `count` 和 `lastSeenAt`，避免同一类 error 占满 20 个名额。
- 每次触发仍会在 console 输出 `[OneKey SES Harden] Post-lockdown patch attempt detected`，方便 dev/internal 环境即时观察。
- 开发者工具的 SES Harden Runtime Check 会展示 monitor 是否启用、是否已安装、唯一 warning 数、累计触发数，并把 `fingerprint`、`count`、`lastSeenAt` 放进复制结果 JSON。

这个机制的用途是辅助判断：某段业务 patch 是否应该移动到 `lockdown()` 之前，或者是否存在异常/恶意代码在 harden 后尝试改写冻结对象。

边界也要明确：

- 它不是拦截器，不会阻止 patch；真正阻止来自 SES harden 后的冻结对象。
- 它只能捕获“抛出来并到达全局 error / unhandledrejection 的失败”。如果代码自己 `try/catch` 吞掉异常，或者非严格模式赋值静默失败，浏览器不会产生全局事件，monitor 也无法可靠捕获。
- 不建议为了捕获所有尝试而 monkey patch `Object.defineProperty`、`Reflect.set` 或 assignment 路径；这会在 `lockdown()` 前污染 intrinsics，反而增加兼容和安全风险。

### 单元测试

当前已新增测试文件：

```text
packages/shared/src/security/sesHarden/sesHarden.test.ts
```

最低覆盖：

- `normalizeSesHardenLevel()` / `getSesHardenLevelFromRuntime()`：
  - 未配置时返回 L0。
  - 非法 level 回退到 L0 或抛出受控错误，不能静默进入严格模式。
- `getLockdownOptions(level)`：
  - L1 / L2 的配置和文档保持一致。
  - 每个 level 只收紧预期字段，避免一次改变多组高风险行为。
  - `localeTaming` 必须保持 `'unsafe'`。
  - `regExpTaming` 必须保持 `'unsafe'`。
  - `errorTaming` 必须保持 `'unsafe-debug'`。
  - `consoleTaming` 必须保持 `'unsafe'`。
  - `errorTrapping` 和 `unhandledRejectionTrapping` 必须保持 `'none'`。
- `maybeLockdownOneKeyRuntime({ runtime })`：
  - L0 不调用 `lockdown()`。
  - 同一 realm 内多次调用幂等。
  - L1/L2 调用注入的 `lockdown()`，且传入正确配置。
- SES `harden()` facade 调用点：
  - L0 只验证 facade 清单和 contract tests，不调用 `harden()`。
  - L1 及以后在 `lockdown()` 后，调用点直接使用 SES `globalThis.harden(api)`；helper 只提供 `getSesHarden()`，不自定义 harden 语义。
  - 返回对象不能新增、删除、替换 public method。
  - method identity 保持稳定。
  - method 内部闭包状态仍可变化。
  - cache、map、listener registry、transport state 不能作为 facade 属性暴露给 `harden()`。

不要在普通 Jest 进程里直接调用真实 `lockdown()`。`lockdown()` 会不可逆地修改当前 realm，一旦在共享 Jest worker 里执行，可能污染同一个 worker 后续所有测试。

真实 `lockdown()` 行为测试必须用子进程隔离。当前实现是在 `sesHarden.test.ts` 内通过 `execFileSync(process.execPath, ['-e', source, options])` 为 L1/L2 各 spawn 一个独立 Node 进程，避免污染 Jest worker。

子进程测试最低覆盖：

- L1/L2 后 `Object.prototype`、`Array.prototype` 等 intrinsics 已被冻结。
- L1 下 `evalTaming: 'unsafe-eval'` 生效，`Function('return this')()` 仍能拿到 `globalThis`。
- L2 下 `evalTaming: 'safe-eval'` 生效，`Function('return this')()` 不再返回当前 `globalThis`。
- L2 下 `errorTaming`、`consoleTaming`、`localeTaming`、`regExpTaming` 仍保持本轮约定的 unsafe 配置。

建议新增脚本：

```json
{
  "test:ses:unit": "yarn jest packages/shared/src/security/sesHarden/sesHarden.test.ts"
}
```

### Facade contract tests

每个准备交给 SES `harden()` 的 facade 都必须有契约测试，不能只测 helper。

最低覆盖对象：

- Desktop renderer `desktopApiProxy` public facade。
- Extension UI bridge facade。
- Extension background bridge facade。
- `AppUpdate` / `BundleUpdate` facade objects。
- 后续新增的跨边界 API facade。

每个 facade 至少验证：

- 公开方法列表稳定。
- 公开方法不能被 reassignment / delete / extension 篡改。
- 原有调用路径仍返回预期结果。
- listener add/remove 流程仍正常。
- 内部 mutable state 没有被误 freeze。

### E2E 测试

E2E 必须按 runtime 和 level 建矩阵。每次推进只跑目标 runtime 的目标 level，但进入 beta/stable 前要跑完整矩阵。

建议矩阵：

| Runtime | PR 必跑 | Nightly / release candidate | Promotion gate |
| --- | --- | --- | --- |
| Web | L0、目标 level smoke | L0-L2 全量 | 当前 level 和上一 level 都必须通过 |
| Desktop renderer | L0、目标 level smoke | L0-L2 全量，含 JS bundle update / fallback | 当前 level、上一 level、热更新链路必须通过 |
| Extension UI/background/offscreen | L0、目标 level smoke | L0-L2 全量，含 MV3 service worker/offscreen/DApp provider | 当前 level、上一 level、DApp provider smoke 必须通过 |

Web E2E 最低覆盖：

- clean profile 启动。
- 登录 / 解锁。
- IndexedDB hydration。
- 钱包首页核心数据加载。
- 交易关键路径 smoke test。
- service worker update banner。
- intentional error 后 Sentry / local stack 仍可定位。
- reload 后无 failed assignment to read-only/frozen global。

Desktop E2E 最低覆盖：

- clean profile 启动。
- renderer boot。
- `desktopApiProxy.system.getSystemInfo()`。
- app shell update check path。
- JS bundle update：download、verify、switch、restart。
- rollback to builtin bundle。
- WebView 打开和 DApp connection smoke test。
- intentional error 后 Sentry / local stack 仍可定位。

Extension E2E 最低覆盖：

- popup boot。
- side panel boot。
- passkey page boot。
- background service worker wake / suspend / wake。
- offscreen bridge reconnect。
- 测试 DApp 上 provider injection 正常。
- 测试 DApp 上 message bridge 正常。
- 确认 content script 和 MAIN world injected script 没有调用 `lockdown()`。
- MV3 CSP 没有变化。

建议新增脚本：

```json
{
  "test:ses:e2e:web": "ONEKEY_SES_HARDEN_LEVEL=L2 yarn app:web:build && node scripts/e2e/ses-web.mjs",
  "test:ses:e2e:desktop": "ONEKEY_SES_HARDEN_LEVEL=L2 yarn app:desktop:build && node scripts/e2e/ses-desktop.mjs",
  "test:ses:e2e:ext": "ONEKEY_SES_HARDEN_LEVEL=L2 yarn app:ext:build && node scripts/e2e/ses-ext.mjs"
}
```

具体 E2E runner 可以复用现有 Electron/browser 自动化能力；如果还没有统一 runner，第一版至少要把 clean boot、console error scan、bridge smoke、intentional error、reload/restart 做成自动化。

### CI gate

CI 分层建议：

- PR gate：
  - `yarn lint:staged`
  - `yarn tsc:staged`
  - `yarn test:ses:unit`
  - 目标 runtime 的 L0/目标 level smoke E2E
- Nightly：
  - Web / Desktop / Extension 的 L0-L2 E2E 矩阵。
- Release candidate：
  - 目标 runtime 当前 level 和上一 level 都跑全量。
  - Desktop 必须跑 old shell -> new JS bundle -> builtin fallback。
  - Extension 必须跑测试 DApp provider injection/message bridge。

任何一个 level 的单元测试或 E2E 失败，都不能继续收紧到下一档。

---

## Rollout 建议

按“先松后紧”推进，不要一次性切到 SES 默认配置。

1. 合入文档和默认 no-op 的 helper scaffold，对应 L0。
2. 合入 Desktop / Web / Extension API 的 facade 清单和 contract tests，仍然属于 L0。
3. 只在 internal/dev build 对 Web 启用 L1，并在 `lockdown()` 后对 L0 确认过的稳定 facade 调用 SES `harden()`；完成全量回归后再进入 L2。
4. Web 从 L1 -> L2 推进；两档之间必须跑完整回归。
5. Web 稳定后，再用同样阶梯推进 Desktop renderer。
6. Desktop renderer 稳定后，再用同样阶梯推进 Extension UI/background/offscreen。
7. 每次只把一个 runtime、一个 level 推进到 beta。
8. 三端稳定后，再单独设计 Mobile 方案。

每一档的退出标准：

- `yarn test:ses:unit` 通过。
- 本档涉及的 facade contract tests 通过。
- 目标 runtime 的当前 level E2E 通过。
- 目标 runtime 的上一 level E2E 仍然通过，确认没有回归。
- 构建和 typecheck 通过。
- clean profile 启动通过。
- 登录 / 解锁 / 钱包首页 / 交易关键路径 smoke test 通过。
- 对应端的 bridge / update / reload / restart path 通过。
- Sentry 或本地错误诊断仍能定位问题。
- 没有 failed assignment to read-only/frozen global。
- 没有新增高频 console error / warning。

在完成 old shell -> new JS bundle -> builtin fallback 的热更新完整验证前，不要把 L2 推到 stable。`errorTaming: 'safe'`、`consoleTaming: 'safe'`、`regExpTaming: 'safe'`、`localeTaming: 'safe'` 不纳入本轮 rollout；如果未来要启用，必须另起独立 RFC 和独立灰度。
