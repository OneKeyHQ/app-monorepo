/** @jest-environment jsdom */

import { Children, cloneElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';

import {
  Dialog,
  useBackHandler,
  type useInTabDialog,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IInternalTransferQuote } from '@onekeyhq/shared/types/hyperliquid/internalTransfer';
import type { IUserNonFundingLedgerUpdate } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { ModalPerpStack, perpRouters } from '../../../router';
import { AccountRow } from '../../OrderInfoPanel/Components/AccountRow';

import InternalTransferModal, {
  showInternalTransferDialog,
} from './InternalTransferModal';
import { showWithdrawMethodDialog } from './WithdrawMethodDialog';

type ITestDialogConfig = {
  dialogContainer: (params: { ref: { current: null } }) => ReactElement;
};

const account = {
  userAccountId: 'hd-1--evm--0',
  expectedAccountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};
let withdrawChannel = 'cctp';
const destination = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
let active = {
  accountId: account.userAccountId,
  accountAddress: account.expectedAccountAddress,
};
const getSources = jest.fn();
const getQuote = jest.fn();
const getTokens = jest.fn();
const getRecentRecipients = jest.fn();
const openRecentRecipients = jest.fn();
const usdc = {
  id: 'usdc-id',
  index: 0,
  symbol: 'USDC',
  token: 'USDC:usdc-id',
  decimals: 8,
  balance: '19',
  usdValue: '19',
};
const hype = {
  id: 'hype-id',
  index: 150,
  symbol: 'HYPE',
  token: 'HYPE:hype-id',
  decimals: 8,
  balance: '2',
  usdValue: '40',
};
const check = jest.fn();
const transfer = jest.fn();
const pushModal = jest.fn();
const goBack = jest.fn();
const successToast = jest.fn();
const closeDialog = jest.fn();
const dismissKeyboard = jest.fn();
const quote: IInternalTransferQuote = {
  ...account,
  destination,
  fee: '1',
  source: 'trading',
  sourceDex: 'spot',
  destinationDex: 'spot',
  maxAmount: '19',
  tokenId: usdc.id,
  asset: usdc,
};

jest.mock('@onekeyhq/kit/src/components/BaseInput', () => ({
  BaseInput: ({
    value,
    onChangeText,
    extension,
    testID,
    placeholder,
    disabled,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    extension: ReactNode;
    testID: string;
    placeholder: string;
    disabled: boolean;
  }) => (
    <>
      <textarea
        data-testid={testID}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChangeText(event.target.value)}
      />
      {extension}
    </>
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/components/AddressInput/plugins/clipboard',
  () => ({
    ClipboardPlugin: ({
      onChange,
      testID,
      disabled,
    }: {
      onChange: (value: { text: string }) => void;
      testID: string;
      disabled: boolean;
    }) => (
      <button
        data-testid={testID}
        disabled={disabled}
        onClick={() => onChange({ text: destination })}
      >
        Paste
      </button>
    ),
  }),
);

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => ({
    hostKey: 'perps-host',
    ownerKey: 'transfer-page',
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput',
  () => ({
    SendAutoSizeAmountInput: ({
      value,
      onChange,
      inputProps,
      extraContent,
    }: {
      value: string;
      onChange: (value: string) => void;
      inputProps: { editable: boolean };
      extraContent?: ReactNode;
    }) => (
      <>
        <input
          data-testid="perps-internal-transfer-amount"
          value={value}
          disabled={!inputProps.editable}
          onChange={(event) => onChange(event.target.value)}
        />
        {extraContent}
      </>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Send/pages/SendDataInput/RecipientQuickSelect',
  () => ({
    AccountRecipients: ({
      excludedAddress,
      onSelect,
    }: {
      excludedAddress: string;
      onSelect: (value: { address: string; name: string }) => void;
    }) => (
      <button
        data-testid="wallet-recipient"
        data-excluded-address={excludedAddress}
        onClick={() => onSelect({ address: destination, name: 'Account 2' })}
      >
        Account 2
      </button>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Send/pages/SendDataInput/QuickSelectListShared',
  () => ({
    QuickSelectListItemFrame: ({
      testID,
      primary,
      secondary,
      onPress,
    }: {
      testID: string;
      primary: ReactNode;
      secondary: ReactNode;
      onPress: () => void;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {primary}
        {secondary}
      </button>
    ),
  }),
);

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: ({ networkId }: { networkId: string }) => (
    <span data-testid="withdraw-network">{networkId}</span>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    children,
    onPress,
    testID,
    disabled,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
  }) => (
    <button data-testid={testID} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
  LazyLoadRootTabPage: () => () => null,
}));
jest.mock('@onekeyhq/kit/src/routes/Tab/RootTabLoadingFallback', () => ({
  RootTabLoadingFallback: () => null,
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: account }),
  useNavigation: () => ({ goBack }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [active],
  usePerpsCommonConfigPersistAtom: () => [
    { perpConfigCommon: { withdrawChannel } },
  ],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeAndroid: false, isNativeIOS: false },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidExchange: {
      getInternalTransferRecentRecipients: (params: unknown) =>
        getRecentRecipients(params) as Promise<
          { address: string; amount: string; token: string }[]
        >,
      getInternalTransferSources: () => getSources() as Promise<string[]>,
      getInternalTransferTokens: (params: unknown) =>
        getTokens(params) as Promise<(typeof usdc)[]>,
      getInternalTransferQuote: (params: unknown) =>
        getQuote(params) as Promise<IInternalTransferQuote>,
      checkInternalTransfer: (params: unknown) =>
        check(params) as Promise<unknown>,
      transferAssetInternally: (params: unknown) =>
        transfer(params) as Promise<string>,
    },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Page = Object.assign(Container, {
    Header: ({
      headerLeft,
      headerRight,
      unstable_headerLeftItems,
      headerSearchBarOptions,
    }: {
      headerLeft?: () => ReactNode;
      headerRight?: () => ReactNode;
      unstable_headerLeftItems?: () => { element: ReactNode }[];
      headerSearchBarOptions?: {
        placeholder: string;
        searchBarInputValue: string;
        onChangeText: (event: { nativeEvent: { text: string } }) => void;
      };
    }) => (
      <>
        {unstable_headerLeftItems
          ? unstable_headerLeftItems().map((item) => item.element)
          : headerLeft?.()}
        {headerRight?.()}
        {headerSearchBarOptions ? (
          <input
            data-testid="perps-internal-transfer-recipient"
            placeholder={headerSearchBarOptions.placeholder}
            value={headerSearchBarOptions.searchBarInputValue}
            onChange={(event) =>
              headerSearchBarOptions.onChangeText({
                nativeEvent: { text: event.target.value },
              })
            }
          />
        ) : null}
      </>
    ),
    Body: Container,
    Footer: ({ children }: { children?: ReactNode }) => (
      <div data-testid="page-footer">{children}</div>
    ),
  });
  return {
    glassBarItem: (element: ReactElement) => ({ element }),
    Page,
    NavBackButton: ({ onPress }: { onPress: () => void }) => (
      <button data-testid="header-back" onClick={onPress}>
        Back
      </button>
    ),
    NavCloseButton: ({ onPress }: { onPress: () => void }) => (
      <button data-testid="header-close" onClick={onPress}>
        Close
      </button>
    ),
    useBackHandler: jest.fn(),
    Toast: {
      success: (params: { title: string }) => {
        successToast(params);
      },
    },
    Dialog: { Header: () => null, show: jest.fn() },
    DialogContainer: ({
      renderContent,
      onClose,
      onBeforeClose,
      overlayPage,
      floatingPanelProps,
    }: {
      renderContent: ReactNode;
      onClose?: () => Promise<void>;
      onBeforeClose: () => boolean;
      overlayPage?: { ownerKey: string };
      floatingPanelProps?: { width: number };
    }) => (
      <div
        role="dialog"
        data-testid="transfer-review-dialog"
        data-owner={overlayPage?.ownerKey}
        data-width={floatingPanelProps?.width}
      >
        {renderContent}
        <button
          data-testid="review-dialog-close"
          onClick={() => {
            if (onBeforeClose()) void onClose?.();
          }}
        >
          Close review
        </button>
      </div>
    ),
    Keyboard: {
      dismiss: () => {
        dismissKeyboard();
      },
    },
    Icon: () => null,
    IconButton: ({
      testID,
      disabled,
      onPress,
      accessibilityLabel,
    }: {
      testID: string;
      disabled?: boolean;
      onPress?: () => void;
      accessibilityLabel: string;
    }) => (
      <button
        data-testid={testID}
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={onPress}
      />
    ),
    ScrollView: Container,
    Stack: ({
      children,
      onPress,
      onLongPress,
      accessibilityLabel,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      onLongPress?: () => void;
      accessibilityLabel?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        onClick={onPress}
        onContextMenu={onLongPress}
      >
        {children}
      </button>
    ),
    YStack: Container,
    XStack: Container,
    SizableText: Container,
    Empty: ({ title, description }: { title: string; description: string }) => (
      <div>
        {title}
        {description}
      </div>
    ),
    SegmentControl: ({
      value,
      options,
      onChange,
    }: {
      value: string;
      options: { label: string; value: string }[];
      onChange: (value: string) => void;
    }) => (
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
    Select: ({
      items,
      sections,
      value,
      onChange,
      disabled,
      testID,
      renderTrigger,
    }: {
      items?: { value: string; label: string }[];
      sections?: { title: string; data: { value: string; label: string }[] }[];
      value: string;
      onChange: (value: string) => void;
      disabled: boolean;
      testID: string;
      renderTrigger?: (props: {
        disabled: boolean;
        onPress: () => void;
      }) => ReactNode;
    }) => (
      <>
        {testID === 'perps-internal-transfer-recents'
          ? renderTrigger?.({ disabled, onPress: openRecentRecipients })
          : null}
        {sections?.map((section) => (
          <span key={section.title}>{section.title}</span>
        ))}
        <select
          data-testid={testID}
          aria-label="Account"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {(items ?? sections?.flatMap((section) => section.data) ?? []).map(
            (item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ),
          )}
        </select>
      </>
    ),
    Input: ({
      value,
      onChangeText,
      testID,
      disabled,
      addOns,
      placeholder,
      onPress,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      testID: string;
      disabled?: boolean;
      addOns?: { renderContent: ReactNode }[];
      placeholder?: string;
      onPress?: () => void;
    }) => (
      <div data-testid={`${testID}-container`}>
        <input
          data-testid={testID}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onClick={onPress}
          onChange={(event) => onChangeText(event.target.value)}
        />
        {Children.toArray(addOns?.map((addOn) => addOn.renderContent))}
      </div>
    ),
    Button: ({
      children,
      testID,
      onPress,
      disabled,
    }: {
      children: ReactNode;
      testID: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: jest.requireActual<
      typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
    >('../../../../../../../components/src/hooks/useDeferredPromise')
      .useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

function renderEntry() {
  const show = jest.fn().mockReturnValue({ close: closeDialog });
  showInternalTransferDialog(account, { show } as unknown as ReturnType<
    typeof useInTabDialog
  >);
  return render(
    (show.mock.calls[0][0] as ITestDialogConfig).dialogContainer({
      ref: { current: null },
    }) as ReactElement,
  );
}

describe('withdraw method selection', () => {
  it.each(['cctp', 'legacy'])(
    'shows network hints matching the %s withdrawal policy',
    (channel) => {
      withdrawChannel = channel;
      const show = jest.fn().mockReturnValue({ close: jest.fn() });
      jest.spyOn(Dialog, 'show').mockImplementation(show);
      showWithdrawMethodDialog({
        walletName: 'OneKey Wallet',
        onWithdraw: async () => undefined,
        onSend: async () => undefined,
        isTransferDisabled: false,
      });
      const screen = render(
        (show.mock.calls[0][0] as { renderContent: ReactElement })
          .renderContent,
      );
      expect(
        screen
          .getAllByTestId('withdraw-network')
          .map((node) => node.textContent),
      ).toEqual(
        channel === 'legacy'
          ? ['evm--42161']
          : ['evm--1', 'evm--43114', 'evm--10'],
      );
      expect(Boolean(screen.queryByText('+3'))).toBe(channel !== 'legacy');
      withdrawChannel = 'cctp';
    },
  );

  afterEach(() => jest.restoreAllMocks());
  it.each(['asset', 'send'])(
    'closes the menu before opening %s and ignores duplicate taps',
    async (method) => {
      let finishClose: () => void = () => undefined;
      const close = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishClose = resolve;
          }),
      );
      const show = jest.fn().mockReturnValue({ close });
      jest.spyOn(Dialog, 'show').mockImplementation(show);
      const onWithdraw = jest.fn(async () => undefined);
      const onSend = jest.fn(async () => undefined);
      showWithdrawMethodDialog({
        walletName: 'OneKey Wallet',
        onWithdraw,
        onSend,
        isTransferDisabled: false,
      });
      const config = show.mock.calls[0][0] as {
        title: string;
        renderContent: ReactElement;
      };
      expect(config.title).toBe('Select Method');
      const screen = render(config.renderContent);
      expect(screen.getByText('Transfer to OneKey Wallet')).toBeTruthy();
      const option = screen.getByTestId(`perps-withdraw-method-${method}`);
      fireEvent.click(option);
      fireEvent.click(option);
      expect(close).toHaveBeenCalledTimes(1);
      expect(onWithdraw).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
      await act(async () => finishClose());
      expect(method === 'asset' ? onWithdraw : onSend).toHaveBeenCalledTimes(1);
      expect(method === 'asset' ? onSend : onWithdraw).not.toHaveBeenCalled();
    },
  );

  it('keeps unavailable internal transfers disabled', () => {
    const close = jest.fn();
    const show = jest.fn().mockReturnValue({ close });
    jest.spyOn(Dialog, 'show').mockImplementation(show);
    const onSend = jest.fn(async () => undefined);
    showWithdrawMethodDialog({
      walletName: 'OneKey Wallet',
      onWithdraw: async () => undefined,
      onSend,
      isTransferDisabled: true,
    });
    const screen = render(
      (show.mock.calls[0][0] as { renderContent: ReactElement }).renderContent,
    );
    fireEvent.click(screen.getByTestId('perps-withdraw-method-send'));
    expect(onSend).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('HL internal transfer form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    account.userAccountId = 'hd-1--evm--0';
    Object.assign(platformEnv, {
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
      isNativeIOS26Plus: false,
    });
    active = {
      accountId: account.userAccountId,
      accountAddress: account.expectedAccountAddress,
    };
    getTokens.mockReset().mockResolvedValue([hype, usdc]);
    getRecentRecipients.mockReset().mockResolvedValue([]);
    getSources.mockReset().mockResolvedValue(['trading']);
    getQuote.mockReset().mockResolvedValue(quote);
    check.mockReset().mockResolvedValue({ status: 'none' });
    transfer.mockReset().mockResolvedValue('confirmed');
  });

  it('opens recent recipients by clicking the desktop address input and keeps it editable', async () => {
    getRecentRecipients.mockResolvedValue([
      { address: destination, amount: '12', token: 'HYPE' },
    ]);
    const screen = renderEntry();
    await screen.findByTestId('perps-internal-transfer-recents');
    const input = screen.getByTestId('perps-internal-transfer-recipient');

    fireEvent.click(input);
    expect(openRecentRecipients).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: destination } });
    expect((input as HTMLInputElement).value).toBe(destination);
    expect(transfer).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'fills only the address from recent recipients (mobile: %s)',
    async (mobile) => {
      getRecentRecipients.mockResolvedValue([
        { address: destination, amount: '12', token: 'HYPE' },
      ]);
      const show = jest.fn().mockReturnValue({ close: closeDialog });
      if (!mobile)
        showInternalTransferDialog(account, { show } as unknown as ReturnType<
          typeof useInTabDialog
        >);
      const screen = render(
        mobile ? (
          <InternalTransferModal />
        ) : (
          ((show.mock.calls[0][0] as ITestDialogConfig).dialogContainer({
            ref: { current: null },
          }) as ReactElement)
        ),
      );
      if (mobile) {
        await screen.findByTestId(
          `perps-internal-transfer-recent-${destination}`,
        );
        expect(screen.queryByTestId('wallet-recipient')).toBeNull();
        expect(
          screen.queryByTestId('perps-internal-transfer-continue'),
        ).toBeNull();
        fireEvent.change(
          screen.getByTestId('perps-internal-transfer-recipient'),
          {
            target: { value: 'unmatched' },
          },
        );
        expect(
          screen.getByText('No matching recipients', { exact: false }),
        ).toBeTruthy();
        expect(
          screen
            .getByTestId('perps-internal-transfer-continue')
            .hasAttribute('disabled'),
        ).toBe(true);
        fireEvent.click(
          screen.getByTestId('perps-internal-transfer-recipient-clear'),
        );
        expect(
          screen.queryByText('No matching recipients', { exact: false }),
        ).toBeNull();
        expect(
          screen.queryByTestId('perps-internal-transfer-continue'),
        ).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'My accounts' }));
        expect(screen.getByTestId('wallet-recipient')).toBeTruthy();
        expect(
          screen.queryByTestId(`perps-internal-transfer-recent-${destination}`),
        ).toBeNull();
        fireEvent.click(
          screen.getByRole('button', { name: 'Recent recipients' }),
        );
        fireEvent.click(
          await screen.findByTestId(
            `perps-internal-transfer-recent-${destination}`,
          ),
        );
        fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
          target: { value: '3' },
        });
        fireEvent.click(screen.getByTestId('header-back'));
        fireEvent.click(
          await screen.findByTestId(
            `perps-internal-transfer-recent-${destination}`,
          ),
        );
        expect(
          (
            screen.getByTestId(
              'perps-internal-transfer-amount',
            ) as HTMLInputElement
          ).value,
        ).toBe('3');
        expect(transfer).not.toHaveBeenCalled();
        await waitFor(() => expect(getQuote).toHaveBeenCalled());
        return;
      }
      const selector = await screen.findByTestId(
        'perps-internal-transfer-recents',
      );
      if (!mobile) expect(screen.getByText('Recent recipients')).toBeTruthy();
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '3' },
      });
      fireEvent.change(selector, { target: { value: destination } });
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-recipient',
          ) as HTMLInputElement
        ).value,
      ).toBe(destination);
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-amount',
          ) as HTMLInputElement
        ).value,
      ).toBe('3');
      await waitFor(() =>
        expect(getQuote).toHaveBeenCalledWith(
          expect.objectContaining({ destination, tokenId: usdc.id }),
        ),
      );
      expect(transfer).not.toHaveBeenCalled();
      active = { ...active, accountAddress: destination };
      screen.rerender(
        mobile ? (
          <InternalTransferModal />
        ) : (
          cloneElement(
            (show.mock.calls[0][0] as ITestDialogConfig).dialogContainer({
              ref: { current: null },
            }) as ReactElement,
          )
        ),
      );
      expect(
        screen.queryByTestId('perps-internal-transfer-recents'),
      ).toBeNull();
    },
  );

  it('keeps manual address entry available when recent history fails', async () => {
    getRecentRecipients.mockRejectedValue(new Error('offline'));
    const screen = renderEntry();
    await waitFor(() => expect(getRecentRecipients).toHaveBeenCalled());
    expect(screen.queryByTestId('perps-internal-transfer-recents')).toBeNull();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    await waitFor(() =>
      expect(getQuote).toHaveBeenCalledWith(
        expect.objectContaining({ destination }),
      ),
    );
  });

  it.each(['ios', 'android'])(
    'uses the withdrawal keypad for native amounts on %s',
    async (platform) => {
      Object.assign(platformEnv, {
        isNative: true,
        isNativeIOS: platform === 'ios',
        isNativeAndroid: platform === 'android',
      });
      const screen = render(<InternalTransferModal />);
      fireEvent.click(screen.getByTestId('wallet-recipient'));
      const input = screen.getByTestId(
        'perps-internal-transfer-amount',
      ) as HTMLInputElement;
      expect(input.disabled).toBe(true);
      const key = (name: string) => screen.getByRole('button', { name });
      fireEvent.click(key('.'));
      fireEvent.click(key('.'));
      fireEvent.click(key('1'));
      expect(input.value).toBe('0.1');
      fireEvent.click(key('Delete'));
      expect(input.value).toBe('0.');
      fireEvent.contextMenu(key('Delete'));
      expect(input.value).toBe('');
      fireEvent.click(key('0'));
      fireEvent.click(key('2'));
      expect(input.value).toBe('2');
      await waitFor(() => expect(getTokens).toHaveBeenCalled());
      active = { accountId: 'other', accountAddress: destination };
      screen.rerender(<InternalTransferModal />);
      fireEvent.click(key('3'));
      expect(input.value).toBe('2');
      expect(transfer).not.toHaveBeenCalled();
    },
  );

  it('uses the native iOS 26 back item to return to recipients without closing', async () => {
    Object.assign(platformEnv, {
      isNative: true,
      isNativeIOS: true,
      isNativeIOS26Plus: true,
    });
    const screen = render(<InternalTransferModal />);
    fireEvent.click(screen.getByTestId('wallet-recipient'));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByTestId('header-back'));
    expect(screen.getByPlaceholderText('Address or account name')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('wallet-recipient'));
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .value,
    ).toBe('2');
    await waitFor(() => expect(getTokens).toHaveBeenCalled());
    expect(transfer).not.toHaveBeenCalled();
  });

  it('selects a wallet recipient before entering an amount and retains it when going back', async () => {
    const screen = render(<InternalTransferModal />);
    expect(screen.getByPlaceholderText('Address or account name')).toBeTruthy();
    expect(screen.queryByTestId('perps-internal-transfer-amount')).toBeNull();
    expect(
      screen
        .getByTestId('wallet-recipient')
        .getAttribute('data-excluded-address'),
    ).toBe(account.expectedAccountAddress);
    fireEvent.click(screen.getByTestId('wallet-recipient'));
    expect(screen.queryByText('To')).toBeNull();
    expect(screen.queryByText('Account 2')).toBeNull();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '3' },
    });
    await waitFor(() =>
      expect(screen.getByText('Trading Account')).toBeTruthy(),
    );
    expect(screen.queryByTestId('perps-internal-transfer-source')).toBeNull();
    fireEvent.click(screen.getByTestId('header-back'));
    expect(screen.queryByTestId('perps-internal-transfer-amount')).toBeNull();
    expect(screen.getByPlaceholderText('Address or account name')).toBeTruthy();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    expect(
      (
        screen.getByTestId(
          'perps-internal-transfer-recipient',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe(destination);
    expect(screen.queryByTestId('wallet-recipient')).toBeNull();
    expect(screen.queryByText('My accounts')).toBeNull();
    fireEvent.click(
      screen.getByTestId('perps-internal-transfer-recipient-clear'),
    );
    expect(screen.getByTestId('wallet-recipient')).toBeTruthy();
    fireEvent.click(
      screen.getByTestId('perps-internal-transfer-recipient-paste'),
    );
    fireEvent.click(screen.getByTestId('perps-internal-transfer-continue'));
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .value,
    ).toBe('3');
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
    expect(screen.getByText(destination)).toBeTruthy();
    expect(
      screen
        .getByTestId('transfer-review-dialog')
        .contains(screen.getByTestId('perps-internal-transfer-confirm')),
    ).toBe(true);
    expect(
      screen
        .getByTestId('page-footer')
        .contains(screen.getByTestId('perps-internal-transfer-confirm')),
    ).toBe(false);
    expect(
      screen.getByTestId('transfer-review-dialog').getAttribute('data-owner'),
    ).toBe('transfer-page');
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId('review-dialog-close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .value,
    ).toBe('3');
    expect(transfer).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android', 'web'])(
    'retains token and amount when changing recipients on %s',
    async (platform) => {
      Object.assign(platformEnv, {
        isNative: platform !== 'web',
        isNativeAndroid: platform === 'android',
        isNativeIOS: platform === 'ios',
      });
      getQuote.mockImplementation(async (params: IInternalTransferQuote) => ({
        ...quote,
        ...params,
        asset: params.tokenId === hype.id ? hype : usdc,
        maxAmount: params.tokenId === hype.id ? hype.balance : usdc.balance,
        fee: '0',
      }));
      const screen = render(<InternalTransferModal />);
      expect(
        screen.queryByTestId('perps-internal-transfer-continue'),
      ).toBeNull();
      fireEvent.change(
        screen.getByTestId('perps-internal-transfer-recipient'),
        { target: { value: account.expectedAccountAddress } },
      );
      expect(
        screen
          .getByTestId('perps-internal-transfer-continue')
          .hasAttribute('disabled'),
      ).toBe(true);
      expect(getQuote).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('wallet-recipient'));
      await screen.findByRole('option', { name: 'HYPE' });
      fireEvent.change(screen.getByTestId('perps-internal-transfer-token'), {
        target: { value: hype.id },
      });
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '0.25' },
      });
      fireEvent.click(screen.getByTestId('header-back'));
      const nextRecipient = '0xcccccccccccccccccccccccccccccccccccccccc';
      fireEvent.change(
        screen.getByTestId('perps-internal-transfer-recipient'),
        { target: { value: nextRecipient } },
      );
      fireEvent.click(screen.getByTestId('perps-internal-transfer-continue'));
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-amount',
          ) as HTMLInputElement
        ).value,
      ).toBe('0.25');
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-token',
          ) as HTMLSelectElement
        ).value,
      ).toBe(hype.id);
      await waitFor(() =>
        expect(
          screen
            .getByTestId('perps-internal-transfer-review')
            .hasAttribute('disabled'),
        ).toBe(false),
      );
      expect(screen.queryByText('Activation fee')).toBeNull();
      fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
      expect(screen.getByText(nextRecipient)).toBeTruthy();
      expect(screen.getByText('0.25 HYPE')).toBeTruthy();
      if (platform === 'android') {
        const [, enabled] = jest.mocked(useBackHandler).mock.calls.at(-1)!;
        expect(enabled).toBe(false);
      }
      fireEvent.click(screen.getByTestId('review-dialog-close'));
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-amount',
          ) as HTMLInputElement
        ).value,
      ).toBe('0.25');
      expect(transfer).not.toHaveBeenCalled();
    },
  );

  it('opens the shared form in a wider desktop dialog', async () => {
    const close = jest.fn();
    const show = jest.fn().mockReturnValue({ close });
    showInternalTransferDialog(account, { show } as unknown as ReturnType<
      typeof useInTabDialog
    >);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        dialogContainer: expect.any(Function),
      }),
    );
    const screen = render(
      (show.mock.calls[0][0] as ITestDialogConfig).dialogContainer({
        ref: { current: null },
      }) as ReactElement,
    );
    expect(screen.getByRole('dialog').getAttribute('data-width')).toBe('480');
    expect(screen.queryByTestId('page-footer')).toBeNull();
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-max')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    expect(screen.getByPlaceholderText('Recipient address')).toBeTruthy();
  });

  it('keeps Perps as the default tab and registers transfers only in the modal stack', () => {
    expect(perpRouters[0].name).toBe(ETabRoutes.Perp);
    expect(
      perpRouters.some(
        ({ name }) => name === EModalPerpRoutes.InternalTransfer,
      ),
    ).toBe(false);
    expect(
      ModalPerpStack.some(
        ({ name }) => name === EModalPerpRoutes.InternalTransfer,
      ),
    ).toBe(true);
  });

  async function enterReview(mobile = true) {
    const show = jest.fn().mockReturnValue({ close: closeDialog });
    if (!mobile)
      showInternalTransferDialog(account, { show } as unknown as ReturnType<
        typeof useInTabDialog
      >);
    const screen = render(
      mobile ? (
        <InternalTransferModal />
      ) : (
        ((show.mock.calls[0][0] as ITestDialogConfig).dialogContainer({
          ref: { current: null },
        }) as ReactElement)
      ),
    );
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    if (mobile)
      fireEvent.click(screen.getByTestId('perps-internal-transfer-continue'));
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '10' },
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
    return screen;
  }

  it.each([
    [true, false],
    [false, false],
    [true, true],
    [false, true],
    [true, undefined],
    [false, undefined],
  ])(
    'shows the recipient warning only for an explicit false status (mobile: %s, userHasSentTx: %s)',
    async (mobile, userHasSentTx) => {
      getQuote.mockResolvedValue({ ...quote, userHasSentTx });
      const screen = await enterReview(mobile);
      expect(
        Boolean(
          screen.queryByText(/This recipient has never sent a transaction/),
        ),
      ).toBe(userHasSentTx === false);
      expect(transfer).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
      await waitFor(() =>
        expect(transfer).toHaveBeenCalledWith(
          expect.objectContaining({ expectedUserHasSentTx: userHasSentTx }),
        ),
      );
    },
  );

  it.each([
    [true, '0'],
    [false, '0.0'],
    [true, '1'],
    [false, '1'],
  ])(
    'shows activation fees only when charged and omits receive in (mobile: %s, fee: %s)',
    async (mobile, fee) => {
      getQuote.mockResolvedValue({ ...quote, fee });
      const screen = await enterReview(mobile);
      const hasFee = fee === '1';
      const confirmation = within(screen.getByRole('dialog'));
      expect(Boolean(confirmation.queryByText('Activation fee'))).toBe(hasFee);
      expect(
        Boolean(
          confirmation.queryByText(/The activation fee is charged separately/),
        ),
      ).toBe(hasFee);
      expect(confirmation.queryByText('Receive in')).toBeNull();
      expect(transfer).not.toHaveBeenCalled();
    },
  );

  it('switches the existing desktop dialog from the wider form to compact confirmation', async () => {
    const screen = renderEntry();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-width')).toBe('480');
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '10' },
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(dialog.getAttribute('data-width')).toBe('400');
    expect(
      within(dialog).getByTestId('perps-internal-transfer-confirm'),
    ).toBeTruthy();
    expect(screen.queryByTestId('perps-internal-transfer-amount')).toBeNull();
    expect(transfer).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'hd-1--evm--0', 'Confirm'],
    [false, 'hd-1--evm--0', 'Confirm'],
    [true, 'hw-1--evm--0', 'Confirm on device'],
    [false, 'hw-1--evm--0', 'Confirm on device'],
  ] as const)(
    'labels confirmation for the signing wallet (mobile: %s, account: %s)',
    async (mobile, accountId, label) => {
      account.userAccountId = accountId;
      active.accountId = accountId;
      const screen = await enterReview(mobile);
      expect(
        screen.getByTestId('perps-internal-transfer-confirm').textContent,
      ).toBe(label);
      expect(transfer).not.toHaveBeenCalled();
    },
  );

  it('requires review and passes the reviewed recipient, source and fee to signing', async () => {
    const screen = await enterReview();
    expect(transfer).not.toHaveBeenCalled();
    expect(screen.getAllByText(destination).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
    await waitFor(() =>
      expect(successToast).toHaveBeenCalledWith({
        title: 'Transfer confirmed',
      }),
    );
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(successToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Transfer confirmed')).toBeNull();
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledWith({
      ...account,
      destination,
      amount: '10',
      expectedFee: '1',
      expectedSourceDex: 'spot',
      expectedDestinationDex: 'spot',
      source: 'trading',
      tokenId: usdc.id,
      expectedToken: usdc.token,
    });
  });

  it('disables confirmation when the active account changes', async () => {
    const screen = await enterReview();
    active = { ...active, accountAddress: destination };
    screen.rerender(<InternalTransferModal />);
    expect(
      screen
        .getByTestId('perps-internal-transfer-confirm')
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
    expect(transfer).not.toHaveBeenCalled();
  });

  it('keeps the confirmation dialog open and prevents duplicate submissions while signing', async () => {
    let finish: (value: string) => void = () => {};
    transfer.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const screen = await enterReview();
    fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
    fireEvent.click(screen.getByTestId('review-dialog-close'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
    expect(transfer).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish('confirmed');
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(successToast).toHaveBeenCalledWith({ title: 'Transfer confirmed' });
  });

  it('keeps the account selector available with a single source', async () => {
    const screen = renderEntry();
    await waitFor(() =>
      expect(screen.getByText('Trading Account')).toBeTruthy(),
    );
    const sourceSelect = screen.getByTestId(
      'perps-internal-transfer-source',
    ) as HTMLSelectElement;
    expect(sourceSelect.disabled).toBe(false);
    expect(sourceSelect.options).toHaveLength(1);
    expect(sourceSelect.selectedOptions[0].textContent).toBe('Trading Account');
    expect(screen.getByTestId('perps-internal-transfer-token')).toBeTruthy();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '1' },
    });
    fireEvent.change(sourceSelect, { target: { value: 'trading' } });
    fireEvent.change(screen.getByTestId('perps-internal-transfer-token'), {
      target: { value: usdc.id },
    });
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .value,
    ).toBe('1');
  });

  it('clears the amount and requests a new quote when switching standard accounts', async () => {
    getSources.mockResolvedValue(['perps', 'spot']);
    getQuote.mockImplementation(async (params: IInternalTransferQuote) => ({
      ...quote,
      source: params.source,
      sourceDex: params.source === 'perps' ? '' : 'spot',
      destinationDex: params.source === 'perps' ? '' : 'spot',
    }));
    const screen = renderEntry();
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-source')
          .querySelectorAll('option'),
      ).toHaveLength(2),
    );
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '10' },
    });
    await waitFor(() =>
      expect(getQuote).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'perps' }),
      ),
    );
    fireEvent.change(screen.getByTestId('perps-internal-transfer-source'), {
      target: { value: 'spot' },
    });
    expect(
      (screen.getByTestId('perps-internal-transfer-amount') as HTMLInputElement)
        .value,
    ).toBe('');
    expect(
      screen
        .getByTestId('perps-internal-transfer-review')
        .hasAttribute('disabled'),
    ).toBe(true);
    await waitFor(() =>
      expect(getQuote).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'spot' }),
      ),
    );
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '10' },
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
    fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
    await waitFor(() =>
      expect(transfer).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'spot',
          expectedSourceDex: 'spot',
          expectedDestinationDex: 'spot',
        }),
      ),
    );
    await waitFor(() =>
      expect(successToast).toHaveBeenCalledWith({
        title: 'Transfer confirmed',
      }),
    );
  });

  it('blocks review when account mode could not be loaded', async () => {
    getSources.mockRejectedValue(new Error('Unable to load account mode'));
    const screen = renderEntry();
    await waitFor(() =>
      expect(screen.getByText('Unable to load account mode')).toBeTruthy(),
    );
    expect(
      screen
        .getByTestId('perps-internal-transfer-review')
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('does not apply a late quote to a different recipient', async () => {
    let resolveQuote: (value: IInternalTransferQuote) => void = () => undefined;
    getQuote.mockImplementationOnce(
      () =>
        new Promise<IInternalTransferQuote>((resolve) => {
          resolveQuote = resolve;
        }),
    );
    const screen = renderEntry();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '10' },
    });
    await waitFor(() => expect(getQuote).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: 'invalid' },
    });
    await act(async () => resolveQuote(quote));
    expect(
      screen
        .getByTestId('perps-internal-transfer-review')
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(transfer).not.toHaveBeenCalled();
  });

  it('restores an uncertain transfer and offers status checks without another send', async () => {
    check.mockResolvedValue({
      status: 'pending',
      pending: { nonce: 123, amount: '10', destination, sourceDex: 'spot' },
    });
    const screen = renderEntry();
    await waitFor(() =>
      expect(screen.getByText('Transfer not yet confirmed')).toBeTruthy(),
    );
    expect(screen.queryByTestId('perps-internal-transfer-review')).toBeNull();
    expect(successToast).not.toHaveBeenCalled();
    expect(closeDialog).not.toHaveBeenCalled();
    check.mockResolvedValue({ status: 'confirmed' });
    fireEvent.click(screen.getByText('Check status'));
    await waitFor(() => expect(closeDialog).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledTimes(2);
    expect(successToast).toHaveBeenCalledWith({ title: 'Transfer confirmed' });
    expect(successToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Transfer confirmed')).toBeNull();
    expect(transfer).not.toHaveBeenCalled();
  });

  it.each([
    { asset: hype, displaySymbol: 'HYPE' },
    {
      asset: { ...hype, id: 'ueth-id', symbol: 'UETH', token: 'UETH:ueth-id' },
      displaySymbol: 'ETH',
    },
  ])(
    'displays $displaySymbol and sends the original token identity',
    async ({ asset, displaySymbol }) => {
      getTokens.mockResolvedValue([asset, usdc]);
      getQuote.mockImplementation(async (params: IInternalTransferQuote) => ({
        ...quote,
        tokenId: params.tokenId,
        asset: params.tokenId === asset.id ? asset : usdc,
        maxAmount: params.tokenId === asset.id ? '2' : '19',
      }));
      const screen = renderEntry();
      await waitFor(() =>
        expect(
          screen.getByRole('option', { name: displaySymbol }),
        ).toBeTruthy(),
      );
      expect(getQuote).not.toHaveBeenCalled();
      fireEvent.change(
        screen.getByTestId('perps-internal-transfer-recipient'),
        {
          target: { value: destination },
        },
      );
      await waitFor(() => expect(screen.getByText('Max 19 USDC')).toBeTruthy());
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '10' },
      });
      fireEvent.change(screen.getByTestId('perps-internal-transfer-token'), {
        target: { value: asset.id },
      });
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-amount',
          ) as HTMLInputElement
        ).value,
      ).toBe('');
      await waitFor(() =>
        expect(screen.getByText(`Max 2 ${displaySymbol}`)).toBeTruthy(),
      );
      await waitFor(() =>
        expect(
          screen
            .getByTestId('perps-internal-transfer-max')
            .hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.click(screen.getByTestId('perps-internal-transfer-max'));
      await waitFor(() =>
        expect(
          screen
            .getByTestId('perps-internal-transfer-review')
            .hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.click(screen.getByTestId('perps-internal-transfer-review'));
      expect(screen.getByText(`2 ${displaySymbol}`)).toBeTruthy();
      fireEvent.click(screen.getByTestId('perps-internal-transfer-confirm'));
      await waitFor(() =>
        expect(transfer).toHaveBeenCalledWith(
          expect.objectContaining({
            tokenId: asset.id,
            expectedToken: asset.token,
            amount: '2',
          }),
        ),
      );
      await waitFor(() =>
        expect(successToast).toHaveBeenCalledWith({
          title: 'Transfer confirmed',
        }),
      );
    },
  );
  it('does not apply a late quote after the selected token changes', async () => {
    let resolveQuote: (value: IInternalTransferQuote) => void = () => undefined;
    getQuote.mockImplementation(
      () =>
        new Promise<IInternalTransferQuote>((resolve) => {
          resolveQuote = resolve;
        }),
    );
    const screen = renderEntry();
    fireEvent.change(screen.getByTestId('perps-internal-transfer-recipient'), {
      target: { value: destination },
    });
    await waitFor(() => expect(getQuote).toHaveBeenCalled());
    const resolveUsdc = resolveQuote;
    fireEvent.change(screen.getByTestId('perps-internal-transfer-token'), {
      target: { value: hype.id },
    });
    fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
      target: { value: '1' },
    });
    await act(async () => resolveUsdc(quote));
    expect(screen.queryByText('Max 19 USDC')).toBeNull();
    expect(
      screen
        .getByTestId('perps-internal-transfer-review')
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(transfer).not.toHaveBeenCalled();
  });

  it('blocks sending when tokens fail to load', async () => {
    getTokens.mockRejectedValue(new Error('Tokens unavailable'));
    const screen = renderEntry();
    await waitFor(() =>
      expect(screen.getByText('Tokens unavailable')).toBeTruthy(),
    );
    expect(
      screen
        .getByTestId('perps-internal-transfer-review')
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(getQuote).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'keeps token units and stablecoin fees separate in history (mobile: %s)',
    (isMobile) => {
      const update: IUserNonFundingLedgerUpdate = {
        time: 1,
        hash: '0x123',
        delta: {
          type: 'send',
          user: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          destination: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          sourceDex: 'spot',
          destinationDex: 'spot',
          token: 'UETH',
          amount: '1.12345678',
          usdcValue: '20',
          fee: '1',
          feeToken: 'USDC',
          nativeTokenFee: '0',
          nonce: 123,
        },
      };
      const screen = render(
        <AccountRow
          update={update}
          index={0}
          isMobile={isMobile}
          cellMinWidth={600}
          columnConfigs={Array.from({ length: 5 }, (_, index) => ({
            key: `${index}`,
            title: '',
            minWidth: 100,
            align: 'left' as const,
          }))}
        />,
      );
      expect(screen.getByText('- 1.12345678 ETH')).toBeTruthy();
      expect(screen.getByText(/1 USDC/)).toBeTruthy();
      expect(screen.queryByText(/2.12345678/)).toBeNull();
    },
  );

  it.each([true, false])(
    'uses withdrawal-style amount errors (mobile: %s)',
    async (mobile) => {
      const screen = mobile ? render(<InternalTransferModal />) : renderEntry();
      if (mobile) {
        fireEvent.click(screen.getByTestId('wallet-recipient'));
      } else {
        fireEvent.change(
          screen.getByTestId('perps-internal-transfer-recipient'),
          {
            target: { value: destination },
          },
        );
      }
      await waitFor(() =>
        expect(
          screen
            .getByTestId('perps-internal-transfer-max')
            .hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.click(screen.getByTestId('perps-internal-transfer-max'));
      expect(
        (
          screen.getByTestId(
            'perps-internal-transfer-amount',
          ) as HTMLInputElement
        ).value,
      ).toBe('19');
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '20' },
      });
      expect(await screen.findByText('Insufficient balance')).toBeTruthy();
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(true);
      expect(screen.queryByText(/decimal places/)).toBeNull();
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '0.000000001' },
      });
      await waitFor(() =>
        expect(screen.getByText(/up to 8 decimal places/)).toBeTruthy(),
      );
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(true);
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '0' },
      });
      expect(screen.queryByText(/decimal places/)).toBeNull();
      expect(screen.queryByText('Enter a valid amount.')).toBeNull();
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(true);
      fireEvent.change(screen.getByTestId('perps-internal-transfer-amount'), {
        target: { value: '1' },
      });
      expect(screen.getByText('Review')).toBeTruthy();
      expect(
        screen
          .getByTestId('perps-internal-transfer-review')
          .hasAttribute('disabled'),
      ).toBe(false);
      expect(transfer).not.toHaveBeenCalled();
    },
  );
});
