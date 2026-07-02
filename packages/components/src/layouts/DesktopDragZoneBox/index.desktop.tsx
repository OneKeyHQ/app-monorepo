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
//   3. On resize / DPI change / aria-hidden (tab, modal) flips and zone
//      mount/unmount the overlays are cleared, recomputed and re-attached
//      (debounced, with a max-wait guard).
//   Fresh overlays => never stale; invisible => no flicker; one central place
//   => replaces (and removes) the previous per-instance ghost-mirror.
// =============================================================================

const MARKER_CLASS = 'app-region-drag';
const SYN_ATTR = 'data-onekey-syn-region';
const NEUTRALIZE_STYLE_ID = 'onekey-drag-region-neutralize';
const MODAL_SCREEN_SELECTOR = '[data-testid="APP-Modal-Screen"]';
const RECOMPUTE_DEBOUNCE = 200;
// A continuous stream of triggers (e.g. live window resizing fires `resize`
// rapidly) keeps resetting the debounce timer. MAX_WAIT guarantees a recompute
// fires at least this often so the draggable region is never starved while the
// events keep coming.
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

// The manager is a process-wide singleton: it starts once (on the first
// DesktopDragZoneBox mount) and intentionally never stops. A desktop window
// always has a title bar, so there is nothing to tear down; keeping it as a
// plain singleton avoids ref-counting that is fragile under React StrictMode's
// double-invoked effects and the ~11 simultaneously-mounted tab headers.
let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSince = 0;

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

  // react-navigation keeps inactive tab screens mounted and only flips
  // aria-hidden on their ancestors when switching tabs / opening a modal — that
  // does NOT mount/unmount the zones, so it must be observed explicitly. The
  // filter keeps this cheap: the callback only runs on aria-hidden changes
  // (rare), not on general DOM churn. (Other layout changes are covered by the
  // resize listener and by per-instance mount/unmount in the hook below.)
  const mo = new MutationObserver(scheduleRecompute);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true,
  });

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
    // Ensure the singleton is running, then resync — a drag zone (re)mounted,
    // e.g. in-tab navigation pushed a screen with a different header. This is
    // the targeted replacement for a document-wide childList observer.
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
  // Start the global imperative drag-region manager (idempotent + ref-counted).
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
