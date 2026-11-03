# SVG 图标使用与新增

`packages/components/svg/` 是 App 图标的唯一源文件目录。业务代码通过图标名称使用资源；生成脚本负责名称注册、Web SVG symbol 和原生 SVG 资源打包。

## 新增 SVG

1. 将 SVG 放到对应分类目录的第一层，使用小写、连字符文件名和 `.svg` 扩展名，不创建嵌套目录。

   | 目录 | 用途 | 源文件示例 | 生成名称 |
   | --- | --- | --- | --- |
   | `outline` | 描边图标 | `search.svg` | `SearchOutline` |
   | `solid` | 实心图标 | `search.svg` | `SearchSolid` |
   | `brand` | 品牌标识 | `apple.svg` | `AppleBrand` |
   | `colored` | 彩色图标 | `user-avatar-fallback.svg` | `UserAvatarFallbackColored` |
   | `custom` | 自定义业务图标 | `account-error.svg` | `AccountErrorCustom` |
   | `illus` | 插画 | `logo.svg` | `LogoIllus` |

   名称由文件名与分类名转换为 PascalCase 得到。不同文件不得生成相同名称；不要手写名称注册表。

2. 检查 SVG 内容。根节点必须为 `<svg>`，并有四个有限数值组成的 `viewBox`，宽、高必须大于零。需要跟随主题变色的部分使用字面量 `fill="currentColor"` 或 `stroke="currentColor"`；品牌色、插画中的固定颜色保留原值。

   一个有效的描边 SVG 示例：

   ```svg
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
     <path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
   </svg>
   ```

   生成器支持路径、基础形状、分组、渐变、裁剪和遮罩。导出时将文字和不支持的形状转换为路径；移除 XML 声明、内联 `style`、脚本、事件属性、动画和外部资源引用。当前不支持 `<text>`、`<polygon>`、`<use>`、`<image>` 或嵌入的位图。内部引用使用 `url(#id)`，并确保引用的 ID 存在；生成器会为 Web symbol 内的 ID 添加图标名称前缀。

3. 在仓库根目录生成资源和类型：

   ```sh
   yarn icon:build
   ```

   例如，新增 `packages/components/svg/outline/example-action.svg` 后，可使用 `ExampleActionOutline`。

4. 在页面中使用生成的名称：

   ```tsx
   import { Icon } from '@onekeyhq/components/src/primitives/Icon';

   <Icon name="ExampleActionOutline" size="$6" color="$icon" />;
   ```

   有独立语义的图标可加 `accessibilityLabel`；未设置标签的图标按装饰性内容处理。`color` 只替换 SVG 中的 `currentColor`，不会覆盖固定颜色。原生 adapter 支持将 `white` 等命名颜色转换为 SDK 接受的 RGBA；优先使用主题 token。

5. 校验并预览：

   ```sh
   yarn icon:check
   yarn icon:test
   yarn app:playground
   ```

   在 Storybook 的 `Primitives/Icon` 中选择新增名称，检查尺寸、浅色/深色主题与颜色。方向图标还应检查 RTL：名称中含 `Left` / `Right` 且存在对应图标时，`Icon` 会自动选择另一方向。

6. 提交新增 SVG、自动更新的 `packages/components/src/primitives/Icon/Icons.tsx` 和相关业务调用。检查生成日志中的 `diagnostics`，新增图标不应包含缺失的内部引用。

## 脚本入口

以下命令均从仓库根目录运行，使用仓库要求的 Node/Yarn 版本并先安装依赖。

| 命令 | 行为 |
| --- | --- |
| `yarn icon:build` | 从全部 SVG 生成名称注册表、原生资源和 Web symbol/provider；仅写入变化的内容。 |
| `yarn icon:check` | 复用组件包的校验流程：先重新生成，再验证生成结果；会更新过期文件，并非只读检查。 |
| `yarn icon:test` | 运行现有生成器与名称注册表的 Node 回归测试；首次执行前先运行 `yarn icon:build`。 |

底层脚本：

- `packages/components/src/primitives/Icon/script.js`：生成名称注册表，并调用资源生成器。
- `development/onekey-icons/generate-icons.mjs`：校验源文件并生成平台资源；原生构建复用其 `--native-only` / `--ios-bundle` 参数。
- `development/onekey-icons/build.js`：Webpack/Rspack 插件，在编译前生成资源并跟踪源文件变化。

CI 会重新生成资源、执行图标测试，并检查已提交的 `Icons.tsx` 是否与源文件一致。若 CI 提示名称过期，运行 `yarn icon:build`，检查并提交注册表变化。

## 平台资源与更新

| 平台 | 资源位置与生成时机 |
| --- | --- |
| iOS | Xcode 构建阶段生成并打包 `OneKeyIcons.bundle/{manifest.json,<Name>.svg}`。 |
| Android | `prepareOneKeyIconAssets` 生成 `assets/icons/{manifest.json,<Name>.svg}`，供 assets merge 和 release lint 使用。 |
| Web / Desktop / Extension UI | 构建插件生成 Web symbol/provider，经 `#onekey-icon-assets` 接入 SDK，由打包器输出静态资源。 |

`development/generated/onekey-icons/` 中的 `native/icons/`、`web/assets/` 和 `web/assetUrls.ts` 都是忽略提交的构建产物，不是需要维护的第二份 SVG 源文件。

iOS/Android 新增或修改 SVG 后，需要重新构建并安装原生 App；仅重载 Metro 或更新 JS/OTA 不会更新安装包内的 SVG。开发时通过 `yarn app:ios` / `yarn app:android` 使用 Mobile DevSession，并确认所用原生 shell 已包含新资源。Web 开发编译会跟踪 SVG 变化；Storybook 在启动时生成资源，修改 SVG 后可重启预览。

原生代码不要 `import` / `require('@onekeyhq/components/svg/...')`，Metro 会拒绝直接导入。使用 `Icon` 的名称；NativeList 的 `iconName`、BottomTabs 的图标名称也复用同一套资源，无需向 Metro module-id registry 添加 SVG。不要复制出逐图标 TSX 组件或把生成产物提交进 Git。

## 常见问题

- **类型中找不到新名称**：确认分类、文件扩展名和命名冲突，重新运行 `yarn icon:build`，检查 `Icons.tsx`。
- **原生显示旧图或空白**：确认生成名称正确、原生 App 已重新构建安装，并检查 SVG 是否通过生成器校验；JS 热更新不能补充 native bundle 中缺少的资源。
- **设置颜色后仍是原色**：检查对应 `fill` / `stroke` 是否使用 `currentColor`；固定颜色会保留。
- **导出文件被拒绝**：根据生成器错误清理不支持的节点、属性或外部引用，保持几何与绘制语义；不要绕过校验。
