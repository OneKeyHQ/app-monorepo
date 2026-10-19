# 私有品牌字体拆分方案（Roobert）

状态：设计稿，待确认 · 分支 `codex/private-font-split`

## 1. 背景与目标

`Roobert` 是 Displaay Type Foundry 的商业字体，字体文件 name table 明确禁止
"store on publicly accessible servers, redistribute"。当前它以 `.ttf` 原文件形式提交在公开仓库
`OneKeyHQ/app-monorepo` 中（2026-02-10，#10108 引入）。`Geist Mono` 为 SIL OFL 1.1，保持不变。

目标：

1. **开源可开发**：任何人 clone + `yarn` 后，所有平台都能直接编译运行，不需要任何私有凭据。
2. **官方构建用私有字体**：iOS / Android / Desktop / Ext / Web / OTA bundle 的正式产物继续使用 Roobert，视觉不变。
3. **防误发**：正式发布流水线若拿不到私有字体必须构建失败，不能静默降级。
4. **仓库内不再出现 Roobert 二进制**，后续也无法被重新提交。

## 2. 现状盘点（需改动的点）

| 位置 | 现状 |
|---|---|
| `packages/components/src/hocs/Provider/fonts/Roobert-*.ttf` | 4 个字重原文件（提交） |
| `apps/mobile/android/app/src/main/assets/fonts/Roobert-*.ttf` | Android 同步副本（提交，`ReactFontManager` 按 `<family>.ttf` 同步解析） |
| `apps/mobile/ios/Podfile` post_install | 硬编码文件列表，复制到 `ios/OneKeyWallet/Fonts/` 并加入 Xcode Resources |
| `apps/mobile/ios/OneKeyWallet/Info.plist` `UIAppFonts` / `project.pbxproj` | 硬编码 4 个 Roobert 文件名 |
| `hooks/useLoadCustomFonts.ts` | expo-font `require` 映射，key = family 名 |
| `web-fonts.css` / `utils/webFontFamily.ts` / `LightweightChart/chartOptions.ts` | Web 侧 `@font-face 'Roobert'` |
| `tamagui.config.ts` | native face 400–700 → `Roobert-*` |
| `kit/src/provider/useNativeListFonts*.ts` | NativeList 字体映射 + `document.fonts.load('Roobert')` |
| 约 10 处业务代码硬编码 `fontFamily: 'Roobert-Medium'` 等 | TabBar、ImageCrop、HeaderLeft、MarketSelector、Market MobileLayout、Perp OrderBook/TradingForm、SendAutoSizeAmountInput |
| `development/lint/font.js`、`apps/mobile/scripts/__tests__/android-font-assets.test.js` | 字节一致性校验 |
| `apps/mobile/bundle-registry/module-id-registry.json` | 记录了字体模块路径 |

关键约束：**iOS 通过字体内部 PostScript 名查找**（`Roobert-Medium`），**Android 通过 assets 文件名查找**，
**Web 的 `@font-face` family 是我们自定义的别名**。所以 JS 侧真正随字体变化的只有"native family 名"。

## 3. 总体设计

引入一个"品牌无衬线字体槽位"（Brand Sans slot）。代码只认槽位，槽位里装什么字体由安装期脚本决定。

```
packages/components/src/hocs/Provider/fonts/
├── GeistMono-*.ttf                 # 不变（OFL）
├── fallback/                       # 提交：开源替代字体 + LICENSE（OFL）
│   ├── <Fallback>-{Regular,Medium,SemiBold,Bold}.ttf
│   └── OFL.txt
└── brand/                          # 整个目录 gitignore，由 fonts:sync 生成
    ├── BrandSans-Regular.ttf       # 固定槽位文件名
    ├── BrandSans-Medium.ttf
    ├── BrandSans-SemiBold.ttf
    ├── BrandSans-Bold.ttf
    └── manifest.ts                 # 生成：native family 名 + 来源标记
```

`manifest.ts`（生成）示例：

```ts
export const brandFontManifest = {
  source: 'private', // 'private' | 'fallback'
  nativeFamily: {
    regular: 'Roobert-Regular',
    medium: 'Roobert-Medium',
    semibold: 'Roobert-SemiBold',
    bold: 'Roobert-Bold',
  },
} as const;
```

### 3.1 代码侧：单一入口

新增 `packages/components/src/hocs/Provider/fonts/brandFont.ts`（提交）：

- re-export `brandFontManifest.nativeFamily` 为 `BRAND_FONT_NATIVE`；
- 导出 Web 别名常量 `BRAND_FONT_WEB_FAMILY = 'OneKeySans'`（固定，与字体无关）。

改造：

- `useLoadCustomFonts.ts`：`{ [BRAND_FONT_NATIVE.regular]: require('../fonts/brand/BrandSans-Regular.ttf'), ... }`，require 路径是静态的槽位名，Metro 可正常打包。
- `tamagui.config.ts`、`useNativeListFonts*.ts`、所有业务代码中的 `'Roobert-*'` 字面量 → `BRAND_FONT_NATIVE.*`。
- `web-fonts.css` → `@font-face { font-family: 'OneKeySans'; src: url('./fonts/brand/BrandSans-*.ttf') }`；
  `webFontFamily.ts`、`chartOptions.ts`、`useNativeListFonts.ts` 中的 `"Roobert"` → `OneKeySans`。CSS 可以提交，无需生成。
- 新增 lint 规则（oxlint `no-restricted-syntax` 或 `development/lint/font.js` 扩展）：禁止源码出现 `Roobert` 字面量（除文档）。

### 3.2 安装期：`yarn fonts:sync`

新增 `development/scripts/fonts-sync.js`，挂到 `postinstall`（在 `copy:inject` 之后），也可单独运行。

解析私有字体来源，按优先级：

1. `ONEKEY_PRIVATE_FONTS_DIR=/path/to/dir`：本地目录（发布 CI 下载好的目录、EAS 暂存目录）。4 个文件必须与 `brand.lock.json` 的 sha256 一致。
2. `ONEKEY_PRIVATE_FONTS_TOKEN` 或本机 `gh auth token`：从私有仓库 `OneKeyHQ/app-private-fonts` 按锁定 commit 下载（内部开发者零配置）。
3. 以上都不满足 → 使用 `fonts/fallback/`，打印一次明确提示（非错误）。

仓库中不再有任何 Roobert 文件。

执行步骤：

1. 拿到 4 个字重文件，**对照提交在仓库里的 `fonts/brand.lock.json` 校验 sha256**（锁文件只含仓库地址、commit、哈希，不含字体内容，可公开）。
2. 复制到 `fonts/brand/BrandSans-*.ttf`。
3. 读取字体 name table 的 PostScript 名（nameID 6），生成 `manifest.ts`。
4. 生成 Android 资源：`apps/mobile/android/app/src/main/assets/fonts/<PostScript>.ttf`（该目录的品牌字体条目 gitignore；GeistMono 保持提交）。
5. 写入 `fonts/brand/.source` 标记（private/fallback），供构建闸门读取。

`ONEKEY_REQUIRE_PRIVATE_FONTS=1` 时，若走到第 4 条（fallback）则直接 `exit 1`。

实现说明（步骤 2）：

- 私有仓库按 `brand.lock.json` 的 `commit` 通过 GitHub Contents API（`Accept: application/vnd.github.raw+json`）
  逐个下载锁文件中列出的 4 个文件，而不是整个 tarball：无需解压依赖，也不会拉取仓库里的授权凭证等其他文件。
  下载结果缓存在 `node_modules/.cache/onekey-private-fonts/<commit>/`，每次使用前重新校验 sha256。
- `commit` 为 `null` 表示私有仓库尚未发布，此时跳过该来源。
- `gh auth token` 无权限（外部贡献者）或网络不可达时，静默进入下一来源。
- 本地 `yarn` 永远不会因为字体失败：显式 token 无效、sha256 不匹配、`ONEKEY_PRIVATE_FONTS_DIR` 配错等错误，
  只打印警告并改用开源 fallback。只有 `ONEKEY_REQUIRE_PRIVATE_FONTS=1`（发布构建）时这些错误才是致命的。

### 3.3 iOS

- `Info.plist` `UIAppFonts` 与 `project.pbxproj` 改为固定槽位名 `BrandSans-*.ttf`，一次性提交，此后不随字体变化。
  iOS 按字体内部 PostScript 名注册，bundle 内的文件名不影响查找。
- `Podfile` post_install 从 `fonts/brand/` 复制槽位文件；`ios/OneKeyWallet/Fonts/` 加入 gitignore。

### 3.4 私有字体存放

新建私有仓库 **`OneKeyHQ/app-private-fonts`**（建议），内容：Roobert 4 个字重 + 授权凭证副本（内部存档）。
相比私有 npm 包：无需额外 registry 配置；相比 git submodule：开源用户 clone 时不会出现无法访问的子模块报错。

访问凭据：GitHub App，不使用长期 PAT。

- 组织管理员创建一个 GitHub App，只授予 Repository permissions → Contents: Read-only，只安装到 `app-private-fonts`。
- app-monorepo 配置：变量 `vars.PRIVATE_FONTS_APP_ID`，secret `secrets.PRIVATE_FONTS_APP_PRIVATE_KEY`，以及 secret `secrets.PRIVATE_FONTS_ARTIFACT_KEY`（用 `openssl rand -hex 32` 生成）。
- 每个发布 workflow 新增一个 `private-fonts` job（可复用 workflow `.github/workflows/private-fonts.yml`），这个 job **不运行任何仓库代码**：
  - 只稀疏检出 workflow 自身提交（`github.sha`）上的 `brand.lock.json`，**从不读取 PR 或调用方传入的 ref**，所以 PR 无法改变 App token 读取私有仓库中的哪些文件；
  - 路径还限定为 `fonts/*.ttf`；
  - 用固定 SHA 的 `actions/create-github-app-token` 生成仅 `contents:read` 的 token，下载 4 个文件、校验 sha256 后立即撤销 token。
- 本仓库是公开的：artifact 任何登录用户都能下载，步骤日志（包括每个 step 的 `env:`）也公开。所以字体用 secret
  `PRIVATE_FONTS_ARTIFACT_KEY`（64 位 hex，日志中自动打码）做 AES-256-GCM 加密后，作为保留 1 天的 artifact 上传。
  不使用"一次性密钥 + job output"的方式，因为 output 作为普通 env 传入下一个 step 时会被明文打印到日志里。
- 构建 job `needs: private-fonts`，在 checkout 之后下载 artifact，用同一个 secret 解密到 `$RUNNER_TEMP`，
  再通过 `ONEKEY_PRIVATE_FONTS_DIR` 交给 `fonts:sync`，按本 job 检出的 lock 再校验一次。
  若 PR 修改了 lock，校验会失败，这类构建无法使用私有字体。
- **App 私钥只出现在 `private-fonts` job 中。** 任何 job 引用的 secret 都会进入该 job 的 runner 进程内存，同 job 内运行的代码可能读取。
  构建 job 只持有 artifact 密钥：它只能解密字体 artifact，不能访问私有仓库。即使泄露，暴露范围也只是这些字体（构建 job 本来就能拿到），轮换这个 secret 即可。
- `workflow_run` 触发的 workflow 中，上游失败时 `private-fonts` 不运行，避免无意义地生成 token。
- `release-app-bundles` 按 PR 构建时，`validate-pr` 只放行同仓库 PR 和 `TRUSTED_PR_AUTHORS` 白名单作者的 fork PR，
  这些构建都在 CI 中自行拉取私有字体（与它们已能使用签名、QA 上传等 secret 的信任模型一致）。
  非白名单 fork PR 在 `validate-pr` 阶段即被拒绝，不会进入构建。
  fork PR 还要通过 "Attest fork PR commits"：PR 的每个 commit 都必须有 GitHub 验证通过的签名，作者和提交者必须是 PR 作者、
  白名单账号或对主仓库有 write 以上权限的成员（GitHub 网页提交的 `web-flow` 提交者除外），且最后一个 commit 等于已锁定的 head SHA。
  这样能防止 fork 的其他协作者推送的代码拿到字体和其他 secret。
- App 未配置时这两步自动跳过，发布构建会因 `ONEKEY_REQUIRE_PRIVATE_FONTS=1` 失败。

## 4. CI / 发布流水线

| 流水线 | 处理 |
|---|---|
| `lint.yml`、`unittest.yml`、`react-native-unittest.yml` 等 PR 检查 | 不注入 token，走 fallback。也就验证了"开源用户能编译" |
| `release-ios.yml` / `release-android.yml`（EAS） | EAS 上传时排除 gitignore 文件。Actions 在 `yarn install` 拉到私有字体后，执行 `fonts-sync.js --stage-eas` 复制到未被 ignore 的 `.eas-private-fonts/`，随项目一起上传。EAS 上 `yarn install` 的 postinstall（`fonts:sync`）会自动识别该目录（同样校验 sha256），所以 iOS `pod install` 复制进 Xcode 工程的就是 Roobert；`eas-build-post-install` 在 pod install 之后执行 `fonts-sync.js --verify-native`，校验 iOS/Android 原生副本与 JS 字体槽一致（`ONEKEY_REQUIRE_PRIVATE_FONTS=1`）。EAS 不需要任何 token/secret。不使用 `.easignore`：它会整体替代全仓库的 `.gitignore`，导致 `.env` 等文件被上传 |
| `release-native-bundle.yml`、`release-app-bundles.yml`（OTA JS bundle） | **必须** require private。否则 OTA bundle 中的 family 名会和原生包不一致，导致文字全部回退成系统字体 |
| `release-desktop*.yml`、`release-ext.yml`、`release-web.yml`、`build-desktop-renderer.yml` | 内联 token + 下载步骤 + `ONEKEY_REQUIRE_PRIVATE_FONTS=1` |
| `metro-dev-prebundle.yml`、`web-embed-prebundle.yml` | 产物发布为**公开** GHCR 包，因此强制 `ONEKEY_FONTS_FORCE_FALLBACK=1`，永远不含 Roobert。`brand/manifest.ts` 计入 metro dev vendor 指纹，本地装了 Roobert 的开发者不会复用 Inter 版预构建包 |
| 来自 fork 的 PR | 拿不到 secret，自动 fallback，不受影响 |

**合并前置条件**：GitHub App 必须先配置好，否则合并后所有发布构建都会失败（仓库内已无 Roobert）。

再加一道运行时保险：在正式包里，若 `brandFontManifest.source !== 'private'`，启动时上报 Sentry 告警（不阻断用户）。

## 5. 防回归

- `.gitignore`：`packages/components/src/hocs/Provider/fonts/brand/`、`apps/mobile/ios/OneKeyWallet/Fonts/`、Android `assets/fonts/Roobert-*`。
- `yarn agent:check` / lint 新增检查：任何被 git 跟踪的 `.ttf/.otf/.woff*` 文件，其 name table 的版权 / 授权字段必须为 OFL 或 Apache 白名单，否则失败。这样无论换成什么名字，商业字体都提交不进来。
- 更新 `development/lint/font.js` 与 `android-font-assets.test.js`：改为基于 manifest 校验，不再写死 `Roobert-*`。
- 重新生成 `module-id-registry.json` 中的字体路径条目。

## 6. 开发者体验

| 角色 | 操作 |
|---|---|
| 外部贡献者 | `git clone && yarn` → 自动使用 fallback 字体，一切照常。终端提示一行：当前为开源替代字体 |
| 内部开发者 | `gh` 已登录且有 `app-private-fonts` 读权限即可在 `yarn` 时自动拉取；没有权限则使用 Inter，`yarn` 不会失败。下载结果有缓存，离线也能复用 |
| 切换字体后 | `yarn fonts:sync`；iOS 需重新 `pod install` / 重新编译原生；Android 需重新编译原生（assets 变化） |

## 7. 历史记录处理（需决策）

删除当前文件后，git 历史中仍存在 Roobert。

| 方案 | 优点 | 代价 |
|---|---|---|
| A. 不改写历史，与 Displaay 沟通 / 补授权 | 零协作成本 | 依赖法务结论 |
| B. `git filter-repo` 清除字体路径并 force push `x` 及所有活跃分支 | 当前仓库彻底干净 | 所有 worktree / PR / fork 需重建；fork 和他人 clone 中仍有副本；GitHub 需联系支持清理缓存的 commit |

建议：先落地本方案（停止继续分发），历史部分交由法务决定 A 或 B。

## 8. 需要确认的问题

1. **fallback 字体选型**：Inter（覆盖语言最广，有 `tnum`）或 Geist Sans（与已用的 Geist Mono 同源，同为 OFL）。需要对比数字等宽、行高，避免截断。
2. **授权范围**：公司持有的 Roobert 授权是否覆盖 App 嵌入 + Web（app.onekey.so 以 Web 字体形式对外提供 `.ttf`，通常需要单独的 Web license）+ 浏览器扩展。
3. **槽位文件名**：构建产物中把 Roobert 文件以 `BrandSans-*.ttf` 存放（不修改字体数据和内部名称），需法务确认不属于授权条款中的 "rename"。若不接受，iOS 改为由 Podfile 动态写入 `UIAppFonts`，代价是每次 `pod install` 修改 Info.plist / pbxproj。
4. GitHub App 的创建与私钥轮换负责人。

## 9. 实施拆分（建议按 PR 顺序）

1. 槽位与 fallback：新增 `fonts:sync`、manifest、fallback 字体（Inter，取自已有依赖 `@expo-google-fonts/inter` 0.2.3）、代码中所有 `Roobert` 字面量收敛到 `BRAND_FONT_*`。
   `ONEKEY_FONTS_FORCE_FALLBACK=1 yarn fonts:sync` 可本地预览开源版效果。
2. 私有仓库 + CI/EAS 接入 + `ONEKEY_REQUIRE_PRIVATE_FONTS` 闸门；在 daily build 上验证各平台产物仍为 Roobert。
3. 删除仓库内 Roobert 文件、加 gitignore 与授权白名单检查。
4. （视法务结论）历史清理。

验收标准：

- 无 token 的干净 clone：iOS / Android / Desktop / Ext / Web 均能构建运行，显示 fallback 字体。
- 正式产物：各平台截图与改造前一致，首屏无截断（参考 Android README 中 TextMeasureCache 的问题）。
- 发布流水线去掉 token 后构建失败。
