import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { IElement } from '@onekeyhq/components';

export function useSpotlightScrollPause(
  triggerRef: RefObject<IElement | null>,
  enabled: boolean,
  onScrollChange: (scrolling: boolean) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isFullyVisible = true;
    const target = triggerRef.current as HTMLElement | null;
    const scrollParents: HTMLElement[] = [];
    let parent = target instanceof HTMLElement ? target.parentElement : null;
    while (parent) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        scrollParents.push(parent);
      }
      parent = parent.parentElement;
    }
    const isBlocked = () =>
      !isFullyVisible || scrollParents.some((element) => element.scrollTop > 0);
    const onScroll = (event: Event) => {
      if (
        event.target !== document &&
        event.target instanceof HTMLElement &&
        target instanceof HTMLElement &&
        !event.target.contains(target)
      ) {
        return;
      }
      onScrollChange(true);
      clearTimeout(timer);
      timer = setTimeout(() => onScrollChange(isBlocked()), 150);
    };
    const observer =
      target instanceof HTMLElement &&
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              isFullyVisible =
                !!entry?.isIntersecting && entry.intersectionRatio === 1;
              onScrollChange(isBlocked());
            },
            { threshold: 1 },
          )
        : undefined;
    if (target instanceof HTMLElement) observer?.observe(target);
    onScrollChange(isBlocked());
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [enabled, onScrollChange, triggerRef]);
}
