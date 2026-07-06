# LavaMoat Policy Review Index

本文件由 `yarn lavamoat:review` 生成，用于 PR review 时快速定位高风险权限分类。不要手工编辑。

`review/` 目录中的高风险分类文件基于 `policy.json` 与同目录 `policy-override.json` merge 后的有效 policy 生成；显式 deny 的 override 会从有效权限视图中移除，并单独写入 `denied-overrides.json`。

## 当前范围

当前启用目标：

- `webpack/web`：Web production webpack bundle，apps/web 生产构建
- `webpack/desktop-renderer`：Electron renderer production webpack bundle，Desktop 渲染进程生产构建

当前暂缓目标，只允许保留空目录占位：

- `webpack/ext/mv2`
- `webpack/ext/mv3`
- `webpack/web-embed`
- `esbuild/desktop-main`
- `node/cli`
- `metro/mobile-main`
- `metro/mobile-bg`
- `build-system`

暂缓目标目录中的 `.gitkeep` 内容固定为 `placeholder`，避免 CI 生成的 policy diff patch 出现空白行警告。

## Policy 摘要

| 目标 | 说明 | Policy | 总资源 | 高风险资源 | 高风险条目 | 指向高风险资源的 package 边 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `webpack/web` | Web production webpack bundle，apps/web 生产构建 | [policy](webpack/web/policy.json) | 4528 | 241 | 440 | 841 |
| `webpack/desktop-renderer` | Electron renderer production webpack bundle，Desktop 渲染进程生产构建 | [policy](webpack/desktop-renderer/policy.json) | 4490 | 243 | 469 | 854 |

## 高风险分类统计

| 目标 | network | storage/privacy | extension/desktop bridge | hardware/device | crypto/random | code execution | DOM/navigation | Node system |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `webpack/web` | 73/89 | 41/71 | 10/32 | 5/6 | 75/79 | 18/28 | 85/135 | 0/0 |
| `webpack/desktop-renderer` | 74/90 | 39/65 | 11/56 | 6/7 | 75/79 | 20/30 | 87/142 | 0/0 |

## 高风险分类说明

`resources/entries` 分别表示命中该分类的 LavaMoat resource 数量，以及这些 resources 中命中的 global/builtin/native 权限条目数量。

`denied-overrides.json` 记录 `policy-override.json` 中显式设置为 `false` 的 global/builtin/package/native/env 条目。Review 时如果 raw `policy.json` 新增了高风险权限，但 override 显式 deny，需要同时确认 deny 的业务路径已经有测试覆盖，避免运行时才触发权限错误。

| 分类 | 含义 |
| --- | --- |
| `network` | 可发起网络请求或跨上下文加载脚本的浏览器 API |
| `storage-privacy` | 浏览器存储、剪贴板、cookie、文件读取等隐私相关 API |
| `extension-desktop-bridge` | 浏览器插件、Electron、Desktop bridge 等跨权限边界 API |
| `hardware-device` | USB、HID、Bluetooth、摄像头、地理位置等设备访问能力 |
| `crypto-random` | 加密、随机数、密钥相关 API |
| `code-execution` | 动态代码执行、worker、WebAssembly 等执行能力 |
| `dom-injection-navigation` | DOM 注入、HTML 解析、顶层跳转、opener/parent/top 等导航能力 |
| `node-system` | Node.js 系统 builtin 和 native module 能力 |

## Review 文件

- `webpack/web`: [summary](review/webpack/web/summary.json) / [effective-policy-summary](review/webpack/web/effective-policy-summary.json) / [denied-overrides](review/webpack/web/denied-overrides.json) / [all-high-risk-entries](review/webpack/web/all-high-risk-entries.json) / [network](review/webpack/web/network.json) / [storage-privacy](review/webpack/web/storage-privacy.json) / [extension-desktop-bridge](review/webpack/web/extension-desktop-bridge.json) / [hardware-device](review/webpack/web/hardware-device.json) / [crypto-random](review/webpack/web/crypto-random.json) / [code-execution](review/webpack/web/code-execution.json) / [dom-injection-navigation](review/webpack/web/dom-injection-navigation.json) / [node-system](review/webpack/web/node-system.json) / [package-edges-to-risky-resources](review/webpack/web/package-edges-to-risky-resources.json)
- `webpack/desktop-renderer`: [summary](review/webpack/desktop-renderer/summary.json) / [effective-policy-summary](review/webpack/desktop-renderer/effective-policy-summary.json) / [denied-overrides](review/webpack/desktop-renderer/denied-overrides.json) / [all-high-risk-entries](review/webpack/desktop-renderer/all-high-risk-entries.json) / [network](review/webpack/desktop-renderer/network.json) / [storage-privacy](review/webpack/desktop-renderer/storage-privacy.json) / [extension-desktop-bridge](review/webpack/desktop-renderer/extension-desktop-bridge.json) / [hardware-device](review/webpack/desktop-renderer/hardware-device.json) / [crypto-random](review/webpack/desktop-renderer/crypto-random.json) / [code-execution](review/webpack/desktop-renderer/code-execution.json) / [dom-injection-navigation](review/webpack/desktop-renderer/dom-injection-navigation.json) / [node-system](review/webpack/desktop-renderer/node-system.json) / [package-edges-to-risky-resources](review/webpack/desktop-renderer/package-edges-to-risky-resources.json)

## PR 作者自查

如果本 PR 修改了 `lavamoat/**/policy.json` 或 `lavamoat/review/**`，PR 作者需要先解释新增 package、新增强权限，以及不确定项，再请求 security reviewer 检查。

重点优先看 `all-high-risk-entries.json` 和 `package-edges-to-risky-resources.json`：前者列出当前 policy 中命中的强权限，后者说明哪些 package 可以访问到带高风险能力的 resource。判断新增或变化时必须结合 PR 的 `git diff`，不要只看快照文件本身。

可复制以下模板到 PR 评论中完成第一轮 review：

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
