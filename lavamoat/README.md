# OneKey LavaMoat 接入说明

本目录存放 LavaMoat 运行时 policy、人工 override，以及从 policy 派生出来的 review 视图。

当前接入通过 `@lavamoat/webpack` 在 production webpack build 中启用 SES lockdown 和 policy enforcement。`policy.json` 由 LavaMoat 根据 webpack module graph 自动生成；`policy-override.json` 仅用于人工最小补丁。

本轮实际启用范围只有 `webpack/web` 和 `webpack/desktop-renderer`；Ext、Web Embed、Desktop main、CLI、Mobile 和 build-system 目标暂不接入，只保留空目录占位，避免 PR review 误判为已启用。

CSS loader 产物不承载 JS capability 边界，并且 webpack 的 css-loader request 容易把本机绝对路径写进 readable resource id；当前配置会用 `LavaMoatPlugin.exclude` 排除 `.css` 资源，避免 policy 在不同机器或 CI 路径下产生无意义 diff。

## 参考来源

本接入方案参考了 MetaMask Extension 的公开 LavaMoat 实践，但没有直接复用它们的 policy 内容：

- MetaMask policy review 流程：<https://github.com/MetaMask/metamask-extension/blob/main/docs/lavamoat-policy-review-process.md>
- MetaMask `lavamoat/` 目录：<https://github.com/MetaMask/metamask-extension/tree/main/lavamoat>
- MetaMask webpack policy 目录按 `build`、`mv2`、`mv3` 拆分：<https://github.com/MetaMask/metamask-extension/tree/main/lavamoat/webpack>
- MetaMask browserify policy 目录按 `main`、`beta`、`flask`、`experimental` 拆分：<https://github.com/MetaMask/metamask-extension/tree/main/lavamoat/browserify>
- MetaMask policy 生成脚本：<https://github.com/MetaMask/metamask-extension/blob/main/development/generate-lavamoat-policies.js>
- MetaMask policy 校验 workflow：<https://github.com/MetaMask/metamask-extension/blob/main/.github/workflows/validate-lavamoat-policies.yml>
- MetaMask policy 自动更新 workflow：<https://github.com/MetaMask/metamask-extension/blob/main/.github/workflows/update-lavamoat-policies.yml>
- LavaMoat 官方仓库：<https://github.com/LavaMoat/LavaMoat>
- `@lavamoat/webpack` 实现目录：<https://github.com/LavaMoat/LavaMoat/tree/main/packages/webpack>
- LavaMoat policy diff review 指南：<https://lavamoat.github.io/guides/policy-diff/>
- GitHub Actions 从 workflow 触发 workflow 的 token 行为：<https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow>

MetaMask 的 policy 绑定的是它们自己的 extension 入口、依赖图、build 类型和 bundler 输出；OneKey 的 Web 与 Desktop Renderer 依赖图不同，所以不能直接拷贝 MetaMask policy 来省略本仓库的生成、review 和回归验证。

当前 MetaMask 的核心机制是：

- `validate-lavamoat-policies` workflow 会重新生成当前启用 target 的 policy、检查 working tree diff，并在失败时上传 `lavamoat-policy-diff-*` patch artifact。
- `update-lavamoat-policies` 由 PR 评论触发，查找对应 commit 的 CI run，下载 policy patch，应用到 PR 分支并提交。
- 自动更新后会比较同一运行时族内不同变体的 policy diff，例如 browserify `main` 与 `beta/flask/experimental`、webpack MV2/MV3 变体。
- PR 作者需要先解释 policy diff 中新增的 powers、packages 和不确定项，再请求 policy reviewer；安全 reviewer 可继续升级到 supply-chain review。

OneKey 保留这些可迁移机制：自动生成 policy、检查 `lavamoat/` diff、上传 policy patch artifact、通过 PR 评论触发 bot 应用 patch 并提交、要求 PR 作者先做 policy diff 说明。差异点是：

- OneKey 当前启用的 `webpack/web` 和 `webpack/desktop-renderer` 是不同运行目标，不要求 policy diff 一致，因此暂不照搬 MetaMask 的同族 diff consistency check；后续如果同一运行目标新增多个 flavor，再补类似检查。
- MetaMask 使用内部 token exchange action 获取细粒度 bot token；本仓库的 update workflow 会优先使用 `ONEKEYBOT_GITHUB_TOKEN`，未配置时回退 GitHub Actions `GITHUB_TOKEN`，并通过 job-level permissions 把 `contents: write` 限制在真正应用 patch 的 job。
- MetaMask 在失败日志中直接输出完整 patch；OneKey policy patch 体积更大，CI 只输出 diff 摘要和 patch 字节数，完整 patch 仍通过 artifact 提供给 bot 或人工下载。

## 目录约定

启用目标与暂缓目标列表以 `development/lavamoat/targets.cjs` 为准；新增运行目标时先更新该配置，再补对应构建接入、policy 生成脚本和 CI 校验。

- `webpack/web/`：Web production webpack bundle。
- `webpack/desktop-renderer/`：Electron renderer production webpack bundle。
- `review/`：由 `yarn lavamoat:review` 生成的高风险权限 review 视图，入口是 `review/README.md`。

以下目标暂不在本轮接入范围，仅保留占位目录：`webpack/ext/mv3/`、`webpack/ext/mv2/`、`webpack/web-embed/`、`esbuild/desktop-main/`、`node/cli/`、`metro/mobile-main/`、`metro/mobile-bg/`、`build-system/`。

暂缓目标目录只能包含 `.gitkeep`，且 `.gitkeep` 内容固定为 `placeholder`。这不是运行时输入，只是为了让 CI 生成的 policy diff patch 在 `git apply --whitespace=error` 下保持干净。

以下暂缓 workspace package 不允许声明 LavaMoat 脚本：`apps/ext/package.json`、`apps/web-embed/package.json`、`apps/cli/package.json`、`apps/mobile/package.json`。如果后续要启用其中任一端，需要先从 `development/lavamoat/targets.cjs` 的 disabled 配置中移除，再补对应 policy 目录、脚本、CI 和功能验证。

LavaMoat 的 readable resource id 依赖 package dependency graph。启用目标所在 app 必须在自己的 `package.json` 中声明实际打包会引用的 workspace package；否则 monorepo 外层的 `packages/*` 容易被归成 `external:../../packages/...` 路径级 resource，导致 policy 大幅膨胀且 review 可读性下降。因此 `apps/web/package.json` 与 `apps/desktop/package.json` 都显式声明了 `@onekeyhq/kit`、`@onekeyhq/components`、`@onekeyhq/shared`、`@onekeyhq/kit-bg`、`@onekeyhq/core` 和 `@onekeyhq/qr-wallet-sdk`。

生产 native 有 `main` 和 `bg` 两个 JS runtime，二者在同一 native process 中运行但 JS heap 相互隔离；MMKV、DB handle、native singleton、文件句柄等 native resource 是进程内共享资源。后续若接入 mobile，需要至少拆成 `metro/mobile-main` 与 `metro/mobile-bg` 两份 policy，并单独处理 native resource 隔离问题。

## 常用命令

生成当前启用目标 policy：

```bash
yarn lavamoat:policy:all
```

`:all` 命令会先执行一次 `yarn copy:inject`，再依次运行当前启用目标，并在 raw policy 生成后执行 `yarn lavamoat:normalize-policies` 与 `yarn lavamoat:review`。单目标命令也会自行执行必要的 `copy:inject`、policy 归一化和 review 生成，适合本地只验证一个目标时使用。

单独归一化当前启用目标的 `policy.json` 与 `policy-override.json`：

```bash
yarn lavamoat:normalize-policies
```

LavaMoat/webpack raw 输出在大型 bundle 上可能出现 JSON key 顺序抖动，语义不变但会制造无意义 diff。归一化脚本会递归按 key 排序并保留 2 空格 JSON 格式，CI 的 artifact 校验也会要求提交的 policy 已经归一化。

生成 review 拆分视图：

```bash
yarn lavamoat:review
```

校验 policy artifact 结构、启用/暂缓目标范围、脚本/CI 覆盖，以及 JSON 中是否含本机绝对路径：

```bash
yarn lavamoat:validate-artifacts
```

该校验会要求 `policy.json` 和 `policy-override.json` 的文件集合都严格等于当前启用目标，并要求暂缓目标目录只能包含内容为 `placeholder` 的 `.gitkeep`。它还会检查 policy JSON 是否已归一化排序，检查 `lavamoat/README.md`、根 `package.json`、目标 workspace `package.json`、`validate-lavamoat-policies.yml` 和 `update-lavamoat-policies.yml` 是否覆盖 `development/lavamoat/targets.cjs` 中的启用目标，避免新增目标时漏掉脚本或 CI 步骤。

校验 LavaMoat 本地 tooling 的 diff patch 和生成范围检查逻辑：

```bash
yarn lavamoat:test-tooling
```

该自测只创建临时 git 仓库验证 `development/lavamoat/check-policy-diff.cjs`、`development/lavamoat/check-generated-file-scope.cjs` 和 `development/lavamoat/validate-policy-artifacts.cjs` 的成功/失败路径，包括 README 目标漂移、根脚本缺失、workspace 脚本缺失、workflow 命令缺失、policy diff artifact 上传/下载链路缺失、workflow 权限模型漂移、从非 `lavamoat/` 文件 rename 到 `lavamoat/` 的范围逃逸等负例。它还会运行 `yarn lavamoat:validate-webpack-integration`，确认普通 production webpack config 不会加载 LavaMoat，而显式打开 LavaMoat 时 Web/Desktop Renderer 会使用正确的 policy 目录。它不会生成 policy，也不会运行 Web/Desktop protected build。

CI 还会校验重新生成 policy 后的工作区变化范围：

```bash
yarn lavamoat:validate-generated-scope
```

这个检查要求生成阶段产生的未提交变化只出现在 `lavamoat/` 下，避免 `copy:inject` 或构建准备步骤意外把注入代码、静态资源等非 policy 文件改脏。rename 会同时检查源路径和目标路径，因此不能通过把非 `lavamoat/` 文件移动进 `lavamoat/` 来绕过范围限制。已经提交到 PR 里的业务代码变更不会触发该检查；本地运行时如果工作区已有未提交的非 `lavamoat/` 改动，需要先提交或 stash。

CI 校验等价于重新生成 policy、校验 artifact、校验生成变化范围，并检查 `lavamoat/` 是否产生 diff：

```bash
yarn lavamoat:ci:validate
```

这个命令用于 PR/CI gate，语义是“当前提交内的 `lavamoat/` 是否已经包含最新生成结果”。它通过 `development/lavamoat/check-policy-diff.cjs` 检查 tracked 和 untracked policy/review 文件，不会向当前 git index 写入 `intent-to-add` 状态。如果本地刚生成了新的未提交 policy，它会因为这些未提交变更而失败；这种情况应先 review 并提交 policy，再用 CI 校验。

如果只想检查当前 `lavamoat/` 是否相对 HEAD 有 diff，可以单独运行：

```bash
yarn lavamoat:diff
```

使用 LavaMoat 打包指定目标：

```bash
yarn lavamoat:build:web
yarn lavamoat:build:desktop-renderer
```

本地可以一次运行当前启用目标的 LavaMoat protected build：

```bash
yarn lavamoat:ci:build
```

GitHub workflow 会把 protected build 拆成 Web 与 Desktop Renderer 两个独立步骤，并给每个 target 设置 30 分钟超时，避免单个长时间构建步骤无法定位具体 target。两者都只覆盖本轮实际接入范围，用于确认生成的 policy 不会让生产构建失败。

## 已知警告与功能验证边界

当前 Web 与 Desktop Renderer protected build 可以完成，但构建过程仍会输出需要人工 review 的 LavaMoat/webpack warning：

- 部分依赖存在 LavaMoat compatible-code warning，例如动态 `require`、修改 primordial 或 patch 全局构造函数。这类 warning 不会自动阻断构建，但 PR review 时需要确认它们是否来自预期依赖和预期代码路径。
- `@onekeyfe/kaspa-wasm`、`@emurgo/cardano-serialization-lib-asmjs`、`zbar.wasm` 等 wasm/asmjs 相关依赖会触发动态 require 或静默产物输出 warning。涉及 Kaspa、Cardano、二维码/扫码、wasm 加载链路的功能需要纳入人工回归。
- Desktop Renderer 会出现少量 “module ids can't be controlled by policy” warning，说明这些模块在运行时无法完全由 policy 控制。它不阻止构建，但不能把当前 policy 视为完整安全边界，后续需要继续缩小或解释来源。

因此 `yarn lavamoat:ci:build` 只能证明“policy 能被 production build 应用且构建不失败”。正式合入前仍需要做最小功能 smoke test：打开 Web 和 Desktop Renderer 产物，覆盖启动、路由加载、钱包列表/资产页、网络请求、二维码/wasm 相关功能，以及 Desktop bridge 调用路径。

## Policy 更新 PR 工作流

常规业务 PR 如果引入新的第三方包、改动 import 图，或新增会触达高风险 API 的代码，需要重新生成 policy：

```bash
yarn lavamoat:policy:all
```

提交 PR 时一并提交 `lavamoat/**/policy.json`、`policy-override.json` 和 `lavamoat/review/**` 变更。CI 会运行 `validate-lavamoat-policies`，重新生成 policy、确认生成变化只落在 `lavamoat/`、检查 `lavamoat/` 是否仍有 diff，并在 diff 检查通过后分别运行 Web 与 Desktop Renderer 的 LavaMoat protected build。

如果开发者忘记提交 policy，CI 会失败并上传 `lavamoat-policy-diff-*` patch artifact。对同仓库 PR，可以在 PR 里评论：

```text
@onekeybot update-policies
```

`update-lavamoat-policies` workflow 仅接受 repository owner、member 或 collaborator 触发。普通状态回复 job 只使用读权限和 issue comment 权限；只有 validation 失败且需要应用 policy patch 时，`apply-and-commit` job 才会拿 `contents: write`，下载 CI 生成的 patch、应用到 PR 分支、确认生成变化只落在 `lavamoat/`、重新校验 policy artifact 结构、提交 `chore: update LavaMoat policies` 并 push。跨仓库 PR 暂不自动 push，需要本地运行 `yarn lavamoat:policy:all` 后手动提交。

为了让 bot push 后自动触发后续 CI，应配置仓库 secret `ONEKEYBOT_GITHUB_TOKEN`，使用可触发 workflow 的 bot token，例如 fine-grained PAT，或后续接入类似 MetaMask 的 GitHub App token exchange。未配置该 secret 时会回退 `GITHUB_TOKEN`，policy 更新仍可被推送，但 GitHub Actions 对 `GITHUB_TOKEN` 触发的 push 有递归保护，后续 workflow 可能不会自动运行，需要人工重新触发或批准 CI。

## Review 规则

`policy.json` 是自动生成产物，变更应由 `lavamoat:policy:*` 脚本产生，并经过 `lavamoat:normalize-policies` 归一化排序。`policy-override.json` 是人工维护的最小补丁，也必须保持同样的归一化格式。

Review 时先看 `policy.json` diff，再看 `review/README.md`、`review/**/summary.json` 和高风险分类文件。`lavamoat/review/**` 是当前有效 policy 的快照拆分视图，用来降低阅读成本；判断“新增/变化”必须以 PR 中 `lavamoat/**/policy.json`、`policy-override.json` 和 `lavamoat/review/**` 的 git diff 为准。

有效 policy 指 `policy.json` 与同目录 `policy-override.json` merge 后的运行时结果。如果 `policy-override.json` 里把某个扫描出的权限显式设置为 `false`，该权限不会出现在高风险分类允许项里，而会记录到 `denied-overrides.json`：

- `network.json`
- `storage-privacy.json`
- `extension-desktop-bridge.json`
- `hardware-device.json`
- `crypto-random.json`
- `code-execution.json`
- `dom-injection-navigation.json`
- `node-system.json`
- `package-edges-to-risky-resources.json`
- `denied-overrides.json`
- `effective-policy-summary.json`

重点解释新增的网络、隐私数据访问、Extension/Desktop bridge、硬件设备访问、动态执行、Node builtin/native 能力，以及哪些 package 新增了到高风险 resource 的访问边。

如果 `denied-overrides.json` 新增条目，需要解释为什么拒绝该权限，以及对应业务路径是否已通过 protected build、自动化测试或人工冒烟覆盖；否则运行时走到该路径会 fail closed。

## PR 评论模板

当 PR 修改 `lavamoat/**/policy.json` 或 `lavamoat/review/**` 时，PR 作者需要在 PR 中补充第一轮 review 说明，再请求安全 reviewer 检查：

```markdown
## LavaMoat Policy Review

### 变更来源

- [ ] 新增或升级依赖
- [ ] 业务代码 import 图变化
- [ ] webpack / 构建配置变化
- [ ] 重新生成 policy 后的稳定化变更

### 新增 packages

- package-a：预期引入，用于 ...
- package-b：由 package-a 间接引入，用于 ...

### 新增强权限

- `network.json`：
- `storage-privacy.json`：
- `extension-desktop-bridge.json`：
- `hardware-device.json`：
- `crypto-random.json`：
- `code-execution.json`：
- `dom-injection-navigation.json`：
- `node-system.json` / `native-modules.json`：

### 风险判断

- [ ] 新增权限和本 PR 业务目标一致
- [ ] 没有 UI-only / 纯工具类依赖异常获得高风险能力
- [ ] 不确定项已列出并需要 reviewer 判断：
```

当前 `.github/CODEOWNERS` 只有全仓默认 owner。后续如果仓库有明确的 security reviewer team，应将 `lavamoat/` 单独配置给该 team。
