# SVG 图标使用与新增

`packages/components/svg/` 是 App 静态可复用图标的唯一源文件目录。业务代码通过图标名称使用资源；生成脚本负责名称注册、Web SVG symbol 和原生 SVG 资源打包。运行时绘制的图表、二维码等使用下面的选型规则。

## 选型：Icon 注册表还是 react-native-svg

**固定的图形资源优先使用 Icon 注册表；需要在运行时控制内部图形节点时使用 `react-native-svg`。** 判断依据是图形如何变化，不是图标大小、是否彩色或是否有渐变。

| 场景 | 选择 | 原因 |
| --- | --- | --- |
| 搜索、返回、状态图标、品牌 Logo、固定插画 | Icon 注册表：`<Icon name="..." />` | 图形预先确定，只需按名称复用及调整尺寸、主题颜色。 |
| 多色、渐变、裁剪、遮罩的静态图形 | Icon 注册表，前提是通过生成器校验 | 这些特性本身不要求 JSX 绘制；固定颜色可保留，主题色部分使用 `currentColor`。 |
| 根据状态切换已知图标，例如成功 / 失败或选中 / 未选中 | Icon 注册表，切换 `name` / `color` | 状态变化不等于图形几何变化，不需要重新实现 SVG。 |
| 整个图标的旋转、缩放、位移或透明度动画 | 优先 Icon 注册表配合外层布局 / 动画容器 | 图标内部路径不变，无需逐节点绘制。 |
| 二维码、数据图表、进度环、仪表盘指针、根据布局尺寸计算的连线 | `react-native-svg` | 路径、坐标、弧长、节点数量或内部变换由运行时数据决定。 |
| 逐路径动画、内部节点交互、分别控制多个区域的动态颜色 | `react-native-svg`，并验证目标平台能力 | 需要访问具体的 `Path` / `Circle` / `G` 等节点，注册表的名称与统一颜色接口不覆盖这些行为。 |
| 必须与二维码等内容在同一个 `<Svg>` 内组合绘制或参与截图导出 | 复用已有绘图组件，必要时使用 `react-native-svg` | `<Icon>` 是独立资源视图，不能当成同一 SVG 场景里的路径节点，也不保证原生首帧同步加载完成。 |
| NativeList、原生 BottomTabs 的图标 | Icon 注册表名称 | 这些原生接口消费已打包的命名资源，不接收 `react-native-svg` 的 React 节点。 |

仓库中的实际例子：

- [Icon](../../packages/components/src/primitives/Icon/index.tsx)：通过 `name` 选择资源，`size` 和 `color` 控制展示；适合列表、按钮和导航等常规图标。
- [SwapOrderProgress](../../packages/kit/src/views/Swap/components/SwapOrderProgress.tsx)：成功 / 失败状态使用注册表图标；按实际布局宽度绘制的连接线使用 `react-native-svg`。同一组件可以同时使用两种方式。
- [CircleProgress](../../packages/kit/src/views/Borrow/components/CircleProgress.tsx)：根据百分比计算 `strokeDashoffset`，属于动态绘图，使用 `react-native-svg`。
- [PerpsMarginRatioGauge](../../packages/kit/src/views/Perp/components/TradingPanel/components/PerpsMarginRatioGauge.tsx)：根据保证金比例计算指针角度并改变内部 `<G>` 的变换，使用 `react-native-svg`。
- [QRCode](../../packages/components/src/content/QRCode/index.tsx)：根据内容生成二维码路径，并在同一 SVG 内组合图形。二维码品牌标记和截图场景优先复用已有 `brandMark` / `onRenderReady` 能力，不要用异步加载的 `<Icon>` 替代内部路径后假定首帧已就绪。

使用边界：

- 使用 `react-native-svg` 不代表可以直接导入 `packages/components/svg/**`。该目录仍只走注册表与资源生成流程；动态绘图的 JSX 和计算逻辑放在对应业务组件中。
- 不要为普通静态图标复制一份逐图标 TSX，也不要把每个进度值、业务数据或任意 SVG 字符串生成一个注册表条目。注册表资源在构建时确定，新增原生资源需要重新构建安装。
- 如果静态 SVG 因节点不受生成器支持而失败，先尝试保持视觉一致的路径转换。确实需要生成器无法表达、且 `react-native-svg` 在目标平台支持的绘图能力时，再封装专用组件；不要绕过生成器的安全校验。
- 自定义 SVG 中的渐变、裁剪和遮罩 ID 要按组件实例保持唯一，避免同屏多个实例的引用冲突；尺寸、主题、RTL、交互和截图就绪时机由绘图组件自行处理。

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
