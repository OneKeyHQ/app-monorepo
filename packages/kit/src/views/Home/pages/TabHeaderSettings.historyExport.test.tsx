/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { TabHeaderSettings } from './TabHeaderSettings';

const mockClosePopover = jest.fn(async () => undefined);
const mockPrimeEntryClick = jest.fn((_params?: unknown) => undefined);
const mockPushModal = jest.fn();
const mockPushFullModal = jest.fn();
const mockWait = jest.fn(async (_ms: number) => undefined);
const mockAuthState = {
  isPrimeSubscriptionActive: false,
};
const mockToolbarState = { enabled: false, selected: false };
const mockPopover = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function Box({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) {
    return React.createElement(
      onPress ? 'button' : 'div',
      { 'data-testid': testID, onClick: onPress },
      children,
    );
  }

  const Badge = Object.assign(
    ({ children }: { children?: ReactNode }) =>
      React.createElement('span', { 'data-testid': 'prime-badge' }, children),
    {
      Text: ({ children }: { children?: ReactNode }) =>
        React.createElement('span', null, children),
    },
  );

  return {
    Badge,
    ESwitchSize: { small: 'small' },
    IconButton: Box,
    Popover: ({
      renderContent,
      renderTrigger,
      open,
      onOpenChange,
    }: {
      renderContent?: ReactNode;
      renderTrigger?: ReactNode;
      open?: boolean;
      onOpenChange?: (value: boolean) => void;
    }) => {
      const contentType = React.isValidElement(renderContent)
        ? renderContent.type
        : undefined;
      mockPopover({
        open,
        onOpenChange,
        kind: typeof contentType === 'function' ? contentType.name : '',
      });
      return React.createElement('div', null, renderTrigger, renderContent);
    },
    SizableText: Box,
    Stack: Box,
    Switch: Box,
    XStack: Box,
    usePopoverContext: () => ({
      closePopover: mockClosePopover,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: mockAuthState.isPrimeSubscriptionActive,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: mockPushModal,
    pushFullModal: mockPushFullModal,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useIsDeFiEnabled', () => ({
  useIsDeFiEnabled: () => false,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [
    {
      isFilterScamHistoryEnabled: false,
      isFilterLowValueHistoryEnabled: false,
    },
    jest.fn(),
  ],
  useTokenSelectorFilterPersistAtom: () => [
    { homeShowLpTokensOnly: mockToolbarState.selected },
    jest.fn(),
  ],
}));

jest.mock('@onekeyhq/shared/src/config/presetNetworks', () => ({
  getNetworkIdsSupportFilterScamHistory: () => ['evm--1'],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshHistoryList: 'RefreshHistoryList' },
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeEntryClick: (params?: unknown) => {
          mockPrimeEntryClick(params);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: (ms: number) => mockWait(ms),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/tokenSelectorFilterUtils', () => ({
  isTokenSelectorDappTokenFilterSupportedNetwork: () =>
    mockToolbarState.enabled,
}));

jest.mock('../../../components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function ListItem({
    children,
    onPress,
    testID,
    title,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    title?: string;
  }) {
    return React.createElement(
      'button',
      { 'data-testid': testID, onClick: onPress, type: 'button' },
      title,
      children,
    );
  }
  ListItem.Text = ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => React.createElement('div', null, primary, secondary);
  return { ListItem };
});

jest.mock('../../../hooks/useManageToken', () => ({
  useManageToken: () => ({
    handleOnManageToken: jest.fn(),
    manageTokenEnabled: false,
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      network: { id: 'evm--1', name: 'Ethereum' },
    },
  }),
}));

describe('TabHeaderSettings history export entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.isPrimeSubscriptionActive = false;
    mockToolbarState.enabled = false;
    mockToolbarState.selected = false;
    mockClosePopover.mockResolvedValue(undefined);
    mockWait.mockResolvedValue(undefined);
  });

  it('keeps both native toolbar entries registered across focused tabs and LP updates', () => {
    mockToolbarState.enabled = true;
    const onConfig = jest.fn();
    const nativeToolbar = { onConfig };
    const { rerender, unmount } = render(
      <TabHeaderSettings
        focusedTab={ETranslations.global_history}
        nativeToolbar={nativeToolbar}
      />,
    );
    expect(onConfig).toHaveBeenCalledWith(
      EHomeWalletTab.Portfolio,
      expect.objectContaining({ selected: false }),
    );
    expect(onConfig).toHaveBeenCalledWith(
      EHomeWalletTab.History,
      expect.objectContaining({ selected: false }),
    );
    onConfig.mockClear();
    rerender(
      <TabHeaderSettings focusedTab="DeFi" nativeToolbar={nativeToolbar} />,
    );
    expect(onConfig).not.toHaveBeenCalled();
    mockToolbarState.selected = true;
    rerender(
      <TabHeaderSettings
        focusedTab={ETranslations.dexmarket_spot}
        nativeToolbar={nativeToolbar}
      />,
    );
    expect(onConfig.mock.calls).toEqual([
      [EHomeWalletTab.Portfolio, expect.objectContaining({ selected: true })],
    ]);
    onConfig.mockClear();
    unmount();
    expect(onConfig.mock.calls).toEqual([
      [EHomeWalletTab.Portfolio, undefined],
      [EHomeWalletTab.History, undefined],
    ]);
  });

  it('consumes each native request once and closes on tab or capability changes', () => {
    mockToolbarState.enabled = true;
    const onConfig = jest.fn();
    const press = {
      key: EHomeWalletTab.Portfolio,
      anchorRect: { x: 1, y: 2, width: 38, height: 38 },
    };
    const { rerender } = render(
      <TabHeaderSettings
        focusedTab={ETranslations.dexmarket_spot}
        nativeToolbar={{ onConfig, press }}
      />,
    );
    const latest = () =>
      ['TokenListSettingsContent', 'TxHistorySettingsContent'].map((kind) => {
        const value = [...mockPopover.mock.calls]
          .toReversed()
          .find(([props]) => props.kind === kind)?.[0];
        return value as {
          open: boolean;
          onOpenChange: (value: boolean) => void;
        };
      });
    expect(latest().map((value) => value.open)).toEqual([true, false]);
    act(() => latest()[0].onOpenChange(false));
    mockToolbarState.enabled = false;
    rerender(
      <TabHeaderSettings
        focusedTab={ETranslations.dexmarket_spot}
        nativeToolbar={{ onConfig, press }}
      />,
    );
    mockToolbarState.enabled = true;
    rerender(
      <TabHeaderSettings
        focusedTab={ETranslations.dexmarket_spot}
        nativeToolbar={{ onConfig, press }}
      />,
    );
    expect(latest().map((value) => value.open)).toEqual([false, false]);
    const historyPress = { ...press, key: EHomeWalletTab.History };
    rerender(
      <TabHeaderSettings
        focusedTab={ETranslations.global_history}
        nativeToolbar={{ onConfig, press: historyPress }}
      />,
    );
    expect(latest().map((value) => value.open)).toEqual([false, true]);
    rerender(
      <TabHeaderSettings focusedTab="DeFi" nativeToolbar={{ onConfig }} />,
    );
    expect(latest().map((value) => value.open)).toEqual([false, false]);
    rerender(
      <TabHeaderSettings
        focusedTab={ETranslations.global_history}
        nativeToolbar={{ onConfig, press: historyPress }}
      />,
    );
    expect(latest().map((value) => value.open)).toEqual([false, false]);
  });

  it.each([
    {
      label: 'active Prime',
      isPrimeSubscriptionActive: true,
    },
    {
      label: 'never subscribed',
      isPrimeSubscriptionActive: false,
    },
    {
      label: 'expired Prime',
      isPrimeSubscriptionActive: false,
    },
    {
      label: 'logged out',
      isPrimeSubscriptionActive: false,
    },
  ])(
    'opens export for $label users and keeps network params plus analytics',
    async ({ isPrimeSubscriptionActive }) => {
      mockAuthState.isPrimeSubscriptionActive = isPrimeSubscriptionActive;

      render(<TabHeaderSettings focusedTab={ETranslations.global_history} />);

      fireEvent.click(screen.getByTestId('home-export-transaction-history'));

      await waitFor(() =>
        expect(mockPushModal).toHaveBeenCalledWith(
          EModalRoutes.BulkExportHistoryModal,
          {
            screen: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
            params: { networkId: 'evm--1' },
          },
        ),
      );
      expect(mockClosePopover).toHaveBeenCalledTimes(1);
      expect(mockWait).toHaveBeenCalledWith(150);
      expect(mockPrimeEntryClick).toHaveBeenCalledWith({
        featureName: EPrimeFeatures.HistoryExport,
        entryPoint: 'historySettings',
        isPrimeActive: isPrimeSubscriptionActive,
      });
      expect(mockPushFullModal).not.toHaveBeenCalled();
      if (isPrimeSubscriptionActive) {
        expect(screen.queryByTestId('prime-badge')).toBeNull();
      } else {
        expect(screen.getByTestId('prime-badge')).toBeTruthy();
      }
    },
  );
});
