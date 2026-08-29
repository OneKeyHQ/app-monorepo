import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { confirmCexDepositIfUnsupported } from './confirmCexDepositIfUnsupported';

import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
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

describe('confirmCexDepositIfUnsupported', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not mark the warning acknowledged when deposit is still allowed', async () => {
    await expect(
      confirmCexDepositIfUnsupported({
        intl,
        networkId: 'evm--1',
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
  });

  it('does not reopen the dialog after the warning was acknowledged', async () => {
    await expect(
      confirmCexDepositIfUnsupported({
        intl,
        networkId: 'evm--56',
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
  });

  it('resolves only after the confirm close teardown completes', async () => {
    const resultPromise = confirmCexDepositIfUnsupported({
      intl,
      networkId: 'evm--1',
      tokenSymbol: 'DAI',
      networkName: 'Ethereum',
      cexSupportedInfo: {
        cexLabel: 'Binance',
        depositEnable: false,
      },
    });
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

    finishClose?.();
    await confirmPromise;

    await expect(resultPromise).resolves.toEqual({
      canProceed: true,
      hasAcknowledgedWarning: true,
    });
  });

  it('resolves false only after one cancel close teardown completes', async () => {
    const resultPromise = confirmCexDepositIfUnsupported({
      intl,
      networkId: 'evm--1',
      cexSupportedInfo: {
        cexLabel: 'Binance',
        depositEnable: false,
      },
    });
    const options = mockedDialogShow.mock.calls[0][0];
    expect(options.renderContent).toMatchObject({
      props: {
        exchangeName: 'Binance',
        exchangeLabel: ETranslations.exchange__title,
      },
    });
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

    options.onCancel?.(close);
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(hasResolved).toBe(false);

    finishClose?.();

    await expect(resultPromise).resolves.toEqual({
      canProceed: false,
      hasAcknowledgedWarning: false,
    });
  });
});
