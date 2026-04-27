# Onboarding Hero Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Onboarding GetStarted 首屏 hero 区域加入 brand-tinted radial soft glow，色调随轮换词同步偏移，让"feature carousel"从只在文字层升级到环境层。

**Architecture:** 新增 `HeroAtmosphere` 受控组件，接收当前 `wordIndex`；用 `react-native-svg` 的 `RadialGradient` 跨平台渲染 radial glow；用 `useTheme()` 解析 token 色值；通过两层 SVG 叠加做颜色 crossfade；用 Moti `MotiView` 做 breathe loop。`HeroRotatingWord` 增加 `onWordChange` 回调把内部 index 暴露给 parent；parent `GetStarted` 持 `currentWordIndex` state 并下传给 atmosphere。

**Tech Stack:** React + React Native + Tamagui + Moti + react-native-svg + TypeScript

---

## Spec 关联

设计 spec：`docs/plans/2026-04-27-onboarding-hero-atmosphere.md`

## File Structure

| 路径 | 类型 | 责任 |
|---|---|---|
| `packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx` | 修改 | 在 hero YStack 内加入 `HeroAtmosphere`；持 `currentWordIndex` state；给 `HeroRotatingWord` 传 `onWordChange`；移除内部 `HeroRotatingWord` 的内部 setExitingIndex 不动 |
| `packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx` | 新建 | 受控 atmosphere 组件，渲染 radial glow + crossfade + breathe |

**为什么把 HeroAtmosphere 放在 `Onboardingv2/components/`**：与同目录现有的 `SecurityKeyIcon.tsx`（也是基于 `react-native-svg` + `useTheme` 的视觉组件）保持一致风格。

## Token 决策（已定）

buying word → **`$brand9`**（OneKey 真正的品牌色，实际为绿 #32B826）。Franco 2026-04-27 确认。

注意：同时把 Task 1 的 `FALLBACK_TOKEN` 也设为 `'brand9'`，本身就是品牌色保底，符合"out-of-range 退回品牌"的语义。

## TDD 适配说明

本仓在 `packages/kit/src/views/` 下没有 view-level 单元测试惯例（仅 `finalizeWalletSetupKeylessUtils.test.ts` 这类 utility 测试）。本 plan 遵循仓内现状：

- **可纯函数化的逻辑**（`getAtmosphereToken` index → token 映射）走 TDD
- **视觉与动效**改为「跑起来人眼验证 + 跨平台手动 QA」，每任务结束在 commit 前必须本地启动至少 web + 一个 native 平台目检

---

## Task 1: 抽出 atmosphere token 映射工具（TDD）

**Files:**
- Create: `packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.ts`
- Create: `packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts`

- [ ] **Step 1: 写失败测试**

写入 `packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts`：

```ts
import {
  getAtmosphereToken,
  HERO_ATMOSPHERE_TOKEN_BY_INDEX,
} from './heroAtmosphereTokens';

describe('heroAtmosphereTokens', () => {
  it('maps index 0 (trading) to blue9', () => {
    expect(getAtmosphereToken(0)).toBe('blue9');
  });

  it('maps index 1 (earning) to amber9', () => {
    expect(getAtmosphereToken(1)).toBe('amber9');
  });

  it('maps index 2 (swapping) to purple9', () => {
    expect(getAtmosphereToken(2)).toBe('purple9');
  });

  it('maps index 3 (buying) to brand9', () => {
    expect(getAtmosphereToken(3)).toBe('brand9');
  });

  it('falls back to brand9 for out-of-range index', () => {
    expect(getAtmosphereToken(99)).toBe('brand9');
    expect(getAtmosphereToken(-1)).toBe('brand9');
  });

  it('exposes HERO_ATMOSPHERE_TOKEN_BY_INDEX with 4 entries', () => {
    expect(Object.keys(HERO_ATMOSPHERE_TOKEN_BY_INDEX)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写最小实现**

写入 `packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.ts`：

```ts
// Maps HeroRotatingWord index to a tamagui color scale token name.
// Index order matches HERO_ACTIONS in GetStarted.tsx:
//   0: trading, 1: earning, 2: swapping, 3: buying
export const HERO_ATMOSPHERE_TOKEN_BY_INDEX: Record<number, string> = {
  0: 'blue9',
  1: 'amber9',
  2: 'purple9',
  3: 'brand9',
};

const FALLBACK_TOKEN = 'brand9';

export function getAtmosphereToken(index: number): string {
  return HERO_ATMOSPHERE_TOKEN_BY_INDEX[index] ?? FALLBACK_TOKEN;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts`
Expected: PASS（6/6）

- [ ] **Step 5: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.ts packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts
git commit -m "feat(onboarding): add hero atmosphere token mapping utility"
```

---

## Task 2: 给 HeroRotatingWord 加 onWordChange 回调

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx`（HeroRotatingWord 函数定义，约 166-235 行）

- [ ] **Step 1: 修改 HeroRotatingWord props 类型与回调触发**

在 `GetStarted.tsx` 中，定位到 `function HeroRotatingWord({ words }: { words: string[] }) {`（约 166 行），改为：

```tsx
function HeroRotatingWord({
  words,
  onWordChange,
}: {
  words: string[];
  onWordChange?: (index: number) => void;
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordsLength = words.length;

  useEffect(() => {
    onWordChange?.(wordIndex);
  }, [wordIndex, onWordChange]);

  useEffect(() => {
    if (wordsLength === 0) {
      return;
    }
    const intervalId = setInterval(() => {
      setWordIndex((current) => {
        setExitingIndex(current);
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
        exitTimerRef.current = setTimeout(() => {
          setExitingIndex(null);
        }, HERO_EXIT_CLEANUP_MS);
        return (current + 1) % wordsLength;
      });
    }, HERO_WORD_DISPLAY_MS);
    return () => {
      clearInterval(intervalId);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [wordsLength]);

  const currentWord = words[wordIndex] ?? '';
  // ... rest unchanged
```

注意：只新增了 props 解构、props 类型、和 `useEffect(() => { onWordChange?.(wordIndex); }, ...)`。其余 effect、return JSX 都不变。

- [ ] **Step 2: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误（onWordChange 是 optional，未使用调用方不会报错）

- [ ] **Step 3: 启 web 验证 onboarding 仍正常工作**

Run: `yarn app:web`

打开 onboarding 页面，确认：
- 词条仍按原节奏轮换
- 字符进出动画正常
- 无 console error

- [ ] **Step 4: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx
git commit -m "feat(onboarding): expose word index via onWordChange callback"
```

---

## Task 3: 在 GetStarted 持 currentWordIndex 并下传

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx`（GetStarted 函数体 + JSX）

- [ ] **Step 1: 在 GetStarted 内加 state**

定位到 `function GetStarted() {`（约 369 行），在 `const { gtMd } = useMedia();` 之后加：

```tsx
const [currentWordIndex, setCurrentWordIndex] = useState(0);
```

记得 `useState` 已经从 `react` import（文件顶部第 1 行就有 `import { useEffect, useMemo, useRef, useState } from 'react';`，无需新增）。

- [ ] **Step 2: 给两处 HeroRotatingWord 调用都加 onWordChange**

定位到 `<HeroSentenceNative>` 内（约 455 行）的 `rotating={<HeroRotatingWord words={heroActionWords} />}`，改为：

```tsx
rotating={
  <HeroRotatingWord
    words={heroActionWords}
    onWordChange={setCurrentWordIndex}
  />
}
```

同样定位到非 native 分支（约 464 行）的 `<HeroRotatingWord words={heroActionWords} />`，改为：

```tsx
<HeroRotatingWord
  words={heroActionWords}
  onWordChange={setCurrentWordIndex}
/>
```

- [ ] **Step 3: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误

- [ ] **Step 4: Web 验证 currentWordIndex 跟随轮换**

Run: `yarn app:web`

临时在 GetStarted 函数体内加：
```tsx
console.log('[hero] currentWordIndex', currentWordIndex);
```
打开 onboarding 页，看 console 每 2.6 秒打印一次 0/1/2/3 循环。验证后**删除 console.log**。

- [ ] **Step 5: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx
git commit -m "feat(onboarding): lift current word index to GetStarted"
```

---

## Task 4: HeroAtmosphere 组件骨架（单层 SVG，无动画）

**Files:**
- Create: `packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx`

- [ ] **Step 1: 写最小实现**

写入 `packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx`：

```tsx
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { YStack, useTheme, useThemeName } from '@onekeyhq/components';

import { getAtmosphereToken } from './heroAtmosphereTokens';

const PEAK_ALPHA_LIGHT = 0.3;
const PEAK_ALPHA_DARK = 0.2;

export function HeroAtmosphere({ wordIndex }: { wordIndex: number }) {
  const theme = useTheme();
  const themeName = useThemeName();
  const peakAlpha = themeName === 'dark' ? PEAK_ALPHA_DARK : PEAK_ALPHA_LIGHT;

  const token = getAtmosphereToken(wordIndex);
  const color = theme[token as keyof typeof theme]?.val ?? '#000000';
  const gradientId = `hero-atmosphere-${wordIndex}`;

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="40%"
            rx="60%"
            ry="50%"
            fx="50%"
            fy="40%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </YStack>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误

- [ ] **Step 3: 临时挂载到 GetStarted 验证渲染**

在 `GetStarted.tsx` 的 hero `<YStack ...>`（约 442 行）内最顶部插入：

```tsx
<HeroAtmosphere wordIndex={currentWordIndex} />
```

并在文件顶部 imports 区添加：

```tsx
import { HeroAtmosphere } from '../components/HeroAtmosphere';
```

同时给 hero `<YStack>` 加 `position="relative"`，确保 absolute 子元素被 contain（如果原 props 已有 layout 相关，与之合并）：

```tsx
<YStack
  position="relative"
  $md={{ flex: 1, px: '$5', pt: '$8' }}
  gap="$8"
>
```

- [ ] **Step 4: Web 目检**

Run: `yarn app:web`

打开 onboarding 首屏，验证：
- Hero 区背后能看到 radial 软光（颜色随当前词条变化时手动刷新观察 4 种色都对）
- Logo 和 hero 文字仍清晰可见，不被光遮挡
- 切换 light / dark theme，光的强度差异符合 30%/20% peak alpha

如发现颜色不显，确认 `theme[token].val` 是否能正确解析（参考 `SecurityKeyIcon.tsx` 同款用法）。

- [ ] **Step 5: iOS 目检**

Run: `yarn app:ios`

同上目检。如 iOS 上 SVG 100% 宽高无效，改为父容器 onLayout 捕获尺寸后传递：

```tsx
const [size, setSize] = useState({ width: 0, height: 0 });
// ... onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
// 然后 <Svg width={size.width} height={size.height} ...>
```

- [ ] **Step 6: Android 目检**

Run: `yarn app:android`

同上目检；额外注意低端 Android 渲染是否流畅（应该完全无负担因为 SVG 是静态的）。

- [ ] **Step 7: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx
git commit -m "feat(onboarding): add HeroAtmosphere component with static radial glow"
```

---

## Task 5: 在 HeroAtmosphere 加颜色 crossfade（双层）

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx`

- [ ] **Step 1: 用双层 + Moti opacity 实现 crossfade**

整体替换 `HeroAtmosphere.tsx` 内容为：

```tsx
import { useEffect, useState } from 'react';

import { MotiView } from 'moti';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { YStack, useTheme, useThemeName } from '@onekeyhq/components';

import { getAtmosphereToken } from './heroAtmosphereTokens';

const PEAK_ALPHA_LIGHT = 0.3;
const PEAK_ALPHA_DARK = 0.2;
// Match HERO_CHAR_ANIMATION_MS in GetStarted.tsx so glow fades in sync with
// the hero word's char animation.
const CROSSFADE_DURATION_MS = 550;

function RadialGlow({
  index,
  isCurrent,
  peakAlpha,
}: {
  index: number;
  isCurrent: boolean;
  peakAlpha: number;
}) {
  const theme = useTheme();
  const token = getAtmosphereToken(index);
  const color = theme[token as keyof typeof theme]?.val ?? '#000000';
  const gradientId = `hero-atmosphere-${index}-${isCurrent ? 'cur' : 'prev'}`;

  return (
    <MotiView
      from={{ opacity: isCurrent ? 0 : 1 }}
      animate={{ opacity: isCurrent ? 1 : 0 }}
      transition={
        {
          type: 'timing',
          duration: CROSSFADE_DURATION_MS,
        } as any
      }
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="40%"
            rx="60%"
            ry="50%"
            fx="50%"
            fy="40%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </MotiView>
  );
}

export function HeroAtmosphere({ wordIndex }: { wordIndex: number }) {
  const themeName = useThemeName();
  const peakAlpha = themeName === 'dark' ? PEAK_ALPHA_DARK : PEAK_ALPHA_LIGHT;

  const [currentIndex, setCurrentIndex] = useState(wordIndex);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  useEffect(() => {
    if (wordIndex === currentIndex) {
      return;
    }
    setPreviousIndex(currentIndex);
    setCurrentIndex(wordIndex);
    const timer = setTimeout(() => {
      setPreviousIndex(null);
    }, CROSSFADE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [wordIndex, currentIndex]);

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
    >
      {previousIndex !== null ? (
        <RadialGlow
          key={`prev-${previousIndex}`}
          index={previousIndex}
          isCurrent={false}
          peakAlpha={peakAlpha}
        />
      ) : null}
      <RadialGlow
        key={`curr-${currentIndex}`}
        index={currentIndex}
        isCurrent
        peakAlpha={peakAlpha}
      />
    </YStack>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误

- [ ] **Step 3: Web 目检 crossfade**

Run: `yarn app:web`

打开 onboarding，盯住背景看至少一个完整轮换周期（约 10s）。验证：
- 词条切换时背景颜色"溶接"，不是硬切
- 4 种颜色（blue → amber → purple → brand 绿）依次过渡
- 没有"闪烁"（旧颜色淡出 + 新颜色淡入应该平滑）

- [ ] **Step 4: iOS 目检 crossfade**

Run: `yarn app:ios`

同上目检。Moti 在 iOS 的 timing 转场应该完全平滑。

- [ ] **Step 5: Android 目检 crossfade（含低端机）**

Run: `yarn app:android`

同上；额外在低端 Android 上观察是否有掉帧。如有，进 Step 6。

- [ ] **Step 6（仅在 Step 5 发现问题时）：低端 Android 性能 fallback**

如果低端 Android 实测掉帧，原因通常是同时存在两层 SVG + opacity 动画。临时修复方案：在 native + lowEndAndroid 时 disable crossfade，直接 snap 颜色。

不在本次实施，记入 §10 跟进。如果 Step 5 通过则跳过 Step 6。

- [ ] **Step 7: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx
git commit -m "feat(onboarding): add color crossfade between hero atmosphere words"
```

---

## Task 6: 加 breathe loop

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx`

- [ ] **Step 1: 在 HeroAtmosphere 外层包 MotiView 做 opacity loop**

在 `HeroAtmosphere.tsx` 文件顶部常量区加：

```tsx
const BREATHE_DURATION_MS = 8000;
const BREATHE_OPACITY_LOW = 0.85;
const BREATHE_OPACITY_HIGH = 1;
```

然后修改 `HeroAtmosphere` 函数 return 部分，把外层 `<YStack>` 改为内嵌一个 `<MotiView>` 做 breathe wrapper：

```tsx
return (
  <YStack
    position="absolute"
    top={0}
    left={0}
    right={0}
    bottom={0}
    pointerEvents="none"
  >
    <MotiView
      from={{ opacity: BREATHE_OPACITY_HIGH }}
      animate={{ opacity: BREATHE_OPACITY_LOW }}
      transition={
        {
          type: 'timing',
          duration: BREATHE_DURATION_MS,
          loop: true,
          repeatReverse: true,
        } as any
      }
      style={{ flex: 1 }}
    >
      {previousIndex !== null ? (
        <RadialGlow
          key={`prev-${previousIndex}`}
          index={previousIndex}
          isCurrent={false}
          peakAlpha={peakAlpha}
        />
      ) : null}
      <RadialGlow
        key={`curr-${currentIndex}`}
        index={currentIndex}
        isCurrent
        peakAlpha={peakAlpha}
      />
    </MotiView>
  </YStack>
);
```

注意：breathe 包在外层（受 4 种 word 颜色共享），不影响 RadialGlow 内层 crossfade。

- [ ] **Step 2: TypeScript check**

Run: `yarn tsc:staged`
Expected: 无错误

- [ ] **Step 3: Web 目检 breathe**

Run: `yarn app:web`

打开 onboarding，停留至少 16 秒（两个 breathe 周期）。验证：
- 整体 glow opacity 在 [85%, 100%] 之间缓慢呼吸
- 不会被察觉为"闪烁"，应该是几乎察觉不到的呼吸
- 与 crossfade 无相位冲突（两者独立运行）

- [ ] **Step 4: iOS 目检 breathe**

Run: `yarn app:ios`

同上目检。

- [ ] **Step 5: Android 目检 breathe**

Run: `yarn app:android`

同上目检 + 低端机性能。

- [ ] **Step 6: Commit**

```bash
git add packages/kit/src/views/Onboardingv2/components/HeroAtmosphere.tsx
git commit -m "feat(onboarding): add breathe opacity loop to hero atmosphere"
```

---

## Task 7: 整理 GetStarted 集成（去 Task 4 临时挂载，确认正式接入）

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx`

- [ ] **Step 1: 检查 imports 与 JSX 集成是否正确**

确认 `GetStarted.tsx`：

1. 文件顶部 imports 已含 `import { HeroAtmosphere } from '../components/HeroAtmosphere';`
2. `function GetStarted()` 内有 `const [currentWordIndex, setCurrentWordIndex] = useState(0);`
3. 两处 `<HeroRotatingWord>` 都有 `onWordChange={setCurrentWordIndex}`
4. Hero `<YStack>` 顶部有 `<HeroAtmosphere wordIndex={currentWordIndex} />`
5. Hero `<YStack>` 含 `position="relative"`

如有缺失补齐；如有 Task 4 期间留下的 `console.log` 一并删除。

- [ ] **Step 2: 完整 lint + tsc**

```bash
yarn lint:staged
yarn tsc:staged
```
Expected: 无错误

- [ ] **Step 3: 跑测试**

```bash
yarn jest packages/kit/src/views/Onboardingv2/components/heroAtmosphereTokens.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit（如有改动）**

```bash
git add packages/kit/src/views/Onboardingv2/pages/GetStarted.tsx
git commit -m "chore(onboarding): finalize HeroAtmosphere integration in GetStarted"
```
（如果 Task 4 之后 GetStarted 已干净，本步骤可跳过）

---

## Task 8: 跨平台手动 QA（不写代码，验证 ship 标准）

**Files:** 无文件改动，只跑应用 + 验证。

- [ ] **Step 1: Web Light**

Run: `yarn app:web`，确保 system 主题为浅色

走完整 onboarding 首屏 30 秒（一轮多+），确认：
- 4 个词的 glow 颜色都正确（blue / amber / purple / brand 绿）
- 文字对比度足够（用浏览器 DevTools Lighthouse 跑一次 Accessibility，分数 ≥ 95）
- Crossfade 平滑、breathe 无察觉、无闪烁

- [ ] **Step 2: Web Dark**

切换浏览器系统主题为深色，重复 Step 1 验证。验证：
- alpha 自动降为 ~20% peak
- 颜色不刺眼，不抢戏

- [ ] **Step 3: iOS Light + Dark**

Run: `yarn app:ios`

切换设备系统主题（设置 → 显示）测两遍。同 Step 1/2 验证。

- [ ] **Step 4: Android Light + Dark（含一台低端机）**

Run: `yarn app:android`

至少一台低端 Android（如 Android 9-11 中端机）跑：
- 60fps 稳定（用 dev menu 看 perf monitor）
- 进入页 → 切走 → 切回，atmosphere 状态正常
- 无 memory 持续上涨（5 分钟观察）

- [ ] **Step 5: Desktop（macOS）**

Run: `yarn app:desktop`

同 Step 1 验证。

- [ ] **Step 6: Extension**

Run: `yarn app:ext`

同 Step 1 验证。Extension 弹窗尺寸较小，确认 glow 几何在窄屏下不溢出。

- [ ] **Step 7: 检查是否影响现有 OnboardingPage 入场动画**

Web: 现有 `enterStyle: { opacity: 0, scale: 0.9 }` 入场动效不被 atmosphere 干扰。打开页面时整个 hero 应该一起 fade+scale，atmosphere 跟随同步无错位。

- [ ] **Step 8: 录一个 5 秒 demo 视频/GIF 给 Franco 反馈**

录 light + dark 各一段，把链接/文件 share 给 Franco。

- [ ] **Step 9: Franco 视觉签收 → ship**

Franco 看完 demo 没意见 → 这波"减干"可上 launch。

如有意见，回到对应 Task 调（最常见调整：`PEAK_ALPHA_*` 大小、`BREATHE_DURATION_MS` 长短、某 word 颜色 token）。

---

## §10 跟进项（不在本次 launch 范围）

1. 如果 Task 5 Step 5 发现低端 Android 双层 SVG opacity 同跑掉帧，post-launch 加 `platformEnv.lowEndAndroid` flag，禁用 crossfade（颜色直接 snap）
2. 如果 system 有 reduce-motion 设置，atmosphere 应自动关闭 breathe 并削弱 crossfade（implementation 期 grep `useReducedMotion` 或类似 hook，没现成的话推到 post-launch）
3. 真正解 #4「内容密度低」+ #5 完整方案（产品场景 carousel）走 path ②，单独 plan，post-launch

---

## 自审

**1. Spec coverage：**

| Spec 章节 | 覆盖任务 |
|---|---|
| §3.1 几何（120% 宽 × 80% 高、radial soft glow） | Task 4 SVG ellipse rx=60% ry=50%（cy 40% 让中心略偏上） |
| §3.2 颜色映射（4 词 token） | Task 1 `heroAtmosphereTokens.ts` |
| §3.3 alpha 上限（light 30% / dark 20%） | Task 4 + Task 5 `peakAlpha` 计算 |
| §4.1 颜色 crossfade（550ms timing） | Task 5 双层 + MotiView opacity transition |
| §4.2 breathe（8s linear loop, [85%, 100%]） | Task 6 外层 MotiView with `loop: true, repeatReverse: true` |
| §5.1 HeroAtmosphere 受控组件 | Task 4-6 完整组件 |
| §5.2 HeroRotatingWord onWordChange | Task 2 |
| §5.3 GetStarted lift state | Task 3 |
| §6 Theme 适配（token 切换 + alpha 区分） | Task 4 `useTheme()` + `useThemeName()` |
| §7 性能 / 平台 | Task 5/6/8 跨平台目检 + 低端 Android 目检 |
| §8 Out of scope | 本 plan 严格只触 GetStarted + 新组件 + 4 行 token map，未改 layout/i18n/copy |
| §9 验证 | Task 8 完整 QA 流程 |

✓ 全覆盖。

**2. Placeholder scan：** 无 TBD/TODO/"add validation"。Q1 在前部明确标记为「开工前 Franco 决策」，不是埋着的 TODO。

**3. Type consistency：**
- `getAtmosphereToken(index: number): string` — Task 1 定义、Task 4/5 调用一致
- `HeroAtmosphere({ wordIndex }: { wordIndex: number })` — Task 4 定义、Task 7 调用一致
- `RadialGlow` 内部 helper 在 Task 5 引入，Task 6 沿用，参数 `{ index, isCurrent, peakAlpha }` 一致
- `onWordChange?: (index: number) => void` — Task 2 定义、Task 3 调用 `setCurrentWordIndex`（`Dispatch<SetStateAction<number>>` 兼容）

✓ 一致。

**4. 无遗漏：**
- 命名约定：所有新文件遵循同目录现有 SecurityKeyIcon 范式
- Commit granularity：每个 task 一次 commit，逻辑独立，可单独 revert
- 验证收口：Task 8 完整 QA + Franco 视觉签收 = ship gate
