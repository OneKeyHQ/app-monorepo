/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { TabHeaderSettings } from './TabHeaderSettings';

const mockClosePopover = jest.fn(async () => undefined);
const mockPrimeEntryClick = jest.fn((_params?: unknown) => undefined);
const mockPushModal = jest.fn();
const mockPushFullModal = jest.fn();
const mockWait = jest.fn(async (_ms: number) => undefined);
const mockAuthState = {
  isPrimeSubscriptionActive: false,
};

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
    }: {
      renderContent?: ReactNode;
      renderTrigger?: ReactNode;
    }) => React.createElement('div', null, renderTrigger, renderContent),
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
    { homeShowLpTokensOnly: false },
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
  isTokenSelectorDappTokenFilterSupportedNetwork: () => false,
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
    mockClosePopover.mockResolvedValue(undefined);
    mockWait.mockResolvedValue(undefined);
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
