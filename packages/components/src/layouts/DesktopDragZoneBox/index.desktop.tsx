import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

const dragZoneStyle = {
  userSelect: 'none',
  cursor: 'default',
} as const;

// =============================================================================
// macOS 顶栏拖拽区:命令式合成方案
//
// 背景:macOS(Electron 39 / upstream electron#21034)上,直接写在 DOM 上的
// `-webkit-app-region: drag` 在窗口 resize、显示器/DPI 变化、tab 切换(header 内容
// 变更)、modal 开关等"拖拽区布局变化"之后,原生 NSWindow 的拖拽区不会重新计算 →
// 出现"DOM 正确但拖不动"。且任何把【可见】节点移出 DOM 再放回的修法都会闪一帧。
//
// 方案:
//   1. header 元素只保留 `app-region-drag` 类作【标记】,本身的真实 app-region 被
//      下面注入的 style 中和(永不产生陈旧的原生区域);
//   2. 一个全局命令式管理器读取这些标记,按当前几何【新鲜地】合成:
//        - 覆盖标记区的不可见 drag 蒙层
//        - 覆盖其中各 no-drag 控件(按钮/输入框…)的不可见 no-drag 洞
//      全部是 body 级、position:fixed、opacity:0、pointer-events:none 的元素;
//   3. resize / scroll / tab(aria-hidden)/ 内容变化 时,debounce 后【清→重算→重贴】。
//   合成元素全程不可见 ⇒ 不闪;每次都是全新元素 ⇒ 永不陈旧;集中一处 ⇒ 取代旧的
//   per-instance ghost 机制,简化。
// =============================================================================

const MARKER_CLASS = 'app-region-drag';
const SYN_ATTR = 'data-onekey-syn-region';
const NEUTRALIZE_STYLE_ID = 'onekey-drag-region-neutralize';
const RECOMPUTE_DEBOUNCE = 200;
// 连续 DOM 变动(列表滚动、动画…)会不停重置 debounce。MAX_WAIT 保证最多等这么久
// 就强制重算一次,避免拖拽区在持续抖动期间一直得不到刷新。
const RECOMPUTE_MAX_WAIT = 600;

// Descendants of a drag zone that must stay clickable → punched as no-drag holes.
const NO_DRAG_SELECTOR = [
  '.app-region-no-drag',
  'input',
  'textarea',
  'select',
  'button',
  '[role="button"]',
  'a[href]',
  '[contenteditable]',
  '[class*="is_GroupFrame"]',
].join(',');

let refCount = 0;
let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let rafId = 0;
let pendingSince = 0;
let cleanupFns: Array<() => void> = [];

// 中和所有 .app-region-drag 标记的真实 app-region —— 让它们只当标记,不产生原生区域。
// 控件的 no-drag 也一并中和(改由合成洞负责),避免与合成区域顺序冲突。
function ensureNeutralizeStyle() {
  if (document.getElementById(NEUTRALIZE_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = NEUTRALIZE_STYLE_ID;
  style.textContent = `
.${MARKER_CLASS},
.${MARKER_CLASS} button,
.${MARKER_CLASS} input,
.${MARKER_CLASS} textarea,
.${MARKER_CLASS} a,
.${MARKER_CLASS} [role="button"] {
  -webkit-app-region: none !important;
}
[${SYN_ATTR}] { pointer-events: none; }
`;
  document.head.appendChild(style);
}

function removeNeutralizeStyle() {
  document.getElementById(NEUTRALIZE_STYLE_ID)?.remove();
}

// 标记区是否真正可见(react-navigation 把非活跃 tab 留在 DOM 里,用 aria-hidden /
// display / visibility 标隐藏 —— 这些区不能贡献拖拽区)。
function isZoneShown(el: Element): boolean {
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    const cs = globalThis.getComputedStyle(cur);
    if (
      cs.display === 'none' ||
      cs.visibility === 'hidden' ||
      cs.visibility === 'collapse'
    ) {
      return false;
    }
    if (cur.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    cur = cur.parentElement;
  }
  return true;
}

function makeRegionEl(
  rect: DOMRect,
  region: 'drag' | 'no-drag',
): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute(SYN_ATTR, region);
  el.style.cssText =
    `position:fixed;pointer-events:none;opacity:0;z-index:0;` +
    `left:${Math.round(rect.left)}px;top:${Math.round(rect.top)}px;` +
    `width:${Math.round(rect.width)}px;height:${Math.round(rect.height)}px;` +
    `-webkit-app-region:${region};`;
  return el;
}

function clearSynRegions() {
  document.querySelectorAll(`[${SYN_ATTR}]`).forEach((el) => el.remove());
}

// 命令式重算:清掉旧合成区 → 按当前几何重建 drag 蒙层 + no-drag 洞 → 重新贴上。
// drag 先 append、no-drag 后 append(原生区域按 DOM 顺序 union/difference,
// 后面的 no-drag 才能从前面的 drag 上减出可点击的洞)。
function recompute() {
  if (!document.body || !document.body.isConnected) {
    return;
  }
  clearSynRegions();
  const zones = Array.from(
    document.querySelectorAll(`.${MARKER_CLASS}`),
  ).filter((z) => {
    const r = z.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && isZoneShown(z);
  });
  const drags: HTMLDivElement[] = [];
  const holes: HTMLDivElement[] = [];
  for (const zone of zones) {
    drags.push(makeRegionEl(zone.getBoundingClientRect(), 'drag'));
    zone.querySelectorAll(NO_DRAG_SELECTOR).forEach((nd) => {
      const r = (nd as HTMLElement).getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        holes.push(makeRegionEl(r, 'no-drag'));
      }
    });
  }
  drags.forEach((d) => document.body.appendChild(d));
  holes.forEach((h) => document.body.appendChild(h));
}

function runRecompute() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingSince = 0;
  if (rafId) {
    globalThis.cancelAnimationFrame(rafId);
  }
  // rAF:等布局/样式结算后再读 rect 重算。
  rafId = globalThis.requestAnimationFrame(() => {
    rafId = 0;
    recompute();
  });
}

function scheduleRecompute() {
  const now = Date.now();
  if (pendingSince === 0) {
    pendingSince = now;
  }
  // 持续抖动到达 MAX_WAIT:立即重算,不再等待。
  if (now - pendingSince >= RECOMPUTE_MAX_WAIT) {
    runRecompute();
    return;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(runRecompute, RECOMPUTE_DEBOUNCE);
}

function startManager() {
  if (started || typeof document === 'undefined') {
    return;
  }
  started = true;
  ensureNeutralizeStyle();

  globalThis.addEventListener('resize', scheduleRecompute);
  // 捕获阶段:内部滚动容器(如吸顶 header)滚动也要重算。
  globalThis.addEventListener('scroll', scheduleRecompute, true);

  // tab / modal 切换会翻转祖先的 aria-hidden;内容变化(header 重渲染、控件增删)
  // 会改 childList —— 都要重算。忽略我们自己合成元素引起的 mutation,避免自触发。
  const mo = new MutationObserver((records) => {
    for (const m of records) {
      if (m.type === 'attributes') {
        scheduleRecompute();
        return;
      }
      const nodes = [
        ...Array.from(m.addedNodes),
        ...Array.from(m.removedNodes),
      ];
      const onlySyn =
        nodes.length > 0 &&
        nodes.every(
          (n) => n.nodeType === 1 && (n as Element).hasAttribute?.(SYN_ATTR),
        );
      if (!onlySyn) {
        scheduleRecompute();
        return;
      }
    }
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    childList: true,
    subtree: true,
  });

  cleanupFns = [
    () => globalThis.removeEventListener('resize', scheduleRecompute),
    () => globalThis.removeEventListener('scroll', scheduleRecompute, true),
    () => mo.disconnect(),
  ];

  // 首帧立即算一次。
  scheduleRecompute();
}

function stopManager() {
  if (!started) {
    return;
  }
  started = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (rafId) {
    globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
  }
  pendingSince = 0;
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
  clearSynRegions();
  removeNeutralizeStyle();
}

function useDesktopDragRegionManager(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return undefined;
    }
    refCount += 1;
    startManager();
    return () => {
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        stopManager();
      }
    };
  }, [enabled]);
}

function BaseDesktopDragZoneBox({
  children,
  ...rest
}: IDesktopDragZoneBoxProps) {
  return (
    <Stack {...rest} style={dragZoneStyle}>
      {children}
    </Stack>
  );
}

function DesktopDragZoneBoxMac({
  children,
  style,
  disabled,
  ...rest
}: IDesktopDragZoneBoxProps) {
  // 启动全局命令式拖拽区管理器(idempotent + ref-count)。
  useDesktopDragRegionManager(!disabled);

  // 只挂 marker 类(其真实 app-region 已被 neutralize style 中和),不直接产生原生
  // 拖拽区 —— 拖拽/no-drag 全部由管理器命令式合成。
  return (
    <Stack
      {...rest}
      className={disabled ? undefined : MARKER_CLASS}
      style={disabled ? style : dragZoneStyle}
    >
      {children}
    </Stack>
  );
}

export const DesktopDragZoneBox = platformEnv.isDesktopWithCustomTitleBar
  ? DesktopDragZoneBoxMac
  : BaseDesktopDragZoneBox;
