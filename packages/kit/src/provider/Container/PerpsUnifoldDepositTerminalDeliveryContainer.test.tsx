/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { PerpsUnifoldDepositTerminalDeliveryContainer } from './PerpsUnifoldDepositTerminalDeliveryContainer';

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    autoPrintErrorIgnore: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    perp_deposit_fail_title: 'perp_deposit_fail_title',
    perp_deposit_success_title: 'perp_deposit_success_title',
    perp_unifold_contact_support_ref__desc:
      'perp_unifold_contact_support_ref__desc',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: jest.fn(() => 'claim-1'),
}));

jest.mock('@onekeyhq/shared/src/utils/unifoldDepositUtils', () => ({
  formatUnifoldUsdAmount: jest.fn(() => '$12.34'),
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceUnifoldDeposit: {
      acknowledgeTerminalDelivery: jest.fn(),
      getPendingTerminalDeliveries: jest.fn(),
      tryClaimTerminalDelivery: jest.fn(),
    },
  },
}));

const mockService = backgroundApiProxy.serviceUnifoldDeposit as unknown as {
  acknowledgeTerminalDelivery: jest.Mock;
  getPendingTerminalDeliveries: jest.Mock;
  tryClaimTerminalDelivery: jest.Mock;
};
const mockToast = Toast as unknown as {
  error: jest.Mock;
  success: jest.Mock;
};

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PerpsUnifoldDepositTerminalDeliveryContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockService.getPendingTerminalDeliveries.mockResolvedValue([]);
    mockService.tryClaimTerminalDelivery.mockResolvedValue({
      status: 'claimed',
      delivery: {
        deliveryId: 'delivery-1',
        sessionId: 'session-1',
        execution: {
          status: 'succeeded',
          destinationAmountUsd: '12.34',
          sourceAmountUsd: '12.34',
        },
      },
      expiresAt: Date.now() + 30_000,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('retries only ACK with the original claim after the Toast is shown', async () => {
    mockService.acknowledgeTerminalDelivery
      .mockRejectedValueOnce(new OneKeyLocalError('ipc failed'))
      .mockResolvedValueOnce({ updated: false })
      .mockResolvedValueOnce({ updated: true });
    const { unmount } = render(
      <PerpsUnifoldDepositTerminalDeliveryContainer />,
    );
    await flushPromises();

    act(() => {
      appEventBus.emit(EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery, {
        deliveryId: 'delivery-1',
      });
    });
    await flushPromises();

    expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1050);
    });
    expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1050);
    });
    expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(3);
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenNthCalledWith(3, {
      deliveryId: 'delivery-1',
      claimId: 'claim-1',
    });

    unmount();
  });

  it.each(['gone', 'claimLost'] as const)(
    'stops ACK retries when the delivery is permanently %s',
    async (reason) => {
      mockService.acknowledgeTerminalDelivery.mockResolvedValue({
        updated: false,
        reason,
      });
      const { unmount } = render(
        <PerpsUnifoldDepositTerminalDeliveryContainer />,
      );
      await flushPromises();

      act(() => {
        appEventBus.emit(
          EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery,
          {
            deliveryId: 'delivery-1',
          },
        );
      });
      await flushPromises();

      expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledTimes(1);
      expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(1);

      unmount();
    },
  );

  it('keeps the presented claim while exponentially retrying ACK failures', async () => {
    mockService.acknowledgeTerminalDelivery.mockRejectedValue(
      new OneKeyLocalError('ipc failed'),
    );
    const { unmount } = render(
      <PerpsUnifoldDepositTerminalDeliveryContainer />,
    );
    await flushPromises();

    act(() => {
      appEventBus.emit(EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery, {
        deliveryId: 'delivery-1',
      });
    });
    await flushPromises();

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1050);
      });
    }
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(5);
    expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2049);
    });
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(5);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(6);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(4049);
    });
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(6);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(7);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    const acknowledgementCallsAfterClaimExpiry =
      mockService.acknowledgeTerminalDelivery.mock.calls.length;

    act(() => {
      appEventBus.emit(EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery, {
        deliveryId: 'delivery-1',
      });
    });
    await flushPromises();

    expect(mockService.acknowledgeTerminalDelivery).toHaveBeenCalledTimes(
      acknowledgementCallsAfterClaimExpiry + 1,
    );
    expect(mockService.tryClaimTerminalDelivery).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledTimes(1);

    unmount();
  });
});
