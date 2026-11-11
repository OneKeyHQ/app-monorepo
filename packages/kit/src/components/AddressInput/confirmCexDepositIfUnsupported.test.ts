import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

import { createIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { confirmCexDepositIfUnsupported } from './confirmCexDepositIfUnsupported';

const sendCexDepositWarningShow = jest.fn();
const sendCexDepositWarningAction = jest.fn();

jest.mock('@onekeyhq/components', () => {
  function Component() {
    return null;
  }
  const Item = Object.assign(Component, { Key: Component, Value: Component });
  const DescriptionList = Object.assign(Component, { Item });
  return {
    DescriptionList,
    Dialog: {
      show: jest.fn(),
    },
    SizableText: Component,
    YStack: Component,
  };
});

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
    isLightningNetworkByNetworkId: jest.fn(
      (networkId?: string) => networkId === 'lightning',
    ),
  },
}));

const intl = createIntl({
  locale: 'en',
  messages: {} as Parameters<typeof createIntl>[0]['messages'],
});

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
    exchangeDisplayName: 'Binance',
    ...extra,
  });
}

function getTextValues(node: ReactNode): string[] {
  if (typeof node === 'string') {
    return [node];
  }
  if (typeof node === 'number') {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap(getTextValues);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextValues(node.props.children);
  }
  return [];
}

function getDialogContentText(element: ReactElement): string[] {
  const renderContent = element.type as unknown as (
    props: unknown,
  ) => ReactNode;
  return getTextValues(renderContent(element.props));
}

const incompleteWarningCases: {
  name: string;
  extra: Partial<Parameters<typeof confirmCexDepositIfUnsupported>[0]>;
  missingLabel: string;
  title: string;
  visibleValues: string[];
}[] = [
  {
    name: 'exchange',
    extra: {
      cexSupportedInfo: {
        depositEnable: false,
      },
    },
    missingLabel: ETranslations.exchange__title,
    title: 'This exchange may not accept this deposit',
    visibleValues: ['DAI', 'Ethereum'],
  },
  {
    name: 'asset',
    extra: {
      tokenSymbol: undefined,
    },
    missingLabel: ETranslations.global_asset,
    title: 'Binance may not accept this deposit',
    visibleValues: ['Binance', 'Ethereum'],
  },
  {
    name: 'network',
    extra: {
      networkName: undefined,
    },
    missingLabel: ETranslations.global_network,
    title: 'Binance may not accept this deposit',
    visibleValues: ['Binance', 'DAI'],
  },
];

describe('confirmCexDepositIfUnsupported', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([true, null, undefined])(
    'does not show or acknowledge a warning when deposits are %s',
    async (depositEnable) => {
      await expect(
        confirmCexDepositIfUnsupported({
          intl,
          networkId: 'evm--1',
          page: 'address',
          cexSupportedInfo: {
            cexLabel: 'Binance',
            depositEnable,
          },
        }),
      ).resolves.toEqual({
        canProceed: true,
        hasAcknowledgedWarning: false,
      });
      expect(mockedDialogShow).not.toHaveBeenCalled();
      expect(sendCexDepositWarningShow).not.toHaveBeenCalled();
      expect(sendCexDepositWarningAction).not.toHaveBeenCalled();
    },
  );

  it.each([
    { networkId: 'lightning', isNFT: false, label: 'Lightning transfers' },
    { networkId: 'evm--1', isNFT: true, label: 'NFT transfers' },
  ])('does not show a warning for $label', async ({ networkId, isNFT }) => {
    await expect(
      confirmCexDepositIfUnsupported({
        intl,
        networkId,
        isNFT,
        page: 'address',
        cexSupportedInfo: {
          cexLabel: 'Binance',
          depositEnable: false,
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
    expect(options.icon).toBe('ErrorOutline');
    expect(options.tone).toBe('warning');
    expect(options.title).toBe('Binance may not accept this deposit');
    expect(options.renderContent).toMatchObject({
      props: {
        tokenSymbol: 'DAI',
        networkName: 'Ethereum',
        networkLabel: ETranslations.global_network,
        assetLabel: ETranslations.global_asset,
        exchangeName: 'Binance',
        exchangeLabel: ETranslations.exchange__title,
        body: 'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
      },
    });
    expect(options).toMatchObject({
      onConfirmText: ETranslations.global_continue_anyway,
      onCancelText: ETranslations.global_back,
      confirmButtonProps: {
        testID: 'cex-deposit-unsupported-confirm-btn',
        variant: 'secondary',
      },
      cancelButtonProps: {
        testID: 'cex-deposit-unsupported-cancel-btn',
        variant: 'primary',
      },
      footerProps: {
        flexDirection: 'row-reverse',
        $md: {
          flexDirection: 'column',
        },
      },
    });
    const contentText = getDialogContentText(
      options.renderContent as ReactElement,
    );
    expect(contentText).toEqual(
      expect.arrayContaining([
        ETranslations.exchange__title,
        ETranslations.global_asset,
        ETranslations.global_network,
        'DAI',
        'Ethereum',
        'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
      ]),
    );
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

  it.each(incompleteWarningCases)(
    'omits the missing $name row and uses fallback wording',
    ({ extra, missingLabel, title, visibleValues }) => {
      void showUnsupportedWarning(extra);
      const options = mockedDialogShow.mock.calls[0][0];

      expect(options.title).toBe(title);
      const contentText = getDialogContentText(
        options.renderContent as ReactElement,
      );
      expect(contentText).not.toContain(missingLabel);
      for (const value of visibleValues) {
        expect(contentText).toContain(value);
      }
      expect(contentText).toContain(
        'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
      );
    },
  );

  it('keeps the full exchange name in the title without repeating it in the body', () => {
    const exchange = 'Coinbase International Digital Asset Exchange';
    void showUnsupportedWarning({
      cexSupportedInfo: { cexLabel: exchange, depositEnable: false },
      exchangeDisplayName: exchange,
      tokenSymbol: 'USDT0',
      networkName: 'Arbitrum One',
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options.title).toBe(`${exchange} may not accept this deposit`);
    expect(options.renderContent).toMatchObject({
      props: {
        exchangeName: exchange,
        tokenSymbol: 'USDT0',
        networkName: 'Arbitrum One',
        body: 'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
      },
    });
  });

  it('keeps the same risk copy when all details are missing', () => {
    void showUnsupportedWarning({
      cexSupportedInfo: { depositEnable: false },
      tokenSymbol: undefined,
      networkName: undefined,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options.title).toBe('This exchange may not accept this deposit');
    expect(getDialogContentText(options.renderContent as ReactElement)).toEqual(
      [
        'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
      ],
    );
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
