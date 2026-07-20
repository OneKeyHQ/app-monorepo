/** @jest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { PrimeGlobalEffectLazy } from './PrimeGlobalEffectLazy';

const mockPrimeGlobalEffectRender = jest.fn();

jest.mock('../../views/Prime/hooks/PrimeGlobalEffect', () => ({
  PrimeGlobalEffect: () => {
    mockPrimeGlobalEffectRender();
    return null;
  },
}));

describe('PrimeGlobalEffectLazy', () => {
  let emitSpy: jest.SpyInstance;
  let emitToSelfSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit');
    emitToSelfSpy = jest.spyOn(appEventBus, 'emitToSelf');
  });

  afterEach(() => {
    cleanup();
    emitSpy.mockRestore();
    emitToSelfSpy.mockRestore();
  });

  it('replays an early purchase event only inside the current UI runtime', async () => {
    render(<PrimeGlobalEffectLazy />);

    act(() => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        payload: { onekeyUserId: 'user-a' },
        isRemote: false,
      });
    });

    await waitFor(() => expect(mockPrimeGlobalEffectRender).toHaveBeenCalled());
    await waitFor(() => {
      const purchaseEventCalls = emitToSelfSpy.mock.calls.filter(
        ([params]) =>
          params.type === EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      );
      expect(purchaseEventCalls).toHaveLength(2);
      expect(purchaseEventCalls[1]?.[0]).toEqual({
        type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        payload: { onekeyUserId: 'user-a' },
        isRemote: false,
      });
    });
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      expect.anything(),
    );
  });
});
