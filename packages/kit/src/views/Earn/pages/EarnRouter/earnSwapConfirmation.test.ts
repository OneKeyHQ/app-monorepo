import { isTaskAccountCurrent } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getEarnFunding } from './earnFundingRegistry';
import { confirmEarnSwap } from './earnRouterSwap';

import type { IEarnSwapPrepared } from './earnRouterSwap';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils',
  () => ({
    buildMarketExecutionPayload: jest.fn(),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils', () => ({
  checkSwapLatestBalanceSufficient: jest.fn(),
}));
jest.mock('../../tasks/taskAccount', () => ({
  isTaskAccountCurrent: jest.fn(),
}));
jest.mock('./earnFundingRegistry', () => ({
  getEarnFunding: jest.fn(),
}));

type INavigate = Parameters<typeof confirmEarnSwap>[0]['navigateToConfirm'];

const payer = {
  accountId: 'payer',
  networkId: 'evm--1',
  address: '0xpayer',
};
const fromToken: ISwapToken = {
  contractAddress: '0xpay',
  decimals: 6,
  networkId: payer.networkId,
  symbol: 'PAY',
};
const toToken: ISwapToken = {
  ...fromToken,
  contractAddress: '0xdeposit',
  symbol: 'DEPOSIT',
};
const fact = {
  accountId: payer.accountId,
  networkId: payer.networkId,
  txid: 'swap-tx',
  uuid: 'unsigned-id',
};

function startConfirmation({ approval = false } = {}) {
  const buildRes = {
    result: {
      info: { provider: 'fixture', providerName: 'Fixture' },
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
    },
  };
  const prepared: IEarnSwapPrepared = {
    buildRes,
    payer,
    receiver: payer,
    validUntil: Date.now() + 60_000,
    approvesInfo: approval
      ? [{ owner: payer.address, spender: '0xspender', amount: '1' }]
      : [],
    execution: {
      encodedTx: {
        from: payer.address,
        to: '0xswap',
        value: '0',
        data: '0x02',
      },
      swapInfo: {
        protocol: EProtocolOfExchange.SWAP,
        accountAddress: payer.address,
        receivingAddress: payer.address,
        sender: { token: fromToken, amount: '1', accountInfo: payer },
        receiver: { token: toToken, amount: '4', accountInfo: payer },
        swapBuildResData: buildRes,
      },
      skipSendTransAction: false,
    },
  };
  const reservation = {
    markUnknown: jest.fn(async (): Promise<void> => undefined),
    markSubmitted: jest.fn(async (txId: string) => {
      jest
        .mocked(getEarnFunding)
        .mockReturnValue({ status: 'submitted', txId });
    }),
    markFunded: jest.fn(async (): Promise<void> => undefined),
    release: jest.fn(async (): Promise<void> => undefined),
  };
  const onAccepted = jest.fn(async (): Promise<void> => undefined);
  const navigate = jest.fn<ReturnType<INavigate>, Parameters<INavigate>>(
    async () => undefined,
  );
  const isCurrent = jest.fn(() => true);
  const result = confirmEarnSwap({
    prepared,
    reservation,
    fundingKey: 'funding',
    isCurrent,
    signal: new AbortController().signal,
    navigateToConfirm: navigate,
    onAccepted,
  });
  const confirm = navigate.mock.calls[0]?.[0];
  if (!confirm) throw new OneKeyLocalError('Confirmation did not open');
  return { prepared, reservation, onAccepted, confirm, result, isCurrent };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(isTaskAccountCurrent).mockResolvedValue(true);
});

it('releases a setup failure without claiming a possible broadcast', async () => {
  const { confirm, result, reservation } = startConfirmation();
  confirm.onFail?.(new Error('setup failed'));
  await expect(result).rejects.toThrow('setup failed');
  expect(reservation.markUnknown).not.toHaveBeenCalled();
  expect(reservation.release).toHaveBeenCalledTimes(1);
});

it('retains an uncertain wallet confirmation failure even before the send guard', async () => {
  const { confirm, result, reservation } = startConfirmation();
  confirm.onConfirmationFail?.(new Error('provider result unknown'));
  await expect(result).rejects.toThrow('provider result unknown');
  await expect(confirm.onBeforeSend?.()).rejects.toThrow('unknown');
  confirm.onSafePreSendFail?.(new Error('retry blocked'));
  expect(reservation.markUnknown).toHaveBeenCalledTimes(1);
  expect(reservation.release).not.toHaveBeenCalled();
});

it('cancels an in-flight claim before the wallet can send', async () => {
  const { confirm, result, reservation } = startConfirmation();
  let finishClaim: (() => void) | undefined;
  let claimStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    claimStarted = resolve;
  });
  reservation.markUnknown.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishClaim = resolve;
        claimStarted?.();
      }),
  );
  const beforeSend = confirm.onBeforeSend?.();
  await started;
  confirm.onCancel?.();
  expect(reservation.release).not.toHaveBeenCalled();
  finishClaim?.();
  await expect(beforeSend).rejects.toThrow('cancelled');
  await expect(result).resolves.toBeUndefined();
  expect(reservation.release).toHaveBeenCalledTimes(1);
});

it('rechecks quote expiry after the funding claim', async () => {
  const { confirm, prepared, result, reservation } = startConfirmation();
  reservation.markUnknown.mockImplementation(async () => {
    prepared.validUntil = Date.now() - 1;
  });
  await expect(confirm.onBeforeSend?.()).rejects.toThrow('noRoute');
  confirm.onSafePreSendFail?.(new Error('quote expired'));
  await expect(result).rejects.toThrow('quote expired');
  expect(reservation.release).toHaveBeenCalledTimes(1);
});

it('records the verified single swap after closing and rejects facts from other accounts or networks', async () => {
  const { confirm, result, reservation, onAccepted } = startConfirmation();
  await confirm.onBeforeSend?.();
  confirm.onCancel?.();
  await expect(result).resolves.toBeUndefined();

  await confirm.onLateBroadcastAccepted?.({ ...fact, accountId: 'other' });
  await confirm.onLateBroadcastAccepted?.({ ...fact, networkId: 'evm--10' });
  expect(reservation.markSubmitted).not.toHaveBeenCalled();

  await Promise.all([
    confirm.onLateBroadcastAccepted?.(fact),
    confirm.onLateBroadcastAccepted?.(fact),
  ]);
  expect(reservation.markSubmitted).toHaveBeenCalledTimes(1);
  expect(reservation.markSubmitted).toHaveBeenCalledWith('swap-tx');
  expect(onAccepted).toHaveBeenCalledTimes(1);
  expect(onAccepted).toHaveBeenCalledWith('swap-tx', undefined);
  expect(reservation.release).not.toHaveBeenCalled();
});

it('keeps a late mixed batch unknown because its hash could belong to an approval', async () => {
  const { confirm, result, reservation, onAccepted } = startConfirmation({
    approval: true,
  });
  await confirm.onBeforeSend?.();
  confirm.onCancel?.();
  await expect(result).resolves.toBeUndefined();

  await confirm.onLateBroadcastAccepted?.(fact);
  expect(reservation.markUnknown).toHaveBeenCalledTimes(1);
  expect(reservation.markSubmitted).not.toHaveBeenCalled();
  expect(onAccepted).not.toHaveBeenCalled();
  expect(reservation.release).not.toHaveBeenCalled();
});
