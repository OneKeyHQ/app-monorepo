import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { confirmCexDepositIfUnsupported } from './confirmCexDepositIfUnsupported';

import type { IntlShape } from 'react-intl';

const sendCexDepositWarningShow = jest.fn();
const sendCexDepositWarningAction = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        sendCexDepositWarningShow: (params: unknown) => {
          sendCexDepositWarningShow(params);
        },
        sendCexDepositWarningAction: (params: unknown) => {
          sendCexDepositWarningAction(params);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isLightningNetworkByNetworkId: jest.fn(() => false),
  },
}));

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

const warningContext = {
  network: 'evm--1',
  tokenSymbol: 'DAI',
  exchange: 'binance',
  page: 'address' as const,
};

function showUnsupportedWarning(
  extra?: Partial<Parameters<typeof confirmCexDepositIfUnsupported>[0]>,
) {
  return confirmCexDepositIfUnsupported({
    intl,
    networkId: warningContext.network,
    tokenSymbol: warningContext.tokenSymbol,
    networkName: 'Ethereum',
    page: warningContext.page,
    cexSupportedInfo: {
      cexLabel: 'Binance',
      depositEnable: false,
    },
    ...extra,
  });
}

describe('confirmCexDepositIfUnsupported', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not mark the warning acknowledged when deposit is still allowed', async () => {
    await expect(
      confirmCexDepositIfUnsupported({
        intl,
        networkId: 'evm--1',
        page: 'address',
        cexSupportedInfo: {
          cexLabel: 'Binance',
          depositEnable: true,
        },
      }),
    ).resolves.toEqual({
      canProceed: true,
      hasAcknowledgedWarning: false,
    });
    expect(mockedDialogShow).not.toHaveBeenCalled();
    expect(sendCexDepositWarningShow).not.toHaveBeenCalled();
    expect(sendCexDepositWarningAction).not.toHaveBeenCalled();
  });

  it('does not reopen the dialog after the warning was acknowledged', async () => {
    await expect(
      confirmCexDepositIfUnsupported({
        intl,
        networkId: 'evm--56',
        page: 'amount',
        cexSupportedInfo: {
          cexLabel: 'Binance',
          depositEnable: false,
        },
        hasAcknowledgedWarning: true,
      }),
    ).resolves.toEqual({
      canProceed: true,
      hasAcknowledgedWarning: true,
    });
    expect(mockedDialogShow).not.toHaveBeenCalled();
    expect(sendCexDepositWarningShow).not.toHaveBeenCalled();
    expect(sendCexDepositWarningAction).not.toHaveBeenCalled();
  });

  it('resolves only after the confirm close teardown completes', async () => {
    const resultPromise = showUnsupportedWarning();
    const options = mockedDialogShow.mock.calls[0][0];
    expect(options.description).toBeUndefined();
    expect(options.renderContent).toMatchObject({
      props: {
        tokenSymbol: 'DAI',
        networkName: 'Ethereum',
        networkLabel: ETranslations.global_network,
        exchangeName: 'Binance',
        exchangeLabel: ETranslations.exchange__title,
        body: ETranslations.cex_deposit_may_not_be_supported__desc,
      },
    });
    expect(options).toMatchObject({
      title: ETranslations.cex_deposit_may_not_be_supported__title,
      onConfirmText: ETranslations.global_continue,
      onCancelText: ETranslations.global_back,
      confirmButtonProps: {
        variant: 'secondary',
      },
      cancelButtonProps: {
        variant: 'primary',
      },
    });
    expect(sendCexDepositWarningShow).toHaveBeenCalledWith(warningContext);
    const onConfirm = options.onConfirm;
    expect(onConfirm).toEqual(expect.any(Function));

    let finishClose: (() => void) | undefined;
    const close = jest.fn(
      (extra?: { flag?: string }) =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            void options.onClose?.(extra);
            resolve();
          };
        }),
    );
    let hasResolved = false;
    void resultPromise.then(() => {
      hasResolved = true;
    });

    const confirmPromise = onConfirm?.({
      close,
      getForm: () => undefined,
      isExist: () => true,
      preventClose: jest.fn(),
    });
    await Promise.resolve();

    expect(close).toHaveBeenCalledWith({ flag: 'confirm' });
    expect(hasResolved).toBe(false);
    expect(sendCexDepositWarningAction).not.toHaveBeenCalled();

    finishClose?.();
    await confirmPromise;

    await expect(resultPromise).resolves.toEqual({
      canProceed: true,
      hasAcknowledgedWarning: true,
    });
    expect(sendCexDepositWarningAction).toHaveBeenCalledTimes(1);
    expect(sendCexDepositWarningAction).toHaveBeenCalledWith({
      ...warningContext,
      action: 'continue',
    });
  });

  it('resolves false only after one cancel close teardown completes', async () => {
    const resultPromise = showUnsupportedWarning();
    const options = mockedDialogShow.mock.calls[0][0];
    expect(options.renderContent).toMatchObject({
      props: {
        exchangeName: 'Binance',
        exchangeLabel: ETranslations.exchange__title,
      },
    });
    let finishClose: (() => void) | undefined;
    const close = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            void options.onClose?.({ flag: 'cancel' });
            resolve();
          };
        }),
    );
    let hasResolved = false;
    void resultPromise.then(() => {
      hasResolved = true;
    });

    options.onCancel?.(close);
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(hasResolved).toBe(false);
    expect(sendCexDepositWarningAction).not.toHaveBeenCalled();

    finishClose?.();

    await expect(resultPromise).resolves.toEqual({
      canProceed: false,
      hasAcknowledgedWarning: false,
    });
    expect(sendCexDepositWarningAction).toHaveBeenCalledTimes(1);
    expect(sendCexDepositWarningAction).toHaveBeenCalledWith({
      ...warningContext,
      action: 'back',
    });
  });

  it('logs close when the dialog is dismissed without a flag', async () => {
    const resultPromise = showUnsupportedWarning();
    const options = mockedDialogShow.mock.calls[0][0];

    void options.onClose?.();

    await expect(resultPromise).resolves.toEqual({
      canProceed: false,
      hasAcknowledgedWarning: false,
    });
    expect(sendCexDepositWarningShow).toHaveBeenCalledWith(warningContext);
    expect(sendCexDepositWarningAction).toHaveBeenCalledTimes(1);
    expect(sendCexDepositWarningAction).toHaveBeenCalledWith({
      ...warningContext,
      action: 'close',
    });
  });

  it('logs unknown exchange when cexLabel is missing', async () => {
    const resultPromise = showUnsupportedWarning({
      cexSupportedInfo: {
        depositEnable: false,
      },
    });
    const options = mockedDialogShow.mock.calls[0][0];

    void options.onClose?.();
    await resultPromise;

    expect(sendCexDepositWarningShow).toHaveBeenCalledWith({
      ...warningContext,
      exchange: 'unknown',
    });
  });

  it('logs only one action when onClose runs twice', async () => {
    const resultPromise = showUnsupportedWarning();
    const options = mockedDialogShow.mock.calls[0][0];

    void options.onClose?.({ flag: 'confirm' });
    void options.onClose?.({ flag: 'cancel' });
    await resultPromise;

    expect(sendCexDepositWarningAction).toHaveBeenCalledTimes(1);
    expect(sendCexDepositWarningAction).toHaveBeenCalledWith({
      ...warningContext,
      action: 'continue',
    });
  });
});
