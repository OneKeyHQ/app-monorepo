import { useCallback, useEffect, useState } from 'react';

import {
  useIsFocused,
  useNavigationState,
  useRoute,
} from '@react-navigation/core';
import { Easing, useReducedMotion } from 'react-native-reanimated';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MODAL_SCREEN_SELECTOR = '[data-testid="APP-Modal-Screen"]';
// The navigator's 90% of the window stays the limit; past it the form
// scrolls
const MODAL_MAX_WINDOW_SHARE = 0.9;
// What the modal keeps clear under it when it grows down
const MODAL_EDGE_SHARE = 0.05;
// Every change to what it holds eases from the height on screen, over the
// modal's own resize time, on the app's smooth curve
const EASE_MS = 250;
const EASING = Easing.bezierFn(0.2, 0, 0, 1);

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
// up to the modal, with the paddings around it
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

/**
 * The Loans modal as tall as what it holds (header, the content under the
 * returned ref, footer), up to maxHeight. Unlike the deposit modal, whose
 * top edge holds once it is pressed, this one holds its top edge from the
 * frame it opens at: the markets and the account's figures land after it
 * shows, and each of their changes eases from the height on screen down
 * from that edge, never re-centering it. Opened before its page could show
 * (the navigator's stand-in at the full size), it eases from there to its
 * height, centered, and holds its top edge from then on. Disabled, the
 * modal keeps the navigator's size: the Loans form's fixed one
 */
export function useLoanModalHeight(maxHeight: number, enabled = true) {
  const { gtMd } = useMedia();
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
    // The height wanted, the one on screen, and the ease between them
    let target = 0;
    let shown = 0;
    let from = 0;
    let easeStart = 0;
    // The height its top edge is held for; centered until it is set
    let anchorHeight: number | undefined;
    let frame = 0;

    const measure = () => {
      // Layout sizes: the modal's opening animation scales it, which the
      // on-screen rects include
      const modalRect = modal.getBoundingClientRect();
      const scale =
        modal.offsetHeight > 0 ? modalRect.height / modal.offsetHeight : 1;
      const contentRect = content.getBoundingClientRect();
      if (contentRect.height < 1 || scale <= 0) {
        return undefined;
      }
      const above =
        (contentRect.top - viewport.getBoundingClientRect().top) / scale +
        viewport.scrollTop;
      const chrome = measureChrome(viewport, modal);
      const below = measureSpaceBelow(content, viewport);
      const limit = Math.min(
        maxHeight,
        window.innerHeight * MODAL_MAX_WINDOW_SHARE,
      );
      const desired = chrome + above + contentRect.height / scale + below;
      return Math.ceil(Math.min(desired, limit));
    };

    const render = () => {
      // Centered in its container, a taller modal would also move up by half
      // the difference; as top margin, the same difference keeps its top
      // still. Where growing to its largest would take its bottom into the
      // clearance above the window's edge, its top rises by what that
      // needs, spread evenly over the growth
      let marginTop = 0;
      if (anchorHeight !== undefined) {
        const containerHeight = container.clientHeight;
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
      const progress = (performance.now() - easeStart) / EASE_MS;
      if (progress >= 1) {
        shown = target;
        anchorHeight ??= shown;
      } else {
        shown = from + (target - from) * EASING(progress);
        frame = requestAnimationFrame(tick);
      }
      render();
    };

    const easeTo = (next: number) => {
      // From where it is shown, also mid-way through the last ease
      from = shown;
      target = next;
      easeStart = performance.now();
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };

    const update = () => {
      if (!content.isConnected) {
        return;
      }
      const next = measure();
      if (next === undefined || next === target) {
        return;
      }
      if (!target) {
        // The height it opens at. While it fades in, set at once; after the
        // navigator's stand-in showed, eased from the stand-in's size
        const current = modal.offsetHeight;
        const isShowing = Number(getComputedStyle(modal).opacity) > 0.95;
        if (reduceMotion || !isShowing || Math.abs(next - current) < 1) {
          target = next;
          shown = next;
          anchorHeight = next;
          render();
          return;
        }
        shown = current;
        easeTo(next);
        return;
      }
      if (reduceMotion) {
        target = next;
        shown = next;
        render();
        return;
      }
      // A change while it still eases from the stand-in holds the top edge
      // where it got to
      anchorHeight ??= shown;
      easeTo(next);
    };

    const handleWindowResize = () => {
      // A new window size centers it again, at the height it has
      anchorHeight = shown;
      update();
      render();
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
    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      cancelAnimationFrame(frame);
      // Still on screen (another page pushed on top): the navigator's size
      // comes back. Closed: the modal leaves at the size and place it had
      if (content.isConnected) {
        modal.style.height = '';
        modal.style.marginTop = '';
      }
    };
  }, [content, isActive, maxHeight, reduceMotion]);

  return contentRef;
}
