# LavaMoat Policy Review Index

本文件由 `yarn lavamoat:review` 生成，用于 PR review 时快速定位高风险权限分类。不要手工编辑。

`review/` 目录中的高风险分类文件基于 `policy.json` 与同目录 `policy-override.json` merge 后的有效 policy 生成；显式 deny 的 override 会从有效权限视图中移除，并单独写入 `denied-overrides.json`。

## 当前范围

当前启用目标：

- `webpack/cli`：CLI Node runtime
- `webpack/desktop-main`：Electron main
- `webpack/desktop-preload`：Electron preload
- `webpack/desktop-services/index`：Electron service index
- `webpack/desktop-services/enum`：Electron service enum
- `webpack/desktop-services/windowsHello`：Electron service windowsHello
- `webpack/desktop-services/checkBiometricAuthChanged`：Electron service checkBiometricAuthChanged
- `node/build-tools`：CLI esbuild source runtime
- `webpack/ext/mv3/pages`：MV3 extension pages
- `webpack/ext/mv3/background`：MV3 extension background
- `webpack/ext/mv3/content-script`：MV3 extension content-script
- `webpack/web-embed`：Embedded WebView production webpack bundle
- `webpack/web`：Web production webpack bundle，apps/web 生产构建
- `webpack/desktop-renderer`：Electron renderer production webpack bundle，Desktop 渲染进程生产构建

当前暂缓目标，只允许保留空目录占位：

- `webpack/ext/mv2`
- `metro/mobile-main`
- `metro/mobile-bg`

暂缓目标目录中的 `.gitkeep` 内容固定为 `placeholder`，避免 CI 生成的 policy diff patch 出现空白行警告。

## Policy 摘要

| 目标 | 说明 | Policy | 总资源 | 高风险资源 | 高风险条目 | 指向高风险资源的 package 边 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `webpack/cli` | CLI Node runtime | [policy](../webpack/cli/policy.json) | 853 | 47 | 143 | 90 |
| `webpack/desktop-main` | Electron main | [policy](../webpack/desktop-main/policy.json) | 216 | 70 | 350 | 132 |
| `webpack/desktop-preload` | Electron preload | [policy](../webpack/desktop-preload/policy.json) | 2 | 0 | 0 | 0 |
| `webpack/desktop-services/index` | Electron service index | [policy](../webpack/desktop-services/index/policy.json) | 1 | 1 | 16 | 0 |
| `webpack/desktop-services/enum` | Electron service enum | [policy](../webpack/desktop-services/enum/policy.json) | 0 | 0 | 0 | 0 |
| `webpack/desktop-services/windowsHello` | Electron service windowsHello | [policy](../webpack/desktop-services/windowsHello/policy.json) | 1 | 0 | 0 | 0 |
| `webpack/desktop-services/checkBiometricAuthChanged` | Electron service checkBiometricAuthChanged | [policy](../webpack/desktop-services/checkBiometricAuthChanged/policy.json) | 1 | 0 | 0 | 0 |
| `node/build-tools` | CLI esbuild source runtime | [policy](../node/build-tools/policy.json) | 15 | 2 | 20 | 1 |
| `webpack/ext/mv3/pages` | MV3 extension pages | [policy](../webpack/ext/mv3/pages/policy.json) | 4012 | 289 | 788 | 1048 |
| `webpack/ext/mv3/background` | MV3 extension background | [policy](../webpack/ext/mv3/background/policy.json) | 3220 | 216 | 551 | 559 |
| `webpack/ext/mv3/content-script` | MV3 extension content-script | [policy](../webpack/ext/mv3/content-script/policy.json) | 46 | 13 | 36 | 22 |
| `webpack/web-embed` | Embedded WebView production webpack bundle | [policy](../webpack/web-embed/policy.json) | 442 | 55 | 128 | 107 |
| `webpack/web` | Web production webpack bundle，apps/web 生产构建 | [policy](../webpack/web/policy.json) | 4330 | 311 | 790 | 1103 |
| `webpack/desktop-renderer` | Electron renderer production webpack bundle，Desktop 渲染进程生产构建 | [policy](../webpack/desktop-renderer/policy.json) | 4272 | 312 | 867 | 1120 |

## 高风险分类统计

| 目标 | network | storage/privacy | extension/desktop bridge | hardware/device | crypto/random | code execution | DOM/navigation | Node system |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `webpack/cli` | 11/14 | 15/27 | 1/7 | 6/6 | 10/13 | 2/2 | 14/22 | 17/52 |
| `webpack/desktop-main` | 10/12 | 17/28 | 11/49 | 6/6 | 3/3 | 9/13 | 16/24 | 47/215 |
| `webpack/desktop-preload` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `webpack/desktop-services/index` | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 1/15 |
| `webpack/desktop-services/enum` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `webpack/desktop-services/windowsHello` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `webpack/desktop-services/checkBiometricAuthChanged` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `node/build-tools` | 1/1 | 1/3 | 0/0 | 1/1 | 0/0 | 1/1 | 1/1 | 1/13 |
| `webpack/ext/mv3/pages` | 104/126 | 110/159 | 13/100 | 51/52 | 69/74 | 22/36 | 143/241 | 0/0 |
| `webpack/ext/mv3/background` | 90/107 | 74/119 | 8/65 | 41/42 | 73/77 | 16/23 | 68/118 | 0/0 |
| `webpack/ext/mv3/content-script` | 2/2 | 6/10 | 4/10 | 2/2 | 1/1 | 1/1 | 6/10 | 0/0 |
| `webpack/web-embed` | 12/19 | 23/38 | 2/6 | 5/5 | 17/17 | 4/6 | 27/37 | 0/0 |
| `webpack/web` | 119/149 | 122/191 | 10/20 | 58/59 | 79/84 | 21/33 | 148/254 | 0/0 |
| `webpack/desktop-renderer` | 119/147 | 121/181 | 11/110 | 56/58 | 79/83 | 23/35 | 150/253 | 0/0 |

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

- `webpack/cli`: [summary](webpack/cli/summary.json) / [effective-policy-summary](webpack/cli/effective-policy-summary.json) / [denied-overrides](webpack/cli/denied-overrides.json) / [all-high-risk-entries](webpack/cli/all-high-risk-entries.json) / [network](webpack/cli/network.json) / [storage-privacy](webpack/cli/storage-privacy.json) / [extension-desktop-bridge](webpack/cli/extension-desktop-bridge.json) / [hardware-device](webpack/cli/hardware-device.json) / [crypto-random](webpack/cli/crypto-random.json) / [code-execution](webpack/cli/code-execution.json) / [dom-injection-navigation](webpack/cli/dom-injection-navigation.json) / [node-system](webpack/cli/node-system.json) / [package-edges-to-risky-resources](webpack/cli/package-edges-to-risky-resources.json)
- `webpack/desktop-main`: [summary](webpack/desktop-main/summary.json) / [effective-policy-summary](webpack/desktop-main/effective-policy-summary.json) / [denied-overrides](webpack/desktop-main/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-main/all-high-risk-entries.json) / [network](webpack/desktop-main/network.json) / [storage-privacy](webpack/desktop-main/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-main/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-main/hardware-device.json) / [crypto-random](webpack/desktop-main/crypto-random.json) / [code-execution](webpack/desktop-main/code-execution.json) / [dom-injection-navigation](webpack/desktop-main/dom-injection-navigation.json) / [node-system](webpack/desktop-main/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-main/package-edges-to-risky-resources.json)
- `webpack/desktop-preload`: [summary](webpack/desktop-preload/summary.json) / [effective-policy-summary](webpack/desktop-preload/effective-policy-summary.json) / [denied-overrides](webpack/desktop-preload/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-preload/all-high-risk-entries.json) / [network](webpack/desktop-preload/network.json) / [storage-privacy](webpack/desktop-preload/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-preload/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-preload/hardware-device.json) / [crypto-random](webpack/desktop-preload/crypto-random.json) / [code-execution](webpack/desktop-preload/code-execution.json) / [dom-injection-navigation](webpack/desktop-preload/dom-injection-navigation.json) / [node-system](webpack/desktop-preload/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-preload/package-edges-to-risky-resources.json)
- `webpack/desktop-services/index`: [summary](webpack/desktop-services/index/summary.json) / [effective-policy-summary](webpack/desktop-services/index/effective-policy-summary.json) / [denied-overrides](webpack/desktop-services/index/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-services/index/all-high-risk-entries.json) / [network](webpack/desktop-services/index/network.json) / [storage-privacy](webpack/desktop-services/index/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-services/index/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-services/index/hardware-device.json) / [crypto-random](webpack/desktop-services/index/crypto-random.json) / [code-execution](webpack/desktop-services/index/code-execution.json) / [dom-injection-navigation](webpack/desktop-services/index/dom-injection-navigation.json) / [node-system](webpack/desktop-services/index/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-services/index/package-edges-to-risky-resources.json)
- `webpack/desktop-services/enum`: [summary](webpack/desktop-services/enum/summary.json) / [effective-policy-summary](webpack/desktop-services/enum/effective-policy-summary.json) / [denied-overrides](webpack/desktop-services/enum/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-services/enum/all-high-risk-entries.json) / [network](webpack/desktop-services/enum/network.json) / [storage-privacy](webpack/desktop-services/enum/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-services/enum/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-services/enum/hardware-device.json) / [crypto-random](webpack/desktop-services/enum/crypto-random.json) / [code-execution](webpack/desktop-services/enum/code-execution.json) / [dom-injection-navigation](webpack/desktop-services/enum/dom-injection-navigation.json) / [node-system](webpack/desktop-services/enum/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-services/enum/package-edges-to-risky-resources.json)
- `webpack/desktop-services/windowsHello`: [summary](webpack/desktop-services/windowsHello/summary.json) / [effective-policy-summary](webpack/desktop-services/windowsHello/effective-policy-summary.json) / [denied-overrides](webpack/desktop-services/windowsHello/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-services/windowsHello/all-high-risk-entries.json) / [network](webpack/desktop-services/windowsHello/network.json) / [storage-privacy](webpack/desktop-services/windowsHello/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-services/windowsHello/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-services/windowsHello/hardware-device.json) / [crypto-random](webpack/desktop-services/windowsHello/crypto-random.json) / [code-execution](webpack/desktop-services/windowsHello/code-execution.json) / [dom-injection-navigation](webpack/desktop-services/windowsHello/dom-injection-navigation.json) / [node-system](webpack/desktop-services/windowsHello/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-services/windowsHello/package-edges-to-risky-resources.json)
- `webpack/desktop-services/checkBiometricAuthChanged`: [summary](webpack/desktop-services/checkBiometricAuthChanged/summary.json) / [effective-policy-summary](webpack/desktop-services/checkBiometricAuthChanged/effective-policy-summary.json) / [denied-overrides](webpack/desktop-services/checkBiometricAuthChanged/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-services/checkBiometricAuthChanged/all-high-risk-entries.json) / [network](webpack/desktop-services/checkBiometricAuthChanged/network.json) / [storage-privacy](webpack/desktop-services/checkBiometricAuthChanged/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-services/checkBiometricAuthChanged/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-services/checkBiometricAuthChanged/hardware-device.json) / [crypto-random](webpack/desktop-services/checkBiometricAuthChanged/crypto-random.json) / [code-execution](webpack/desktop-services/checkBiometricAuthChanged/code-execution.json) / [dom-injection-navigation](webpack/desktop-services/checkBiometricAuthChanged/dom-injection-navigation.json) / [node-system](webpack/desktop-services/checkBiometricAuthChanged/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-services/checkBiometricAuthChanged/package-edges-to-risky-resources.json)
- `node/build-tools`: [summary](node/build-tools/summary.json) / [effective-policy-summary](node/build-tools/effective-policy-summary.json) / [denied-overrides](node/build-tools/denied-overrides.json) / [all-high-risk-entries](node/build-tools/all-high-risk-entries.json) / [network](node/build-tools/network.json) / [storage-privacy](node/build-tools/storage-privacy.json) / [extension-desktop-bridge](node/build-tools/extension-desktop-bridge.json) / [hardware-device](node/build-tools/hardware-device.json) / [crypto-random](node/build-tools/crypto-random.json) / [code-execution](node/build-tools/code-execution.json) / [dom-injection-navigation](node/build-tools/dom-injection-navigation.json) / [node-system](node/build-tools/node-system.json) / [package-edges-to-risky-resources](node/build-tools/package-edges-to-risky-resources.json)
- `webpack/ext/mv3/pages`: [summary](webpack/ext/mv3/pages/summary.json) / [effective-policy-summary](webpack/ext/mv3/pages/effective-policy-summary.json) / [denied-overrides](webpack/ext/mv3/pages/denied-overrides.json) / [all-high-risk-entries](webpack/ext/mv3/pages/all-high-risk-entries.json) / [network](webpack/ext/mv3/pages/network.json) / [storage-privacy](webpack/ext/mv3/pages/storage-privacy.json) / [extension-desktop-bridge](webpack/ext/mv3/pages/extension-desktop-bridge.json) / [hardware-device](webpack/ext/mv3/pages/hardware-device.json) / [crypto-random](webpack/ext/mv3/pages/crypto-random.json) / [code-execution](webpack/ext/mv3/pages/code-execution.json) / [dom-injection-navigation](webpack/ext/mv3/pages/dom-injection-navigation.json) / [node-system](webpack/ext/mv3/pages/node-system.json) / [package-edges-to-risky-resources](webpack/ext/mv3/pages/package-edges-to-risky-resources.json)
- `webpack/ext/mv3/background`: [summary](webpack/ext/mv3/background/summary.json) / [effective-policy-summary](webpack/ext/mv3/background/effective-policy-summary.json) / [denied-overrides](webpack/ext/mv3/background/denied-overrides.json) / [all-high-risk-entries](webpack/ext/mv3/background/all-high-risk-entries.json) / [network](webpack/ext/mv3/background/network.json) / [storage-privacy](webpack/ext/mv3/background/storage-privacy.json) / [extension-desktop-bridge](webpack/ext/mv3/background/extension-desktop-bridge.json) / [hardware-device](webpack/ext/mv3/background/hardware-device.json) / [crypto-random](webpack/ext/mv3/background/crypto-random.json) / [code-execution](webpack/ext/mv3/background/code-execution.json) / [dom-injection-navigation](webpack/ext/mv3/background/dom-injection-navigation.json) / [node-system](webpack/ext/mv3/background/node-system.json) / [package-edges-to-risky-resources](webpack/ext/mv3/background/package-edges-to-risky-resources.json)
- `webpack/ext/mv3/content-script`: [summary](webpack/ext/mv3/content-script/summary.json) / [effective-policy-summary](webpack/ext/mv3/content-script/effective-policy-summary.json) / [denied-overrides](webpack/ext/mv3/content-script/denied-overrides.json) / [all-high-risk-entries](webpack/ext/mv3/content-script/all-high-risk-entries.json) / [network](webpack/ext/mv3/content-script/network.json) / [storage-privacy](webpack/ext/mv3/content-script/storage-privacy.json) / [extension-desktop-bridge](webpack/ext/mv3/content-script/extension-desktop-bridge.json) / [hardware-device](webpack/ext/mv3/content-script/hardware-device.json) / [crypto-random](webpack/ext/mv3/content-script/crypto-random.json) / [code-execution](webpack/ext/mv3/content-script/code-execution.json) / [dom-injection-navigation](webpack/ext/mv3/content-script/dom-injection-navigation.json) / [node-system](webpack/ext/mv3/content-script/node-system.json) / [package-edges-to-risky-resources](webpack/ext/mv3/content-script/package-edges-to-risky-resources.json)
- `webpack/web-embed`: [summary](webpack/web-embed/summary.json) / [effective-policy-summary](webpack/web-embed/effective-policy-summary.json) / [denied-overrides](webpack/web-embed/denied-overrides.json) / [all-high-risk-entries](webpack/web-embed/all-high-risk-entries.json) / [network](webpack/web-embed/network.json) / [storage-privacy](webpack/web-embed/storage-privacy.json) / [extension-desktop-bridge](webpack/web-embed/extension-desktop-bridge.json) / [hardware-device](webpack/web-embed/hardware-device.json) / [crypto-random](webpack/web-embed/crypto-random.json) / [code-execution](webpack/web-embed/code-execution.json) / [dom-injection-navigation](webpack/web-embed/dom-injection-navigation.json) / [node-system](webpack/web-embed/node-system.json) / [package-edges-to-risky-resources](webpack/web-embed/package-edges-to-risky-resources.json)
- `webpack/web`: [summary](webpack/web/summary.json) / [effective-policy-summary](webpack/web/effective-policy-summary.json) / [denied-overrides](webpack/web/denied-overrides.json) / [all-high-risk-entries](webpack/web/all-high-risk-entries.json) / [network](webpack/web/network.json) / [storage-privacy](webpack/web/storage-privacy.json) / [extension-desktop-bridge](webpack/web/extension-desktop-bridge.json) / [hardware-device](webpack/web/hardware-device.json) / [crypto-random](webpack/web/crypto-random.json) / [code-execution](webpack/web/code-execution.json) / [dom-injection-navigation](webpack/web/dom-injection-navigation.json) / [node-system](webpack/web/node-system.json) / [package-edges-to-risky-resources](webpack/web/package-edges-to-risky-resources.json)
- `webpack/desktop-renderer`: [summary](webpack/desktop-renderer/summary.json) / [effective-policy-summary](webpack/desktop-renderer/effective-policy-summary.json) / [denied-overrides](webpack/desktop-renderer/denied-overrides.json) / [all-high-risk-entries](webpack/desktop-renderer/all-high-risk-entries.json) / [network](webpack/desktop-renderer/network.json) / [storage-privacy](webpack/desktop-renderer/storage-privacy.json) / [extension-desktop-bridge](webpack/desktop-renderer/extension-desktop-bridge.json) / [hardware-device](webpack/desktop-renderer/hardware-device.json) / [crypto-random](webpack/desktop-renderer/crypto-random.json) / [code-execution](webpack/desktop-renderer/code-execution.json) / [dom-injection-navigation](webpack/desktop-renderer/dom-injection-navigation.json) / [node-system](webpack/desktop-renderer/node-system.json) / [package-edges-to-risky-resources](webpack/desktop-renderer/package-edges-to-risky-resources.json)

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
