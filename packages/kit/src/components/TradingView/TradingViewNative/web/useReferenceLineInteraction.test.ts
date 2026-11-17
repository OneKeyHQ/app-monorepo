/** @jest-environment jsdom */

import type { PointerEvent } from 'react';

import { renderHook } from '@testing-library/react';

import { useReferenceLineInteraction } from './useReferenceLineInteraction';

import type { ITradingViewNativeReferenceLineHitRegion } from '../utils/chartComponentScene';

describe('reference line interaction', () => {
  it('blocks interactions through loading and disabled labels', () => {
    const canvas = document.createElement('canvas');
    const hit: ITradingViewNativeReferenceLineHitRegion = {
      id: 'order-1',
      action: 'cancel',
      price: 100,
      rect: { x: 0, y: 0, width: 20, height: 20 },
    };
    const hitRegionsRef = { current: [hit] };
    const { result } = renderHook(() =>
      useReferenceLineInteraction({
        components: [],
        enabled: true,
        hitRegionsRef,
        projectionRef: { current: null },
        redrawRef: { current: jest.fn() },
        onAction: jest.fn(),
      }),
    );
    const event = {
      currentTarget: canvas,
      clientX: 10,
      clientY: 10,
    } as PointerEvent<HTMLCanvasElement>;
    expect(result.current.onPointerMove(event)).toBe(true);
    expect(canvas.style.cursor).toBe('pointer');

    for (const pending of [{ loadingColor: '#00aa00' }, { disabled: true }]) {
      hitRegionsRef.current = [
        { ...hit, id: 'neighbor-order', action: 'drag' },
        { ...hit, ...pending },
      ];
      canvas.style.cursor = 'crosshair';
      expect(result.current.onPointerMove(event)).toBe(false);
      expect(canvas.style.cursor).toBe('crosshair');
    }
  });
});
