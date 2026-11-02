/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useSwapDefaultConfigDecision } from './useSwapDefaultConfigDecision';

import type { ISwapDefaultConfigStatus } from '../utils/swapColdStartTokenCacheUtils';

describe('default configuration intent ownership', () => {
  const initialStatusRef: { current: ISwapDefaultConfigStatus } = {
    current: 'pending',
  };

  beforeEach(() => {
    initialStatusRef.current = 'pending';
  });

  function renderDecision() {
    return renderHook(
      (props: {
        intentKey: string;
        networkConfigStatus: ISwapDefaultConfigStatus;
      }) => useSwapDefaultConfigDecision({ ...props, initialStatusRef }),
      {
        initialProps: {
          intentKey: 'a',
          networkConfigStatus: 'pending' as ISwapDefaultConfigStatus,
        },
      },
    );
  }

  it('reads the bounded initial decision even when its mount effect resets warm status', () => {
    initialStatusRef.current = 'success';
    const { result } = renderDecision();
    initialStatusRef.current = 'pending';
    expect(result.current.getDefaultConfigStatus()).toBe('pending');
    initialStatusRef.current = 'failed';
    expect(result.current.getDefaultConfigStatus()).toBe('failed');
  });

  it('keeps the current fallback but uses ready configuration for a new intent and A-B-A', () => {
    const { result, rerender } = renderDecision();
    initialStatusRef.current = 'failed';
    rerender({ intentKey: 'a', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('failed');
    rerender({ intentKey: 'b', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('success');
    rerender({ intentKey: 'a', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('success');
  });

  it('does not adopt configuration arriving after a subsequent intent already fell back', () => {
    const { result, rerender } = renderDecision();
    initialStatusRef.current = 'failed';
    rerender({ intentKey: 'b', networkConfigStatus: 'pending' });
    expect(result.current.defaultConfigStatus).toBe('failed');
    rerender({ intentKey: 'b', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('failed');
    rerender({ intentKey: 'c', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('success');
  });

  it('lets a pending subsequent intent settle against the existing deadline', () => {
    const { result, rerender } = renderDecision();
    rerender({ intentKey: 'b', networkConfigStatus: 'pending' });
    expect(result.current.getDefaultConfigStatus()).toBe('pending');
    initialStatusRef.current = 'failed';
    rerender({ intentKey: 'b', networkConfigStatus: 'success' });
    expect(result.current.defaultConfigStatus).toBe('failed');
  });
});
