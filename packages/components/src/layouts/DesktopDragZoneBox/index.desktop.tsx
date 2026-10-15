import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

const dragZoneStyle = {
  userSelect: 'none',
  cursor: 'default',
} as const;

// =============================================================================
// macOS title-bar draggable region: imperative synthesized approach
//
// Problem: on macOS (Electron, upstream electron#21034) the native NSWindow
// draggable region is NOT recomputed after the `-webkit-app-region: drag`
// layout changes — window resize, monitor/DPI change, tab switch (the header
// subtree is swapped), modal open/close, docked DevTools. The DOM stays correct
// but the top bar can no longer drag the window. Any fix that pulls the
// *visible* header node out of the DOM and back to force a recompute flickers a
// frame; toggling the app-region value in place (or adding a throwaway probe
// element) does not refresh the native region at all; the only reliable levers
// (window focus/reorder) live in the main process and are not hot-updatable.
//
// Approach (renderer-only, hot-updatable, flicker-free):
//   1. Header elements keep `app-region-drag` purely as a MARKER. Their real
//      app-region (and that of everything inside them) is neutralized by the
//      injected style below, so they never produce a stale native region.
//   2. A single global imperative manager reads those markers and synthesizes,
//      from the current geometry, fresh invisible overlays:
//        - a `drag` overlay covering each visible marker zone;
//        - `no-drag` holes covering the clickable controls inside it.
//      All overlays are body-level, position:fixed, opacity:0,
//      pointer-events:none.
//   3. Each tab keeps its own header DOM/marker, but this manager only measures
//      visible zones. A scoped MutationObserver catches controls added or
//      replaced after the last pass and changes that move existing controls;
//      ResizeObserver catches size changes without DOM mutations. Ancestor
//      aria-hidden changes, zone mount/unmount, window resize and DPR changes
//      cover visibility and geometry changes outside the header subtree.
//      All triggers share a debounce with a maximum wait before rebuilding.
//   Rebuilt overlays track the observed changes without visible flicker; one
//   central place replaces the previous per-instance ghost-mirror.
// =============================================================================

const MARKER_CLASS = 'app-region-drag';
const SYN_ATTR = 'data-onekey-syn-region';
const NEUTRALIZE_STYLE_ID = 'onekey-drag-region-neutralize';
const MODAL_SCREEN_SELECTOR = '.onekey-modal-screen';
const RECOMPUTE_DEBOUNCE = 200;
// Content can update every frame. The debounce coalesces a burst, while
// MAX_WAIT still rebuilds periodically if updates never settle.
const RECOMPUTE_MAX_WAIT = 600;

// Descendants of a drag zone that must stay clickable → punched as no-drag holes.
// Custom clickable elements need an explicit app-region-no-drag marker.
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

// The manager is a process-wide singleton: it starts once (on the first
// DesktopDragZoneBox mount) and intentionally never stops. A desktop window
// always has a title bar, so there is nothing to tear down; keeping it as a
// plain singleton avoids ref-counting that is fragile under React StrictMode's
// double-invoked effects and the ~11 simultaneously-mounted tab headers.
let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSince = 0;
let sizeObserver: ResizeObserver | null = null;
let contentObserver: MutationObserver | null = null;
// observe() also reports the initial size, which must not reschedule.
const observedSizes = new WeakMap<Element, string>();

function toSizeKey(rect: DOMRect) {
  return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
}

// Neutralize the real app-region of every marker zone AND everything inside it
// (drag, no-drag controls, `.app-region-no-drag`, is_GroupFrame, …). Inside a
// drag zone no element keeps a real native region — drag and no-drag are both
// provided by the synthesized overlays, so nothing can go stale. The shared CSS
// rules in index.css are intentionally left untouched: they still apply to
// app-region elements OUTSIDE any drag zone (e.g. desktop menus).
function ensureNeutralizeStyle() {
  if (document.getElementById(NEUTRALIZE_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = NEUTRALIZE_STYLE_ID;
  style.textContent = `
.${MARKER_CLASS},
.${MARKER_CLASS} * {
  -webkit-app-region: none !important;
}
[${SYN_ATTR}] { pointer-events: none; }
`;
  document.head.appendChild(style);
}

// Whether a marker zone is actually visible. LOAD-BEARING — do not drop this
// filter (see OK-55535, the inactive-tab drag-region leak / cross-monitor bug):
// react-navigation keeps inactive tab screens mounted via react-freeze and only
// marks them `aria-hidden="true"` (NOT display:none), so a frozen header keeps
// its layout. If we synthesized a drag overlay for such a hidden zone, its stale
// (e.g. narrow two-row) rect would overlap and swallow clicks on controls in the
// ACTIVE screen — which surfaced especially on external monitors (dpr=1). Only
// visible zones get overlays; hidden ones contribute nothing.
function isZoneShown(el: Element): boolean {
  if (el.closest(MODAL_SCREEN_SELECTOR)) {
    return false;
  }

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

// Imperative recompute: drop the old overlays → rebuild the drag overlay +
// no-drag holes from the current geometry → re-attach. The drag overlays are
// appended first and the no-drag holes after: the native region is built in DOM
// order (drag = union, no-drag = difference), so the later no-drag holes carve
// the clickable controls back out of the drag overlay.
function recompute() {
  if (!document.body || !document.body.isConnected) {
    return;
  }
  clearSynRegions();
  const measured: Array<[Element, DOMRect]> = [];
  const zones = Array.from(
    document.querySelectorAll(`.${MARKER_CLASS}`),
  ).filter((z) => {
    const r = z.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      // A collapsed zone gets no overlay but must resync once it expands.
      measured.push([z, r]);
      return false;
    }
    return isZoneShown(z);
  });
  const drags: HTMLDivElement[] = [];
  const holes: HTMLDivElement[] = [];
  for (const zone of zones) {
    const zoneRect = zone.getBoundingClientRect();
    measured.push([zone, zoneRect]);
    drags.push(makeRegionEl(zoneRect, 'drag'));
    zone.querySelectorAll(NO_DRAG_SELECTOR).forEach((nd) => {
      const r = (nd as HTMLElement).getBoundingClientRect();
      measured.push([nd, r]);
      if (r.width > 0 && r.height > 0) {
        holes.push(makeRegionEl(r, 'no-drag'));
      }
    });
  }
  drags.forEach((d) => document.body.appendChild(d));
  holes.forEach((h) => document.body.appendChild(h));
  observeSizes(measured);
  observeContent(zones);
}

// Watch only visible drag zones. Child/attribute/text mutations catch controls
// inserted after the last size-observer pass, or controls shifted by a sibling
// without changing their own size. Rebind after every pass so an inactive tab
// or removed control stops generating work. The synthesized overlays live under
// body, outside these observed subtrees, so rebuilding cannot trigger a loop.
// Pure position animation without a DOM mutation or size change is outside
// these observers; such a header animation needs its own end-of-motion trigger.
function observeContent(zones: Element[]) {
  if (!contentObserver) {
    return;
  }
  contentObserver.disconnect();
  for (const zone of zones) {
    contentObserver.observe(zone, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}

// A control can resize after a recompute (e.g. a header badge filled in by async
// data) without any other trigger firing, which leaves its hole stale.
function observeSizes(measured: Array<[Element, DOMRect]>) {
  if (!sizeObserver) {
    return;
  }
  sizeObserver.disconnect();
  for (const [el, rect] of measured) {
    observedSizes.set(el, toSizeKey(rect));
    // Holes are cut from the border box, so padding-only growth must count too.
    sizeObserver.observe(el, { box: 'border-box' });
  }
}

function runRecompute() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingSince = 0;
  // Call recompute directly (no requestAnimationFrame): rAF is paused by
  // Electron's backgroundThrottling whenever the window is occluded/backgrounded,
  // which would leave the draggable region stale until the window is frontmost
  // again. The debounce already lets layout settle, and recompute's
  // getBoundingClientRect forces a synchronous layout anyway.
  recompute();
}

function scheduleRecompute() {
  const now = Date.now();
  if (pendingSince === 0) {
    pendingSince = now;
  }
  // Continuous churn reached MAX_WAIT: recompute now instead of waiting more.
  if (now - pendingSince >= RECOMPUTE_MAX_WAIT) {
    runRecompute();
    return;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(runRecompute, RECOMPUTE_DEBOUNCE);
}

// Start the singleton manager once. Idempotent: the `started` guard makes every
// call after the first a no-op, so it is safe to call from every mount.
function startManager() {
  if (started || typeof document === 'undefined') {
    return;
  }
  started = true;
  ensureNeutralizeStyle();

  // Window geometry: resize, maximize, fullscreen toggle and docked-DevTools
  // open/close (all change the renderer's CSS-pixel viewport).
  globalThis.addEventListener('resize', scheduleRecompute);

  // devicePixelRatio change — i.e. the window moved to a monitor with a
  // different scale factor. A pure dpr change does NOT reliably fire `resize`
  // (the CSS-pixel size is unchanged), so watch the output resolution
  // explicitly. `matchMedia('(resolution: <dpr>dppx)')` flips when the dpr
  // changes; re-arm it each time against the new dpr.
  let dprQuery: MediaQueryList | null = null;
  let onDprChange: () => void = () => undefined;
  const armDprQuery = () => {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = globalThis.matchMedia(
      `(resolution: ${globalThis.devicePixelRatio}dppx)`,
    );
    dprQuery.addEventListener('change', onDprChange);
  };
  onDprChange = () => {
    scheduleRecompute();
    armDprQuery();
  };
  armDprQuery();

  // react-navigation keeps inactive tabs mounted and flips aria-hidden on an
  // ancestor outside the observed drag zone. Watch only this attribute across
  // the document to switch the active zone without observing unrelated churn.
  const mo = new MutationObserver(scheduleRecompute);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true,
  });

  sizeObserver = new ResizeObserver((entries) => {
    const resized = entries.some(
      ({ target }) =>
        observedSizes.get(target) !== toSizeKey(target.getBoundingClientRect()),
    );
    if (resized) {
      scheduleRecompute();
    }
  });

  // The content observer is scoped to visible zones in observeContent(). Its
  // potentially frequent callbacks use the same debounce/max-wait scheduler.
  contentObserver = new MutationObserver(scheduleRecompute);

  // Initial pass — run it synchronously (not debounced) so the draggable region
  // exists on the first commit instead of ~200ms later, otherwise the title bar
  // is briefly non-draggable right after app load.
  recompute();
}

function useDesktopDragRegionManager(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return undefined;
    }
    // Ensure the singleton is running, then resync when a zone (re)mounts.
    // Content changes within an existing zone are handled by its observer.
    startManager();
    scheduleRecompute();
    return () => {
      // A drag zone unmounted — resync the remaining ones. The manager itself
      // is never torn down (singleton for the window's lifetime).
      scheduleRecompute();
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
  // Start the global imperative drag-region manager (idempotent singleton).
  useDesktopDragRegionManager(!disabled);

  // Only carry the marker class (its real app-region is neutralized by the
  // injected style); the actual drag / no-drag regions are synthesized by the
  // manager.
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
