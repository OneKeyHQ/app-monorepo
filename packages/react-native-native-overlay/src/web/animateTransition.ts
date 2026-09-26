import { springToCssLinear } from '../animation/spring';

import type { IResolvedOverlayTransition } from '../animation/resolveAnimation';
import type { IOverlayMotion } from '../animation/types';

export interface IContentExtent {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Union of the rendered children rects; the content wrapper is full-window. */
export function measureContentExtent(container: HTMLElement): IContentExtent {
  const rects = Array.from(container.children).map((child) =>
    child.getBoundingClientRect(),
  );
  if (rects.length === 0) {
    return {
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
    };
  }
  return {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
  };
}

function toTiming(motion: IOverlayMotion): {
  duration: number;
  easing: string;
} {
  if (motion.type === 'timing') {
    const [x1, y1, x2, y2] = motion.timing.easing;
    return {
      duration: motion.timing.durationMs,
      easing: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
    };
  }
  const { durationMs, easing } = springToCssLinear(motion.spring);
  return { duration: durationMs, easing };
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The off-stage keyframe for a transition: where enter starts / exit ends. */
function hiddenKeyframe(
  transition: IResolvedOverlayTransition,
  extent: IContentExtent,
): Keyframe {
  const frame: Keyframe = {};
  if (transition.fade || transition.type === 'fade') {
    frame.opacity = 0;
  }
  if (transition.type === 'slide') {
    const edge = transition.edge ?? 'bottom';
    const distance =
      transition.distance ??
      {
        top: extent.bottom,
        bottom: window.innerHeight - extent.top,
        left: extent.right,
        right: window.innerWidth - extent.left,
      }[edge];
    frame.transform = {
      top: `translate3d(0, ${-distance}px, 0)`,
      bottom: `translate3d(0, ${distance}px, 0)`,
      left: `translate3d(${-distance}px, 0, 0)`,
      right: `translate3d(${distance}px, 0, 0)`,
    }[edge];
  } else if (transition.type === 'scale') {
    frame.transform = `translate3d(0, ${transition.offsetY ?? 0}px, 0) scale(${
      transition.scale ?? 0.95
    })`;
  }
  return frame;
}

const VISIBLE_KEYFRAME: Keyframe = {
  opacity: 1,
  transform: 'translate3d(0, 0, 0) scale(1)',
};

/**
 * Runs an enter (`direction: 'in'`) or exit transition on `element`. The
 * slide distance and scale origin come from the children of `contentRoot`,
 * because the content wrapper itself always fills the window.
 */
export function animateTransition(
  element: HTMLElement,
  contentRoot: HTMLElement,
  transition: IResolvedOverlayTransition,
  direction: 'in' | 'out',
): Animation | undefined {
  if (transition.type === 'none') {
    return undefined;
  }
  const effective: IResolvedOverlayTransition = prefersReducedMotion()
    ? { ...transition, type: 'fade', fade: true }
    : transition;
  const extent = measureContentExtent(contentRoot);
  element.style.transformOrigin = `${(extent.left + extent.right) / 2}px ${
    (extent.top + extent.bottom) / 2
  }px`;
  const hidden = hiddenKeyframe(effective, extent);
  const visible: Keyframe = {};
  Object.keys(hidden).forEach((key) => {
    visible[key] = VISIBLE_KEYFRAME[key];
  });
  const keyframes = direction === 'in' ? [hidden, visible] : [visible, hidden];
  return element.animate(keyframes, {
    ...toTiming(effective.motion),
    fill: 'forwards',
  });
}

export function animateBackdrop(
  element: HTMLElement,
  motion: IOverlayMotion,
  direction: 'in' | 'out',
): Animation {
  const keyframes =
    direction === 'in'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: 0 }];
  return element.animate(keyframes, { ...toTiming(motion), fill: 'forwards' });
}
