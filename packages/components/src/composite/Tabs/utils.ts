export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    const transition = document.startViewTransition(fn);
    void transition.ready.catch((error: unknown) => {
      // Per spec, a skipped view transition (hidden page, superseded by a
      // concurrent transition, etc.) rejects `ready` with an AbortError. The
      // message text is engine-specific (Chromium says "Transition was
      // skipped", Safari/Firefox use different wording), so match only the
      // error name and rethrow everything else as a global error.
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      queueMicrotask(() => {
        throw error;
      });
    });
  } else {
    fn();
  }
};

export const parseCssSize = (value: string | undefined) => {
  const size = Number.parseFloat(value ?? '');
  return Number.isFinite(size) ? size : 0;
};

// Bottom edge of an element's content, relative to its padding box top. The
// content stays content-sized even when the element itself is stretched by a
// parent carrying an explicit height, so this reports the real height where
// the element's own box cannot. Returns 0 when nothing measurable is laid out,
// so callers can fall back to the box.
// Requires `htmlElement` to be positioned (every Tamagui view is), otherwise
// `offsetParent`/`offsetTop` resolve against a further ancestor.
export const getInFlowContentBottom = (htmlElement: HTMLElement) => {
  let contentBottom = 0;
  const visit = (parent: HTMLElement) => {
    Array.from(parent.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }
      const childStyle = globalThis.getComputedStyle(child);
      // `display: contents` generates no box of its own — Tamagui wraps some
      // views that way — so its children lay out as if they were children of
      // `htmlElement` and still measure against it.
      if (childStyle.display === 'contents') {
        visit(child);
        return;
      }
      // offsetParent is null for `display: none` and `position: fixed`, so
      // both drop out here. Absolutely positioned children are deliberately
      // KEPT: the result sizes a container with `overflow: hidden`, so leaving
      // one out would clip it. One sized by the stretched box itself (e.g.
      // `top: 0; bottom: 0`) just reports the stale height, which makes the
      // caller fall back to the box instead of shrinking — never a clip.
      if (child.offsetParent !== htmlElement) {
        return;
      }
      // A child with visible overflow paints past its own border box and only
      // its scrollHeight accounts for that. A scrolling child must not
      // contribute the content it has scrolled away.
      const childHeight =
        childStyle.overflowY === 'visible'
          ? Math.max(child.offsetHeight, child.scrollHeight)
          : child.offsetHeight;
      contentBottom = Math.max(
        contentBottom,
        child.offsetTop + childHeight + parseCssSize(childStyle.marginBottom),
      );
    });
  };
  visit(htmlElement);
  return contentBottom;
};
