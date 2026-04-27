# Onboarding GetStarted — Hero Atmosphere

**Date**: 2026-04-27
**Owner**: Franco
**Target**: launch 前 3 天内（约 2026-04-30 前）实现并 QA 完成
**Scope**: Onboarding v2 GetStarted 首屏 hero 区域氛围层增强

## 1. 背景

Onboarding v2 已合并主分支，进入 QA + 同事反馈阶段。peer 评审反馈首屏"比较干"。

诊断（详见对话过程）：
1. 视觉锚点缺失（屏幕只有 logo + 文字 + 按钮）
2. 情感温度低（工具感强）
3. 动效孤立（词条轮换是孤岛）
4. 内容密度低（peer 反馈中权重低，**不在本 spec 范围**）
5. 轮换词与视觉脱钩（"feature carousel"只在文字层完成，视觉层未跟进）

本 spec 解决 #1、#2、#3、#5。#4 留待 post-launch 路径 ②（产品场景 carousel）处理。

## 2. 设计概念

在 hero 区加入一层 brand-tinted radial soft glow。glow 的色调随当前轮换词同步偏移，使「词条切换」从纯文字事件升级为环境响应事件。

## 3. 视觉规范

### 3.1 几何

- 单层 radial soft glow（不是多层 mesh）
- 尺寸：约 120% hero 宽 × 80% hero 高
- 位置：position absolute，置于 hero 容器内、logo 与文字之下（z-index 居底）
- 中心：x 居中；y 在 logo 与 hero 文字之间偏上
- 边缘：长尾衰减到完全透明，不能有可见硬边

### 3.2 颜色映射

| Word | Token | 心智 |
|---|---|---|
| trading | `$blue9` / `$blueDark9` | 行情 / market |
| earning | `$amber9` / `$amberDark9` | yield，暖金倾向 |
| swapping | `$purple9` / `$purpleDark9` | DEX / 路由 |
| buying | `$brand9` / `$brandDark9` | OneKey 品牌色（实际为绿 #32B826） |

色彩用 OneKey 设计系统的 primitive scale token，theme 自动跟随 light/dark。Note：buying 用 `$brand9` 是 Franco 决策；OneKey 品牌色实为绿，不是橙。Fallback token 同为 `$brand9`，符合"out-of-range 退回品牌色"语义。

### 3.3 饱和度与对比度

- Light mode peak alpha ≤ 30%
- Dark mode peak alpha ≤ 20%
- 任何一档不得让 hero 文字 + 周围 body text 对比度低于 WCAG AA

## 4. 动效规范

### 4.1 颜色 crossfade

- 触发：`wordIndex` 变化时
- 时长：与 `HERO_CHAR_ANIMATION_MS`（550ms）一致，与字符进出节拍对齐
- 缓动：timing（与现有词条动效 type 一致）

### 4.2 Breathe（默认开）

- glow 整体 opacity 在 [0.85x, 1.0x] 之间慢呼吸
- 周期：8s linear loop
- 与颜色 crossfade 完全独立运行

### 4.3 不做

- 不做位置动画
- 不做旋转
- 不做缩放
- glow 不响应 scroll / touch / hover

## 5. 架构

### 5.1 新增组件

`<HeroAtmosphere wordIndex={number} />`

- 受控组件，接收当前 word index
- 内部维护 4 色映射 + crossfade + breathe
- Web 用 CSS radial-gradient + transition；Native 用 OneKey 现有 gradient 组件 + Moti

### 5.2 `HeroRotatingWord` 改动（最小化）

- 新增 prop: `onWordChange?: (index: number) => void`
- 在内部 `setWordIndex` 调用处同步 fire 回调
- **不动**现有 timer / exit / 字符动画逻辑

### 5.3 `GetStarted` 改动

- 新增 state: `currentWordIndex`（初始 0）
- 接收 `HeroRotatingWord.onWordChange`
- 传入 `<HeroAtmosphere wordIndex={currentWordIndex} />`
- atmosphere 与 hero 文字共享同一 relative 父容器，确保层叠正确

## 6. Theme 适配

- 颜色 token 自动跟随 light / dark
- alpha 上限按 mode 区分（light 30%, dark 20%）
- 不写双套硬编码

## 7. 性能与平台

### Web
- CSS radial-gradient + transition 实现 crossfade
- breathe 用 CSS animation 或 Moti
- 无显式重渲染负担

### Native（iOS / Android）
- 优先复用 OneKey 已有的 gradient 组件（implementation 阶段 grep 确认位置）
- 若无现成 radial 方案，用 blurred View（半透明 bg + 大 borderRadius + blur）模拟
- breathe 用 Moti `<MotiView>` opacity loop

### 低端 Android
- 单层 + opacity 动画，不上多层 blur / mesh
- 实测如有掉帧，breathe 可在 native 通过 `platformEnv` 标志关闭（implementation 时加 fallback hook）

## 8. 范围控制

### In scope

- 新增 `HeroAtmosphere` 组件
- `HeroRotatingWord.onWordChange` 回调
- `GetStarted` 接入 atmosphere
- Light / dark theme 适配
- iOS / Android / Web / Desktop / Extension 视觉与性能验证

### Out of scope（明确排除）

- 路径 ②（产品场景 carousel）— post-launch
- Feature ladder（信息密度增加）
- 轮换词从 4 扩到 7（Franco 已确认不动）
- `HERO_WORD_DISPLAY_MS` 节奏调整
- 按钮组（顺序 / 样式 / 文案）
- TermsAndPrivacy
- 文案、i18n key
- 路由 / navigation
- OnboardingPage 容器结构
- hero text typography / logo 尺寸

## 9. 验证

- [ ] Light + dark 模式对比度通过 WCAG AA（目测 + 工具）
- [ ] iOS / Android / Web / Desktop / Extension 视觉一致（合理误差内）
- [ ] 低端 Android（最低支持档）实测 60fps 稳定
- [ ] 词条切换 crossfade 与字符动画对齐（视觉无错拍）
- [ ] breathe 周期不引起视觉疲劳（自评 + Franco review）
- [ ] OnboardingPage 整体动效（已有的 `enterStyle: { opacity: 0, scale: 0.9 }` web entry）与 atmosphere 不冲突

## 10. 实现期 Open Questions

已 grep 落地（writing-plans 阶段完成）：

1. ~~Token 名~~ → 已确认：`$blue9` / `$amber9` / `$purple9` / `$brand9`
2. ~~Gradient 组件位置~~ → 已确认：直接用 `react-native-svg` 的 `RadialGradient`（参考同目录 `SecurityKeyIcon.tsx` 的 `LinearGradient` 用法）；不依赖 `@onekeyhq/components/LinearGradient`（它是 linear only）
3. **Reduce-motion hook**：本次 launch 范围未实现，记入 implementation plan §10 跟进项

## 11. 关联文件

- 主改：`packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx`
- 新增：`packages/kit/src/views/Onboardingv2/pages/components/HeroAtmosphere.tsx`（最终位置 implementation 时确认）

## 12. 风险与回滚

### 风险

- 颜色调不到位，被 peer 二次反馈"还是不够" → 回到 conversation log，已记录 4 词色彩倾向，回滚到 base brand 单色（Scheme 2A）即可
- 低端 Android 性能问题（概率低，单层无 mesh）

### 回滚路径

- `HeroAtmosphere` 是独立组件，可整体注释或通过单一 flag 隐藏
- `HeroRotatingWord.onWordChange` 是 optional prop，不传也工作
- `currentWordIndex` state 不影响其他逻辑，可整体删除

任何回滚都不需要动 i18n / layout / 文案 / 路由。
