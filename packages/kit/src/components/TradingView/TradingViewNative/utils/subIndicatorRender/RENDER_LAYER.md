# TradingView Native 副图渲染桥设计

本文描述 13 个副图指标从 Native Controller 到 Native Skia、Web Canvas 绘制之间的分层。算法和平台绘制通过可序列化的 `RenderPane` 与公共 Scene 命令隔离。

## 1. 数据流

```text
Native Controller active IDs
          │
          ▼
InstanceConfig[] ──────────────── 用户保存的 inputs / styles / visibility
          │
          ▼
ResolvedInstance[]              definition defaults + instance overrides
          │
          ├───────────────┐
          ▼               │
Calculation snapshot      │       K 线或 inputs/source 变化时重算
          │               │
          └──────┬────────┘
                 ▼
             RenderPane           可序列化的 plot/band/fill/palette/scale
                 │
                 ├── ValueRange   当前可见区间的自动缩放
                 ▼
       Shared pane scene          布局、坐标、clip、palette、z-order
                 │
        ┌────────┴────────┐
        ▼                 ▼
  Native Skia adapter   Web Canvas adapter
```

该结构参考 TradingView 的 `metainfo → properties → calculation → pane view → renderer`，但只保留 Native 图表需要的稳定契约。

## 2. 模块职责

| 模块                                              | 职责                                                                     | 不应负责                       |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `indicatorCatalog.ts`                             | 维护主图 4 项、副图 13 项及 placement，供 Controller 和算法共同使用      | 算法、样式、UI 状态            |
| `definitions.ts`                                  | 维护不可变的输入 schema、plot、palette、band、fill、格式和默认样式       | 用户实例状态、K 线数据         |
| `settings.ts`                                     | 将 definition 默认值和实例 override 合并为安全、独立的 resolved settings | 指标计算、绘制                 |
| `controllerAdapter.ts`                            | 将 Controller 的 active ID 和设置映射成有序实例配置                      | 保存 React 状态、计算          |
| `calculators.ts`                                  | 根据 resolved inputs 调用 13 个纯算法，产出 plot 值和 palette index      | 颜色解析、坐标、绘制           |
| `calculationCache.ts`                             | 按实例、K 线引用和 resolved inputs 缓存 calculation；样式变化直接复用    | 缓存 RenderPane 或平台绘图对象 |
| `model.ts`                                        | 将 calculation 和 resolved settings 合并成 `RenderPane`                  | 重新计算指标、屏幕坐标         |
| `pipeline.ts`                                     | 为简单调用方串联 resolve、calculate 和 build，并保留三层 snapshot        | 在样式变化时强制重算           |
| `range.ts`                                        | 根据可见 plot、fill 依赖、band、baseline 和可见数据计算值域              | 修改 pane 或绘制               |
| `layout.ts`                                       | 分配主图下方的 pane 区域，并提供 pane hit-test                           | 算法、平台绘图对象             |
| `coordinates.ts`                                  | 副图值与 Y 坐标互转、格式化及右轴宽度候选                                | Canvas、Skia API               |
| `scene.ts`                                        | 将 pane 转成共享的 line/rect/polygon/text 命令和动态 paint registry      | 执行平台绘图 API               |
| `chartScene.ts`                                   | 合并主图、副图、全局 viewport、十字线和唯一时间轴                        | 计算指标                       |
| `chartCanvasRenderer.ts` / `chartSkiaRenderer.ts` | 执行公共 Scene 命令                                                      | 读取 definition 或调用算法     |

## 3. Definition 与 Instance

Definition 是全局不可变元数据。所有可持久化引用都使用稳定 ID：

- indicator：`RSI`
- input：`period`
- plot：`rsi`
- band：`upper`
- fill：`background`
- palette：`histogram`

标题只是展示信息，不能作为业务主键。

每个实例使用以下形状：

```ts
{
  id: 'rsi-1',
  indicator: 'RSI',
  isVisible: true,
  settings: {
    inputs: { period: 14 },
    plots: { rsi: { color: '#7E57C2' } },
  },
}
```

即使 Controller 当前每种指标最多一个实例，也保留独立 `id`。未来增加多个 RSI、面板排序或复制指标时，不需要改变算法和渲染契约。

`settings.ts` 只接受 definition 中存在的 ID，并执行以下归一化：

- 数字必须有限，按 schema 取整并限制范围。
- boolean、source 和 select 必须符合 schema。
- 颜色、透明度、线宽、plot 类型、scale 必须合法。
- palette 的槽位数量和顺序由 definition 固定；无效或缺失颜色按原槽位回退，不能压缩数组并改变颜色索引语义。
- 未知 ID 被忽略。
- resolved 对象不与 definition 默认对象共享可变引用。

## 4. Calculation 与 RenderPane

Calculation snapshot 只描述算法结果：

```ts
{
  indicator: 'MACD',
  inputValues: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  plots: {
    histogram: [...],
    macd: [...],
    signal: [...],
  },
  paletteIndexes: {
    histogram: [...],
  },
  pointCount: 200,
}
```

颜色索引和 palette 颜色表分离。MACD/VOL 的方向或动量变化会生成整数索引；用户换色时只替换 resolved palette 并重建 `RenderPane`，无需重算指标。

Calculator boundary 会把 plot 和 palette index 统一归一化为与 point count 对齐的 canonical 数组。`RenderPane` 直接引用这些数组，样式变化只重建轻量元数据；只有不符合长度契约的外部 calculation 才在 model 层走兼容归一化，避免 main JS heap 长期保存重复历史数组。

`RenderPane` 是绘制层的唯一指标输入模型，包含：

- 已归一化且定长的 plot values。
- 每条 plot 的运行时样式和可选 palette。
- band、fill 及其引用关系。
- format、scale 和实例可见性。
- 由 instance ID 与对象 ID 组成的稳定 key。

它不包含 K 线对象、算法函数、React state、worklet shared value 或绘图对象，因此可以安全缓存、序列化和传入不同平台的绘制适配器。

## 5. 设置变更与失效范围

| 变更                    | Calculation        | Autoscale    | Paint         |
| ----------------------- | ------------------ | ------------ | ------------- |
| input 周期、source      | 重算               | 重算         | 重建          |
| plot visible            | 复用               | 重算         | 重建          |
| plot type、baseline     | 复用               | 重算         | 重建 renderer |
| plot 颜色、线宽、透明度 | 复用               | 复用         | 重建          |
| palette 颜色            | 复用 palette index | 复用         | 重建          |
| band value、visible     | 复用               | 重算         | 重建          |
| fill visible            | 复用               | 重算依赖端点 | 重建          |
| instance visible        | 复用               | 移除或重算   | 隐藏或重建    |

Container 已分别维护 resolved instance、calculation cache 和 render pane 三层依赖，不能把完整 settings 对象作为“必须重算算法”的单一依赖。隐藏实例会释放 calculation cache，实例设置仍由 Controller 状态保留。

## 6. Autoscale 规则

13 个副图都使用自动缩放。RSI、StochRSI、MFI 和 WR 也不固定为理论区间；可见 band 会自然把参考区间纳入值域。

`range.ts` 使用半开索引区间 `[startIndex, endIndex)`，并纳入：

1. 可见 plot 的有限值。
2. 可见 fill 所依赖的 plot 或 band，即使端点自身隐藏。
3. 可见 band 的值。
4. Columns/Histogram 的 baseline。
5. scale 明确声明的 include values。
6. 上下 padding。

`null`、`NaN` 和无穷值不进入值域。隐藏 pane 或完全没有有效值时返回 `null`。

## 7. Controller 关联

完整 17 项必须由统一 catalog 派生，不能从 WebView 的 `nativeChartControlsConfig.indicators` 推断。后者只是当前激活的子集。

Controller 仍可使用 `Set<string>` 处理按钮 active 状态，但算法入口必须转换成有序的 `InstanceConfig[]`：

```text
Set('RSI', 'MACD')
  → [{ id: 'MACD', indicator: 'MACD' }, { id: 'RSI', indicator: 'RSI' }]
```

顺序以 catalog 为准，未知 ID 被忽略。未来设置数据按 indicator 或 instance ID 注入 adapter，不需要让 Controller 依赖 render model。

## 8. 绘制层实现与约束

绘制适配器只消费 `RenderPane` 和图表已有的 viewport/坐标转换能力，按 `zOrder` 处理：

1. fill
2. band
3. columns/histogram/line plot

公共 Scene 负责可见区裁剪、数值到像素的转换、路径生成和 pane hit-test；平台适配器只执行命令，不能读取 definition registry，也不能调用指标算法。

- 主图和所有副图共用一个 X viewport、一个绘制 surface 和一个底部时间轴。
- 每个副图默认高 56px；空间不足时等比压缩，并保证主图区域不会成为负数。
- 每个 pane 独立 autoscale，竖向十字线跨越所有 pane，横向数值按命中的 pane 格式化。
- 用户颜色、透明度、线宽、线型和 palette 通过稳定 paint ID 注册。Native 侧按样式签名缓存 `SkPaint`，不会按柱创建绘图对象。
- Native 同一根 K 线的实时更新只向 UI runtime 传最后一个 plot 值和 palette index，并原位更新 UI-owned 尾部 buffer；历史、结构或新 K 线变化才全量替换 pane。
- `VOL` 只以副图形式显示。主图内嵌成交量保持关闭，未选择 `VOL` 时不绘制成交量区域。
- line 的空值会断开路径；columns/histogram 从各自 baseline 绘制；band-band 和 plot-plot fill 都服从引用关系及 `zOrder`。

## 9. 新增指标检查清单

1. 在统一 catalog 中添加稳定 indicator ID 和 placement。
2. 新增独立算法文件及定向测试。
3. 增加 definition 的 inputs、plots、palette、bands、fills 和 scale。
4. 在 calculator adapter 中映射所有输出 ID。
5. 验证所有输出长度等于输入点数，且不包含非有限值。
6. 验证 palette index 范围和 fill 引用都有效。
7. 增加 model、range 和 Controller adapter 测试。
