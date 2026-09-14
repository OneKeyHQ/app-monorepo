import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PointerEvent } from 'react';

import type { IScrollViewProps, IScrollViewRef } from '@onekeyhq/components';
import { ScrollView } from '@onekeyhq/components';

export const PerpTableScrollView = forwardRef<IScrollViewRef, IScrollViewProps>(
  function PerpTableScrollView(props, forwardedRef) {
    const horizontal = props.horizontal === true;
    const scrollRef = useRef<IScrollViewRef>(null);
    useImperativeHandle(
      forwardedRef,
      () => scrollRef.current as IScrollViewRef,
    );
    const thumbRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<
      { pointerId: number; position: number; scrollOffset: number } | undefined
    >(undefined);

    useEffect(() => {
      const node = scrollRef.current?.getScrollableNode() as
        | HTMLElement
        | undefined;
      const thumb = thumbRef.current;
      if (!node || !thumb) return;

      const updateThumb = () => {
        const viewport = horizontal ? node.clientWidth : node.clientHeight;
        const content = horizontal ? node.scrollWidth : node.scrollHeight;
        const offset = horizontal ? node.scrollLeft : node.scrollTop;
        const canScroll = content > viewport && viewport > 0;
        thumb.style.display = canScroll ? 'block' : 'none';
        if (!canScroll) return;
        const size = Math.min(
          viewport,
          Math.max(24, (viewport * viewport) / content),
        );
        const position = (offset / (content - viewport)) * (viewport - size);
        thumb.style[horizontal ? 'width' : 'height'] = `${size}px`;
        thumb.style.transform = horizontal
          ? `translateX(${position}px)`
          : `translateY(${position}px)`;
      };

      const observer = new ResizeObserver(updateThumb);
      observer.observe(node);
      if (node.firstElementChild) observer.observe(node.firstElementChild);
      node.addEventListener('scroll', updateThumb, { passive: true });
      updateThumb();
      return () => {
        observer.disconnect();
        node.removeEventListener('scroll', updateThumb);
      };
    }, [horizontal]);

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const node = scrollRef.current?.getScrollableNode() as
        | HTMLElement
        | undefined;
      if (!node) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        position: horizontal ? event.clientX : event.clientY,
        scrollOffset: horizontal ? node.scrollLeft : node.scrollTop,
      };
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const node = scrollRef.current?.getScrollableNode() as
        | HTMLElement
        | undefined;
      if (!node) return;
      const viewport = horizontal ? node.clientWidth : node.clientHeight;
      const content = horizontal ? node.scrollWidth : node.scrollHeight;
      const thumbSize = horizontal
        ? event.currentTarget.offsetWidth
        : event.currentTarget.offsetHeight;
      const travel = viewport - thumbSize;
      if (travel <= 0) return;
      const position = horizontal ? event.clientX : event.clientY;
      node[horizontal ? 'scrollLeft' : 'scrollTop'] =
        drag.scrollOffset +
        ((position - drag.position) / travel) * (content - viewport);
    };

    const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = undefined;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          position: 'relative',
        }}
      >
        <ScrollView
          {...props}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
        <div
          ref={thumbRef}
          className="perp-table-overlay-scrollbar"
          data-orientation={horizontal ? 'horizontal' : 'vertical'}
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
        />
      </div>
    );
  },
);
