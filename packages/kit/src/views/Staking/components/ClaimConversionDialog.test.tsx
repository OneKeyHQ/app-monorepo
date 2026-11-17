import { Dialog } from '@onekeyhq/components';
import type { IEarnServerOrderWaitResult } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { runClaimConversion } from './ClaimConversionDialog';

import type { IClaimConversionParams } from './ClaimConversionDialog';

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Spinner: () => null,
  YStack: () => null,
}));
jest.mock('./StakeProgress', () => ({ StakeProgress: () => null }));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      requestServerExecutedClaim: jest.fn(),
      waitForServerExecutedOrder: jest.fn(),
    },
  },
}));

it.each(['success', 'failed'] as const)(
  'does not reopen a result dialog after dismissal and %s',
  async (status) => {
    jest.clearAllMocks();
    const show = jest.mocked(Dialog.show);
    const service = jest.mocked(backgroundApiProxy.serviceStaking);
    let settle!: (result: IEarnServerOrderWaitResult) => void;
    const waiting = new Promise<IEarnServerOrderWaitResult>((resolve) => {
      settle = resolve;
    });
    service.requestServerExecutedClaim.mockResolvedValue({
      status: 'accepted',
      orderId: 'order-a',
    });
    const waitForOrder = jest
      .spyOn(service, 'waitForServerExecutedOrder')
      .mockReturnValue(waiting);
    const close = jest.fn();
    show.mockReturnValue({ close } as unknown as ReturnType<
      typeof Dialog.show
    >);
    const params = {
      intl: { formatMessage: ({ id }: { id: string }) => id },
      request: {
        accountId: 'account-a',
        networkId: 'evm--56',
        provider: 'unitas',
        vault: 'vault-a',
        identity: 'convert',
      },
      symbol: 'USDT',
      amount: '1',
      withClaimStep: false,
    } as IClaimConversionParams;
    const outcome = runClaimConversion(params);
    await Promise.resolve();
    const progress = show.mock.calls[0][0];
    await progress.onClose?.();
    await expect(outcome).resolves.toBe('dismissed');
    expect(waitForOrder).toHaveBeenCalledWith({
      accountId: 'account-a',
      networkId: 'evm--56',
      orderId: 'order-a',
      refreshScope: { provider: 'unitas', vault: 'vault-a' },
    });
    settle({ status });
    await waiting;
    await Promise.resolve();
    expect(show).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  },
);
