import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

const dragZoneStyle = {
  userSelect: 'none',
  cursor: 'default',
} as const;

// Selectors for descendants that should remain clickable inside an
// app-region:drag container. Chromium's region calculator unreliably honours
// such descendants once they live deep inside Tamagui-generated trees (see
// electron/electron#41695, #27149, #20926), so for every match we mirror a
// fresh fixed-position no-drag ghost element at body level. Ghosts are
// pointer-events:none so real clicks still reach the underlying control.
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

const GHOST_ATTR = 'data-onekey-drag-mask-ghost';

function useDragMaskMirror(
  rootRef: React.MutableRefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (
      !enabled ||
      // SSR guard: this hook never runs server-side, but be defensive in
      // case the bundle is imported from a non-DOM context.
      // eslint-disable-next-line unicorn/prefer-global-this
      typeof window === 'undefined'
    ) {
      return undefined;
    }
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    const ghosts = new Map<Element, HTMLDivElement>();
    let rafId = 0;
    let scheduled = false;

    const applyRect = (el: Element, ghost: HTMLDivElement) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        // hidden / collapsed → contribute nothing to the mask
        ghost.style.width = '0px';
        ghost.style.height = '0px';
        return;
      }
      ghost.style.left = `${r.left}px`;
      ghost.style.top = `${r.top}px`;
      ghost.style.width = `${r.width}px`;
      ghost.style.height = `${r.height}px`;
    };

    const ensureGhost = (el: Element) => {
      let ghost = ghosts.get(el);
      if (!ghost) {
        ghost = document.createElement('div');
        ghost.className = 'app-region-no-drag';
        ghost.setAttribute(GHOST_ATTR, '');
        ghost.style.cssText =
          'position:fixed;pointer-events:none;z-index:2147483647;left:0;top:0;width:0;height:0;';
        document.body.appendChild(ghost);
        ghosts.set(el, ghost);
      }
      applyRect(el, ghost);
    };

    const clearGhosts = () => {
      ghosts.forEach((ghost) => ghost.remove());
      ghosts.clear();
    };

    // react-navigation on web marks inactive tab containers with
    // `aria-hidden="true"` (often paired with `z-index: -1` to push them
    // behind the active screen). The hidden container still has layout, so
    // width/height/visibility/display alone do not detect it. Walk up the
    // ancestor chain and treat any of those signals as "this root lives in
    // a stale background tab" — skip the entire sync and clear ghosts.
    const isRootShown = () => {
      let cur: Element | null = root;
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
    };

    // Toggle whether this drag zone contributes to the window's native
    // draggable region, by adding/removing the `app-region-drag` class.
    //
    // Why the class and not an inline `-webkit-app-region` value: Chromium
    // computes the region as `union(drag rects) − union(no-drag rects)`, where a
    // `no-drag` rect subtracts from EVERY overlapping drag rect, not just its
    // own zone. The inactive tab headers sit at the SAME full-width position as
    // the active header, so the inactive zone must contribute *nothing* — not
    // `drag` (it would overlap and swallow active controls; the original bug),
    // and not `no-drag` (it would carve a full-width hole out of the active
    // header, leaving only the sidebar draggable). The only neutral state is the
    // ABSENCE of any `-webkit-app-region` declaration: an explicit
    // `-webkit-app-region: none` is coerced to `no-drag` by Chromium, so it is
    // NOT neutral. Removing the `app-region-drag` class drops both the root's
    // `drag` and the CSS-driven `no-drag` on its descendants
    // (`.app-region-drag button`, …), making the whole inactive subtree neutral.
    //
    // React won't fight this: the `className` prop value is the constant
    // `'app-region-drag'` (when enabled), so React only writes className when
    // that value changes — never on a plain re-render — leaving our classList
    // edits intact (the same contract the body-level ghosts rely on).
    const setRootDraggable = (draggable: boolean) => {
      root.classList.toggle('app-region-drag', draggable);
    };

    const sync = () => {
      scheduled = false;
      if (!document.body.isConnected) return;
      if (!isRootShown()) {
        // ---- Inactive-tab drag-region leak fix (OK-55535) ----
        // react-navigation keeps inactive tab/screen containers mounted (via
        // react-freeze) and marks them `aria-hidden="true"`. That is NOT
        // `display:none`, so a frozen header keeps its layout and Chromium
        // still unions its `-webkit-app-region: drag` rect into the window's
        // native draggable region. A header frozen in its narrow two-row form
        // (104px tall) then overlaps controls in the ACTIVE screen — e.g. the
        // account selector — that are NOT this zone's DOM descendants, so the
        // body-level ghost mask (which mirrors descendants only) can't protect
        // them and their clicks get eaten as window drags. This surfaces on
        // displays where the active layout doesn't also cover them (typically
        // devicePixelRatio = 1, i.e. an external monitor at native/high
        // resolution). Drop the drag region while hidden so the frozen zone
        // stops swallowing clicks; the active zone keeps its drag region, so
        // window dragging is unaffected.
        setRootDraggable(false);
        clearGhosts();
        return;
      }
      setRootDraggable(true);
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width === 0 || rootRect.height === 0) {
        clearGhosts();
        return;
      }
      const matches = root.querySelectorAll(NO_DRAG_SELECTOR);
      const seen = new Set<Element>();
      matches.forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        seen.add(el);
        ensureGhost(el);
      });
      // Drop ghosts whose source vanished or was removed from the subtree.
      ghosts.forEach((ghost, el) => {
        if (!seen.has(el)) {
          ghost.remove();
          ghosts.delete(el);
        }
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      rafId = globalThis.requestAnimationFrame(sync);
    };

    // Initial pass — handles the common case where children are already in
    // the tree at mount time. The follow-up observers cover later mutations.
    sync();

    const subtreeObserver = new MutationObserver(schedule);
    subtreeObserver.observe(root, { childList: true, subtree: true });

    // react-navigation toggles aria-hidden on ancestor tab containers when
    // the user switches tabs. Those mutations live OUTSIDE this root subtree
    // so the subtree observer above won't see them. Watch document-wide for
    // aria-hidden attribute flips so each instance can re-evaluate whether
    // it still belongs to the active tab and clear its ghosts when not.
    const ancestorObserver = new MutationObserver(schedule);
    ancestorObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['aria-hidden'],
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    globalThis.addEventListener('resize', schedule);
    // Use capture so inner scroll containers also trigger a resync.
    globalThis.addEventListener('scroll', schedule, true);

    return () => {
      subtreeObserver.disconnect();
      ancestorObserver.disconnect();
      resizeObserver.disconnect();
      globalThis.removeEventListener('resize', schedule);
      globalThis.removeEventListener('scroll', schedule, true);
      if (rafId) globalThis.cancelAnimationFrame(rafId);
      ghosts.forEach((ghost) => ghost.remove());
      ghosts.clear();
    };
  }, [enabled, rootRef]);
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
  const rootRef = useRef<HTMLElement | null>(null);
  useDragMaskMirror(rootRef, !disabled);

  // Toggle className/style instead of swapping keys so Chromium can
  // incrementally update its non-client drag mask without tearing down the
  // subtree mid-drag. The mirror hook above creates body-level no-drag
  // ghosts to compensate for Chromium's unreliable in-tree mask calculation.
  // Tamagui's Stack types its ref as TamaguiElement which on web resolves to
  // the underlying HTMLDivElement; cast through `any` to bridge the gap.
  return (
    <Stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={rootRef as any}
      {...rest}
      className={disabled ? undefined : 'app-region-drag'}
      style={disabled ? style : dragZoneStyle}
    >
      {children}
    </Stack>
  );
}

export const DesktopDragZoneBox = platformEnv.isDesktopWithCustomTitleBar
  ? DesktopDragZoneBoxMac
  : BaseDesktopDragZoneBox;
