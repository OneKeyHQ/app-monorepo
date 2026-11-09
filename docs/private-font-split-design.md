# 品牌字体配置与构建（Roobert）

公开源码使用开源替代字体 Inter；官方构建从 `OneKeyHQ/app-private-fonts` 获取 Roobert。
两者通过 `fonts:sync` 写入相同的 `fonts/brand/BrandSans-*.ttf` 槽位并生成 `manifest.ts`，业务代码使用 `brandFont.ts`。
生成的字体与 manifest 不提交，Geist Mono 保持不变。此改动不清除已有 Git 历史中的字体。

## 1. 配置

发布前在 app-monorepo 配置两个 Actions secret：

| Secret | 用途 |
|---|---|
| `PRIVATE_FONTS_TOKEN` | Fine-grained PAT，仅允许读取 `OneKeyHQ/app-private-fonts` 的 Contents；只交给隔离的 `private-fonts` job |
| `PRIVATE_FONTS_ARTIFACT_KEY` | `openssl rand -hex 32` 生成的 64 位小写 hex 密钥；用于字体 artifact 的加密和解密 |

`packages/components/src/hocs/Provider/fonts/brand.lock.json` 固定私有仓库 commit、四个字重的路径和 SHA-256。
更新字体时同步更新此锁文件。PAT 需由负责人维护有效期并在到期前轮换。

本地开发不需要配置以上 Actions secret：

- `yarn` 的 postinstall 会运行 `fonts:sync`，也可执行 `yarn fonts:sync`。
- 脚本依次尝试 `ONEKEY_PRIVATE_FONTS_DIR`、EAS 暂存目录、私有仓库（`ONEKEY_PRIVATE_FONTS_TOKEN` 或本机 `gh auth token`），每次使用前校验锁文件。
- 没有私有字体访问权限时使用 Inter。`ONEKEY_FONTS_FORCE_FALLBACK=1 yarn fonts:sync` 可预览开源版。
- 字体切换后，iOS 需重新 `pod install` 并编译，Android 需重新编译。

## 2. 构建流程

所有发布 workflow 使用同一流程：

1. `private-fonts.yml` 在独立 job 中仅稀疏检出 `github.sha` 上的锁文件，不运行检出的仓库代码。
   用 PAT 读取锁定 commit 的四个 `fonts/*.ttf` 文件，并校验 SHA-256；不接受调用方指定锁文件 ref。
2. 用 `PRIVATE_FONTS_ARTIFACT_KEY` 做 AES-256-GCM 加密（每次随机 IV），上传保留 1 天的 artifact。
   job output 只包含 artifact 名称，密钥通过 Actions secret 提供，不作为普通 output 传递。
3. 构建 job 下载 artifact，解密到 `$RUNNER_TEMP`，导出 `ONEKEY_PRIVATE_FONTS_DIR`。
   `fonts:sync` 按构建 checkout 的锁文件再次校验，然后编译；构建 job 不接触 PAT。

| 构建类型 | 处理 |
|---|---|
| Desktop、Web、Ext、OTA bundle | 使用上述流程，并设置 `ONEKEY_REQUIRE_PRIVATE_FONTS=1` |
| iOS / Android（EAS） | Actions 执行 `fonts-sync.js --stage-eas`，将字体放入 `.eas-private-fonts/` 随项目上传；EAS 安装时识别该目录，`--verify-native` 校验原生副本，不需要字体访问凭据 |
| 常规 PR 检查 | 不注入字体凭据，使用 fallback |
| `release-app-bundles` 的 fork PR | `validate-pr` 拒绝非白名单作者；`TRUSTED_PR_AUTHORS` 白名单 fork PR 还需通过 commit Attest，构建固定到已验证的 head SHA |
| 公开 GHCR 开发预构建包 | 强制 `ONEKEY_FONTS_FORCE_FALLBACK=1`，不含 Roobert |

安全边界：公开 Actions artifact 只保存密文，secret 在日志中打码；获准执行的构建代码能够读取解密后的字体和 artifact 密钥。
固定密钥泄露会暴露使用该密钥的其他已保存字体 artifact，包括不同运行或字体版本，但该密钥不授予私有仓库访问权。
artifact 保留 1 天不影响已下载的副本，轮换密钥也不能撤销旧密文的解密能力。
本方案接受这一字体文件范围内的风险，保留 PAT 隔离、锁文件校验和 fork 校验，不增加跨 job 的一次性密钥服务。
目标是停止在公开源码和公开开发预构建包中分发商业字体；正式产物仍需携带字体，不提供字体不可提取的保证。

## 3. 失败与排查

- 本地私有字体不可用或校验失败：打印提示并使用 Inter。
- 发布构建设置 `ONEKEY_REQUIRE_PRIVATE_FONTS=1`：缺少字体、secret 未配置或哈希不匹配时构建失败，不静默降级。
- 构建 checkout 与下载 job 的锁文件不一致：重新确认 ref 和锁文件，保留校验，不绕过失败。
- EAS 原生字体与 JS 槽位不一致：检查 `--stage-eas`、pod install 和 `--verify-native` 的执行结果。
- PAT 失效：轮换 `PRIVATE_FONTS_TOKEN`；artifact 密钥泄露：轮换 `PRIVATE_FONTS_ARTIFACT_KEY`，同时按上述边界评估已保存的字体密文。

`development/lint/font.js` 校验已跟踪字体的授权信息；Android 字体资源测试校验副本。
正式包若意外使用 fallback，`reportBrandFontFallback.ts` 会向 Sentry 报告。
