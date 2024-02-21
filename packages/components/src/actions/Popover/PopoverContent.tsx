import type { DependencyList, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { Stack } from '../../primitives';

import type { IPopoverContent } from './type';

type IDomTargetTypes = Array<Window | Document | HTMLElement>;
type IMouseEventType =
  | 'click'
  | 'dblclick'
  | 'mousedown'
  | 'mousemove'
  | 'mouseup'
  | 'touchstart'
  | 'touchmove'
  | 'touchend'
  | 'mouseenter'
  | 'mouseleave'
  | 'mouseout'
  | 'mouseover'
  | 'scroll'
  | 'wheel'
  | 'contextmenu';

function attachEvent(
  domTargets: IDomTargetTypes,
  event: IMouseEventType,
  callback: (e: any) => void,
  capture: any = false,
) {
  domTargets.forEach((target) => {
    target.addEventListener(event, callback, capture);
  });

  return function () {
    domTargets.forEach((target) => {
      target.removeEventListener(event, callback, capture);
    });
  };
}

function attachEvents(
  domTargets: IDomTargetTypes,
  events: Array<
    [event: IMouseEventType, callback: (e: any) => void, capture?: any]
  >,
) {
  const subscribers = new Map<string, () => void>();

  events.forEach(([event, callback, capture = false]) => {
    subscribers.set(event, attachEvent(domTargets, event, callback, capture));
  });

  return function (eventKeys?: Array<string>) {
    for (const [eventKey, subscriber] of subscribers.entries()) {
      if (!eventKeys) {
        subscriber();
        return;
      }

      if (eventKeys.indexOf(eventKey) !== -1) {
        subscriber();
      }
    }
  };
}

function useOutsideClick(
  elementRef: RefObject<HTMLElement>,
  callback: (event: MouseEvent) => void,
  deps: DependencyList,
) {
  const callbackRef = useRef<(event: MouseEvent) => void>();

  if (!callbackRef.current) {
    callbackRef.current = callback;
  }

  // Reinitiate callback when dependency change
  useEffect(() => {
    callbackRef.current = callback;

    return () => {
      callbackRef.current = () => false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        !elementRef?.current?.contains(e.target as Element) &&
        callbackRef.current
      ) {
        callbackRef.current(e);
      }
    };

    const subscribe = attachEvents([document], [['click', handleOutsideClick]]);

    return () => subscribe && subscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function PopoverContent({ children, closePopover }: IPopoverContent) {
  const elemRef = useRef<HTMLElement | null>(null);

  const handleOutsideClick = useCallback(() => {
    closePopover();
  }, [closePopover]);

  useOutsideClick(elemRef, handleOutsideClick, []);
  return <Stack ref={elemRef}>{children}</Stack>;
}
