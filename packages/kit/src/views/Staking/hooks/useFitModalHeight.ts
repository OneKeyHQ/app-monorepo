import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useIsFocused,
  useNavigationState,
  useRoute,
} from '@react-navigation/core';
import { Easing, useReducedMotion } from 'react-native-reanimated';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MODAL_SCREEN_SELECTOR = '[data-testid="APP-Modal-Screen"]';
// The route's own size ($160) and the navigator's 90% of the window stay
// the limits; past them the form scrolls
const MODAL_MAX_HEIGHT = 640;
const MODAL_MAX_WINDOW_SHARE = 0.9;
// What the modal keeps clear under it when it grows down
const MODAL_EDGE_SHARE = 0.05;
// A jump in what it holds (another form, a done view) eases over the time
// and curve of the modal's own resize between routes
// (createWebModalNavigator)
const JUMP_MS = 250;
const JUMP_EASING = Easing.bezierFn(0.4, 0, 0.2, 1);
// A jump comes with parts added or removed in the same frame, and nothing
// moves in the frames after. Other size changes are an animation inside (a
// list unfolding, rows coming in), which the modal follows frame by frame:
// an eased chase would trail behind it
const JUMP_WINDOW_MS = 50;
// An animation being followed moves every frame (16.7 ms); what changes
// within two frames of it is more of it
const FOLLOWING_MS = 34;
// A change this small is followed as it is: the first frame of an animation
// inside, or a line wrapping
const SMALL_CHANGE_PX = 8;
// While the modal fades and scales in (the navigator's 250 ms), parts still
// settling are followed at once: easing them would show a modal growing as
// it appears
const OPENING_MS = 300;

// Until then every change to what the modal holds eases as one jump, from
// where it is shown: a switch to another protocol builds the form again over
// a few frames, which would otherwise read as an animation to follow
let easeChangesUntil = 0;
const SWITCH_EASE_WINDOW_MS = 300;

/**
 * The form in the open modal is about to be built again (another protocol
 * picked): its height changes in the next moment ease instead of jumping
 */
export function easeModalHeightChanges() {
  easeChangesUntil = performance.now() + SWITCH_EASE_WINDOW_MS;
}

// Modals this has sized, with the height each may grow to: coming back to
// one (History closed) eases from where it is instead of jumping
const sizedModals = new WeakMap<HTMLElement, number>();

/**
 * How much taller the modal holding a node can still grow to fit what it
 * holds before that has to scroll: 0 outside a modal sized here. It grows a
 * frame behind its content, so what the content gained this frame and the
 * modal can still take isn't for the content to scroll
 */
export function getModalRoomToGrow(node: HTMLElement): number {
  const modal = node.closest<HTMLElement>(MODAL_SCREEN_SELECTOR);
  const maxHeight = modal ? sizedModals.get(modal) : undefined;
  if (!modal || maxHeight === undefined) {
    return 0;
  }
  const largest = Math.ceil(
    Math.min(maxHeight, window.innerHeight * MODAL_MAX_WINDOW_SHARE),
  );
  return Math.max(0, largest - modal.offsetHeight);
}
// A modal easing back to its usual size after the page left it
const releases = new WeakMap<HTMLElement, () => void>();

function findScrollViewport(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Header and footer: what stacks above and below the scroll area on the way
// up to the modal, with the paddings around it. Read from those parts, as
// in the modal's first frames the scroll area isn't held to its height yet
function measureChrome(viewport: HTMLElement, modal: HTMLElement) {
  let chrome = 0;
  let node: HTMLElement = viewport;
  while (node !== modal && node.parentElement) {
    const parent: HTMLElement = node.parentElement;
    const parentStyle = getComputedStyle(parent);
    const isStacked =
      parentStyle.display !== 'flex' ||
      parentStyle.flexDirection.startsWith('column');
    if (isStacked) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          const style = getComputedStyle(sibling);
          const isInFlow =
            style.position !== 'absolute' &&
            style.position !== 'fixed' &&
            style.display !== 'none';
          if (isInFlow) {
            chrome +=
              sibling.offsetHeight +
              (parseFloat(style.marginTop) || 0) +
              (parseFloat(style.marginBottom) || 0);
          }
        }
      }
    }
    chrome +=
      (parseFloat(parentStyle.paddingTop) || 0) +
      (parseFloat(parentStyle.paddingBottom) || 0) +
      (parseFloat(parentStyle.borderTopWidth) || 0) +
      (parseFloat(parentStyle.borderBottomWidth) || 0);
    node = parent;
  }
  return chrome;
}

// Padding and margin under the content, down to the scroll area's edge
function measureSpaceBelow(content: HTMLElement, viewport: HTMLElement) {
  let space = parseFloat(getComputedStyle(content).marginBottom) || 0;
  let node = content.parentElement;
  while (node && node !== viewport) {
    space += parseFloat(getComputedStyle(node).paddingBottom) || 0;
    node = node.parentElement;
  }
  return space;
}

// Back to the navigator's size (90% of the window, up to 640, or up to the
// route's own height where it declares one) and centered, then the
// navigator's own styles again
function releaseModal(
  modal: HTMLElement,
  container: HTMLElement,
  reduceMotion: boolean,
  maxHeight: number = MODAL_MAX_HEIGHT,
) {
  const clear = () => {
    releases.delete(modal);
    modal.style.height = '';
    modal.style.marginTop = '';
  };
  const from = modal.offsetHeight;
  const marginFrom = parseFloat(modal.style.marginTop) || 0;
  const to = Math.min(
    container.clientHeight * MODAL_MAX_WINDOW_SHARE,
    maxHeight,
  );
  if (reduceMotion || (Math.abs(to - from) < 1 && Math.abs(marginFrom) < 1)) {
    clear();
    return;
  }
  const start = performance.now();
  let frame = 0;
  const step = () => {
    const progress = (performance.now() - start) / JUMP_MS;
    if (progress >= 1) {
      clear();
      return;
    }
    const eased = JUMP_EASING(progress);
    modal.style.height = `${from + (to - from) * eased}px`;
    modal.style.marginTop = `${marginFrom * (1 - eased)}px`;
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  releases.set(modal, () => {
    cancelAnimationFrame(frame);
    releases.delete(modal);
  });
}

/**
 * A wide-screen web modal as tall as what it holds: header, the content
 * under the returned ref, footer, up to the modal's usual size. It opens at
 * that height, centered. Once pressed or typed in, it grows and shrinks from
 * its top edge, so what was just pressed stays where it was. The navigator
 * only sets the modal's max size and resets it on every stack change, so
 * this sets its height. Another page pushed in the same modal (History) gets
 * the usual size back; a modal opened over it (Pay with's picker) leaves it
 * as it is, to grow out of it and shrink back into it. A route that declares
 * a taller modal (modalContentMaxHeight) passes the same height as maxHeight.
 * A page that stops fitting to take a fixed size the route declares (the
 * Earn router grown from one offer) passes that height as releaseMaxHeight:
 * the modal eases to it as the navigator's size takes over
 */
export function useFitModalHeight(
  enabled = true,
  maxHeight: number = MODAL_MAX_HEIGHT,
  releaseMaxHeight?: number,
) {
  const { gtMd } = useMedia();
  // Read as fitting stops, in the render that stops it
  const releaseMaxHeightRef = useRef(releaseMaxHeight);
  releaseMaxHeightRef.current = releaseMaxHeight;
  const isFocused = useIsFocused();
  // Still the top page of its own modal, with another modal over it
  const routeKey = useRoute().key;
  const isTopOfModal = useNavigationState(
    (state) => state?.routes?.[state.index]?.key === routeKey,
  );
  const reduceMotion = useReducedMotion();
  const [content, setContent] = useState<HTMLElement | null>(null);
  const contentRef = useCallback((node: unknown) => {
    setContent(
      typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
        ? node
        : null,
    );
  }, []);
  const isActive =
    enabled &&
    gtMd &&
    (isFocused || isTopOfModal) &&
    platformEnv.isRuntimeBrowser;

  useEffect(() => {
    if (!isActive || !content) {
      return undefined;
    }
    const modal = content.closest<HTMLElement>(MODAL_SCREEN_SELECTOR);
    const viewport = findScrollViewport(content);
    const container = modal?.parentElement;
    if (!modal || !viewport || !container) {
      return undefined;
    }
    releases.get(modal)?.();
    // As tall as what it holds, within the limits
    let target = 0;
    // A jump's distance still to go, easing out from jumpStart
    let jumpFrom = 0;
    let jumpStart = 0;
    let lastStructureChangeAt = Number.NEGATIVE_INFINITY;
    // The latest jump, until the next frame shows whether it was one
    let pendingJump: { at: number; delta: number } | undefined;
    let lastFollowedAt = Number.NEGATIVE_INFINITY;
    let lastChangeAt = Number.NEGATIVE_INFINITY;
    const startedAt = performance.now();
    // Once pressed or typed in, the height its top edge is kept for
    let anchorHeight: number | undefined;
    let frame = 0;

    const remainingJump = (now: number) => {
      if (!jumpFrom) {
        return 0;
      }
      const progress = (now - jumpStart) / JUMP_MS;
      if (progress >= 1) {
        jumpFrom = 0;
        return 0;
      }
      return jumpFrom * (1 - JUMP_EASING(progress));
    };

    const measure = () => {
      // Layout sizes: the modal's opening animation scales it, which the
      // on-screen rects include
      const modalRect = modal.getBoundingClientRect();
      const scale =
        modal.offsetHeight > 0 ? modalRect.height / modal.offsetHeight : 1;
      const contentRect = content.getBoundingClientRect();
      if (contentRect.height < 1 || scale <= 0) {
        // Nothing laid out yet: the modal keeps its usual size meanwhile
        return undefined;
      }
      const chrome = measureChrome(viewport, modal);
      const above =
        (contentRect.top - viewport.getBoundingClientRect().top) / scale +
        viewport.scrollTop;
      const below = measureSpaceBelow(content, viewport);
      const limit = Math.min(
        maxHeight,
        window.innerHeight * MODAL_MAX_WINDOW_SHARE,
      );
      const desired = chrome + above + contentRect.height / scale + below;
      return Math.ceil(Math.min(desired, limit));
    };

    const render = (now: number) => {
      const shown = target - remainingJump(now);
      const containerHeight = container.clientHeight;
      // Centered in its container (top = (container - height + margin) / 2),
      // a taller modal would also move up by half the difference; as top
      // margin, the same difference keeps its top still. Where growing to its
      // largest would take its bottom into the clearance above the window's
      // edge, its top rises by what that needs, spread evenly over the
      // growth, so it doesn't start moving with a jolt where the bottom
      // meets the clearance
      let marginTop = 0;
      if (anchorHeight !== undefined) {
        const largest = Math.min(
          containerHeight * MODAL_MAX_WINDOW_SHARE,
          maxHeight,
        );
        const anchoredTop = (containerHeight - anchorHeight) / 2;
        const riseAtLargest = Math.max(
          0,
          anchoredTop + largest - containerHeight * (1 - MODAL_EDGE_SHARE),
        );
        const grown =
          largest > anchorHeight
            ? Math.min(
                1,
                Math.max(0, (shown - anchorHeight) / (largest - anchorHeight)),
              )
            : 0;
        marginTop = shown - anchorHeight - 2 * riseAtLargest * grown;
      }
      modal.style.height = `${shown}px`;
      modal.style.marginTop = `${marginTop}px`;
    };

    const tick = () => {
      frame = 0;
      render(performance.now());
      if (jumpFrom) {
        frame = requestAnimationFrame(tick);
      }
    };

    const update = () => {
      if (!content.isConnected) {
        return;
      }
      const next = measure();
      if (next === undefined) {
        return;
      }
      const now = performance.now();
      if (!target) {
        // The height it opens at, not a change to animate. Back from a page
        // pushed on top, it eases from the size it has
        const current = sizedModals.has(modal) ? modal.offsetHeight : 0;
        sizedModals.set(modal, maxHeight);
        target = next;
        if (current && !reduceMotion && Math.abs(next - current) >= 1) {
          jumpFrom = next - current;
          jumpStart = now;
          frame = requestAnimationFrame(tick);
        }
        render(now);
        return;
      }
      if (next === target) {
        return;
      }
      const delta = next - target;
      const remaining = remainingJump(now);
      // Against a jump still easing the other way (a row gone as the line
      // under the box grows in), a change eases with the jump: followed, it
      // would add to what is left of the jump, and the modal would overshoot
      // and come back
      const isAgainstJump = remaining * delta < 0;
      // A small change right after the last one is a frame of an animation
      // inside (the line growing in as the form is built again): followed
      // even then. Eased from its start on every frame, the modal would trail
      // behind it and cover the bottom row with its edge. A frame or two may
      // drop while the form is built
      const isAnimationFrame =
        Math.abs(delta) <= SMALL_CHANGE_PX &&
        now - lastChangeAt < JUMP_WINDOW_MS &&
        !isAgainstJump;
      lastChangeAt = now;
      if (
        !reduceMotion &&
        now < easeChangesUntil &&
        now - startedAt >= OPENING_MS &&
        !isAnimationFrame
      ) {
        // The form being built again: from where it is shown to the latest
        // height, however many frames it takes to settle
        jumpFrom = remaining + delta;
        jumpStart = now;
        pendingJump = undefined;
      } else if (pendingJump && now - pendingJump.at < JUMP_WINDOW_MS) {
        // It goes on moving: an animation inside after all, followed from
        // here. What is left of earlier jumps keeps easing
        const rest = remaining - pendingJump.delta;
        jumpFrom = Math.abs(rest) < 1 ? 0 : rest;
        jumpStart = now;
        pendingJump = undefined;
        lastFollowedAt = now;
      } else if (
        !reduceMotion &&
        now - startedAt >= OPENING_MS &&
        Math.abs(delta) > SMALL_CHANGE_PX &&
        now - lastStructureChangeAt < JUMP_WINDOW_MS &&
        now - lastFollowedAt >= FOLLOWING_MS
      ) {
        // Starts from where it is shown now, even mid-way through a jump
        jumpFrom = remaining + delta;
        jumpStart = now;
        pendingJump = { at: now, delta };
      } else if (!reduceMotion && isAgainstJump) {
        jumpFrom = remaining + delta;
        jumpStart = now;
        pendingJump = undefined;
        lastFollowedAt = now;
      } else {
        pendingJump = undefined;
        lastFollowedAt = now;
      }
      target = next;
      render(now);
      if (jumpFrom && !frame) {
        frame = requestAnimationFrame(tick);
      }
    };

    const handleInteraction = () => {
      if (anchorHeight === undefined && target) {
        anchorHeight = target - remainingJump(performance.now());
      }
    };
    const handleWindowResize = () => {
      // A new window size centers it again
      anchorHeight = undefined;
      update();
      render(performance.now());
    };

    // Read and set in the same frame as the change. Nothing observed here
    // changes size with the modal, so setting it starts no new round
    const observer = new ResizeObserver(update);
    observer.observe(content);
    // The footer: steps under the button change its height
    [...(viewport.parentElement?.children ?? [])].forEach((sibling) => {
      if (sibling !== viewport) {
        observer.observe(sibling);
      }
    });
    const structureObserver = new MutationObserver(() => {
      lastStructureChangeAt = performance.now();
    });
    structureObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('resize', handleWindowResize);
    modal.addEventListener('pointerdown', handleInteraction, true);
    modal.addEventListener('keydown', handleInteraction, true);
    return () => {
      observer.disconnect();
      structureObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      modal.removeEventListener('pointerdown', handleInteraction, true);
      modal.removeEventListener('keydown', handleInteraction, true);
      cancelAnimationFrame(frame);
      // Still on screen (another page pushed on top): the usual size comes
      // back. Closed: the modal leaves at the size and place it had
      if (content.isConnected) {
        releaseModal(
          modal,
          container,
          reduceMotion,
          releaseMaxHeightRef.current,
        );
      }
    };
  }, [content, isActive, maxHeight, reduceMotion]);

  return contentRef;
}
