import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/binanceDeposit';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { buildBinanceDepositSendHooks } from './binanceDepositSendHooks';

import type { IntlShape } from 'react-intl';

const mockVerifyBeforeSign = jest.fn<Promise<void>, unknown[]>();
const mockReportDeposit = jest.fn<Promise<void>, unknown[]>();
const mockToastError = jest.fn<void, unknown[]>();
const mockVerifyFailEvent = jest.fn<void, unknown[]>();

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      verifyBeforeSign: (...args: unknown[]) => mockVerifyBeforeSign(...args),
      reportDeposit: (...args: unknown[]) => mockReportDeposit(...args),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        binanceDepositVerifyFail: (...args: unknown[]) =>
          mockVerifyFailEvent(...args),
      },
    },
  },
}));

const mockFormatMessage = jest.fn(
  ({ id }: { id: string }, _values?: Record<string, unknown>) => id,
);
const intl = { formatMessage: mockFormatMessage } as unknown as IntlShape;

const CONTEXT: IBinanceDepositSendContext = {
  localId: 'local-1',
  networkId: 'evm--56',
  cryptoCurrency: 'USDT',
  minAmount: '1',
};
const TO_ADDRESS = '0x1111111111111111111111111111111111111111';
const SENDER = '0x2222222222222222222222222222222222222222';

function buildHooks(
  onSuccess?: (txs: ISendTxOnSuccessData[]) => void,
  context: IBinanceDepositSendContext = CONTEXT,
  extra: {
    amount?: string;
    onMinimumChange?: (minAmount: string) => void;
  } = {},
) {
  return buildBinanceDepositSendHooks({
    intl,
    context,
    toAddress: TO_ADDRESS,
    accountId: 'hd-1--0',
    senderAddress: SENDER,
    onSuccess,
    ...extra,
  });
}

function sentTxs(tx: { txid?: string; owner?: string }) {
  return [
    {
      signedTx: { txid: tx.txid },
      decodedTx: { owner: tx.owner },
    },
  ] as unknown as ISendTxOnSuccessData[];
}

beforeEach(() => {
  mockVerifyBeforeSign.mockReset();
  mockReportDeposit.mockReset();
  mockFormatMessage.mockClear();
  mockToastError.mockReset();
  mockVerifyFailEvent.mockReset();
});

describe('buildBinanceDepositSendHooks onBeforeSend', () => {
  it('lets the signing go on while the address still stands', async () => {
    mockVerifyBeforeSign.mockResolvedValue(undefined);

    await expect(buildHooks().onBeforeSend()).resolves.toBeUndefined();

    expect(mockVerifyBeforeSign).toHaveBeenCalledWith({
      localId: 'local-1',
      toAddress: TO_ADDRESS,
      memo: undefined,
      accountId: 'hd-1--0',
      unsignedTx: undefined,
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('stops the signing on a conflict and reports it without the address', async () => {
    mockVerifyBeforeSign.mockRejectedValue({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });

    await expect(buildHooks().onBeforeSend()).rejects.toMatchObject({
      autoToast: false,
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.binance_deposit_verify_failed__title,
      message: ETranslations.binance_deposit_verify_failed__desc,
    });
    expect(mockVerifyFailEvent).toHaveBeenCalledWith({
      network: 'evm--56',
      tokenSymbol: 'USDT',
      type: 'conflict',
      errorCode: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
  });

  it('leaves a Max send to the check, which holds it against the latest minimum', async () => {
    mockVerifyBeforeSign.mockResolvedValue(undefined);

    // Below the minimum this page read, which may have been lowered since.
    await expect(
      buildHooks().onBeforeSend({ nativeMaxSendAmount: '0.99' }),
    ).resolves.toBeUndefined();

    expect(mockVerifyBeforeSign).toHaveBeenCalledWith(
      expect.objectContaining({ nativeMaxSendAmount: '0.99' }),
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('hands the prepared transaction to the check and names the minimum when it is not met', async () => {
    const unsignedTx = { encodedTx: {} } as never;
    mockVerifyBeforeSign.mockRejectedValue({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    await expect(
      buildHooks().onBeforeSend({ unsignedTxs: [unsignedTx] }),
    ).rejects.toMatchObject({ autoToast: false });

    expect(mockVerifyBeforeSign).toHaveBeenCalledWith({
      localId: 'local-1',
      toAddress: TO_ADDRESS,
      memo: undefined,
      accountId: 'hd-1--0',
      unsignedTx,
    });
    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.send_error_minimum_amount,
    });
    expect(mockVerifyFailEvent).toHaveBeenCalledWith({
      network: 'evm--56',
      tokenSymbol: 'USDT',
      type: 'below_minimum',
      errorCode: EBinanceDepositLocalErrorCode.BelowMinimum,
    });
  });

  it('names the minimum the amount was held against and hands it back for the amount page', async () => {
    // The session opened without a minimum; the server names one now.
    mockVerifyBeforeSign.mockRejectedValue({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
      data: { minAmount: '8' },
    });
    const onMinimumChange = jest.fn();

    await expect(
      buildHooks(
        undefined,
        { ...CONTEXT, minAmount: undefined },
        { amount: '6', onMinimumChange },
      ).onBeforeSend(),
    ).rejects.toMatchObject({ autoToast: false });

    expect(mockVerifyBeforeSign).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '6' }),
    );
    expect(onMinimumChange).toHaveBeenCalledWith('8');
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.send_error_minimum_amount },
      { amount: '8', token: 'USDT' },
    );
  });

  it('names the minimum it knows when the refusal carries none', async () => {
    mockVerifyBeforeSign.mockRejectedValue({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });
    const onMinimumChange = jest.fn();

    await expect(
      buildHooks(undefined, CONTEXT, { onMinimumChange }).onBeforeSend(),
    ).rejects.toMatchObject({ autoToast: false });

    expect(onMinimumChange).not.toHaveBeenCalled();
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.send_error_minimum_amount },
      { amount: '1', token: 'USDT' },
    );
  });

  it.each([undefined, { mayPayForPreSend: false }])(
    'waits until signing to check when preparation cannot charge (%p)',
    async (preSend) => {
      const hooks = buildHooks();
      await hooks.onBeforePreActions(preSend);
      expect(mockVerifyBeforeSign).not.toHaveBeenCalled();

      await hooks.onBeforeSend();
      expect(mockVerifyBeforeSign).toHaveBeenCalledTimes(1);
    },
  );

  it('checks before paid preparation and again before signing', async () => {
    mockVerifyBeforeSign.mockResolvedValue(undefined);
    const hooks = buildHooks(undefined, CONTEXT, { amount: '6' });

    await hooks.onBeforePreActions({ mayPayForPreSend: true });

    expect(mockVerifyBeforeSign).toHaveBeenCalledWith({
      localId: 'local-1',
      toAddress: TO_ADDRESS,
      memo: undefined,
      accountId: 'hd-1--0',
      unsignedTx: undefined,
      amount: '6',
      nativeMaxSendAmount: undefined,
    });
    await hooks.onBeforeSend();
    expect(mockVerifyBeforeSign).toHaveBeenCalledTimes(2);
  });

  it('stops the send before the pre-send actions when the check refuses it', async () => {
    // Nothing is paid for yet at this point (a TRON energy rental comes next).
    mockVerifyBeforeSign.mockRejectedValue({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
      data: { minAmount: '8' },
    });

    await expect(
      buildHooks(undefined, CONTEXT, { amount: '6' }).onBeforePreActions({
        mayPayForPreSend: true,
      }),
    ).rejects.toMatchObject({ autoToast: false });

    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.send_error_minimum_amount,
    });
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.send_error_minimum_amount },
      { amount: '8', token: 'USDT' },
    );
  });

  it('asks to confirm again when the check got no answer', async () => {
    mockVerifyBeforeSign.mockRejectedValue(new Error('timeout'));

    await expect(buildHooks().onBeforeSend()).rejects.toBeDefined();

    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.binance_deposit_verify_unavailable__title,
      message: ETranslations.binance_deposit_verify_unavailable__desc,
    });
  });
});

describe('buildBinanceDepositSendHooks onSuccess', () => {
  it('reports the broadcast with the signing account and passes it on', () => {
    mockReportDeposit.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    const txs = sentTxs({ txid: 'tx-1', owner: '0xowner' });

    buildHooks(onSuccess).onSuccess(txs);

    expect(mockReportDeposit).toHaveBeenCalledWith({
      localId: 'local-1',
      txid: 'tx-1',
      senderAddress: '0xowner',
    });
    expect(onSuccess).toHaveBeenCalledWith(txs);
  });

  it('falls back to the sender address when the decoded tx has no owner', () => {
    mockReportDeposit.mockResolvedValue(undefined);

    buildHooks().onSuccess(sentTxs({ txid: 'tx-1' }));

    expect(mockReportDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ senderAddress: SENDER }),
    );
  });

  it('skips the report without a txid and still passes the send on', () => {
    const onSuccess = jest.fn();

    buildHooks(onSuccess).onSuccess(sentTxs({}));

    expect(mockReportDeposit).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('never fails the send when the report fails', async () => {
    mockReportDeposit.mockRejectedValue(new Error('offline'));
    const onSuccess = jest.fn();

    expect(() =>
      buildHooks(onSuccess).onSuccess(sentTxs({ txid: 'tx-1' })),
    ).not.toThrow();
    await Promise.resolve();

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
