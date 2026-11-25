/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketWidgetInstalledInstance } from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { MarketWidgetList } from './MarketWidgetList';

const mockPush = jest.fn();
const mockGetInstalledInstances = jest.fn<
  Promise<IMarketWidgetInstalledInstance[]>,
  []
>();
let mockFocused = true;
const instances: IMarketWidgetInstalledInstance[] = [
  {
    id: '4bdfeb88-a55d-4a91-bedb-df13acfaea39',
    kind: 'list',
    instanceNumber: 1,
    symbols: ['BTC'],
  },
  {
    id: '5bdfeb88-a55d-4a91-bedb-df13acfaea39',
    kind: 'list',
    instanceNumber: 2,
    symbols: ['BTC'],
  },
];

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    YStack: Container,
    SizableText: Container,
    Empty: ({
      buttonProps,
    }: {
      buttonProps: { children: string; onPress: () => Promise<void> };
    }) => (
      <button type="button" onClick={() => void buttonProps.onPress()}>
        {buttonProps.children}
      </button>
    ),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({}),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    testID,
    title,
    subtitle,
    onPress,
  }: {
    testID: string;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {title} {subtitle}
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: {} }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => mockFocused,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('node:events')>('node:events');
  return {
    EAppEventBusNames: {
      MarketWidgetConfigurationSynced: 'MarketWidgetConfigurationSynced',
    },
    appEventBus: new EventEmitter(),
  };
});
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: { getInstalledInstances: () => mockGetInstalledInstances() },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));

beforeEach(() => {
  mockFocused = true;
  mockPush.mockClear();
  mockGetInstalledInstances.mockReset().mockResolvedValue(instances);
});

it('distinguishes widgets with the same assets and opens the selected instance', async () => {
  render(<MarketWidgetList />);
  for (const { id, kind, instanceNumber } of instances) {
    const row = await screen.findByRole('button', {
      name: `market_widget_list__title #${instanceNumber} BTC`,
    });
    fireEvent.click(row);
    expect(mockPush).toHaveBeenLastCalledWith('MarketWidgetEditor', {
      kind,
      profileId: id,
    });
  }
  fireEvent.click(screen.getByTestId('market-widget-settings-list'));
  expect(mockPush).toHaveBeenLastCalledWith('MarketWidgetEditor', {
    kind: 'list',
  });
});

it('refreshes installed symbols after configuration sync while focused', async () => {
  const { rerender } = render(<MarketWidgetList />);
  await screen.findByRole('button', {
    name: 'market_widget_list__title #1 BTC',
  });
  let rejectRefresh: (error: Error) => void = () => {};
  mockGetInstalledInstances.mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectRefresh = reject;
    }),
  );
  act(() => {
    appEventBus.emit(
      EAppEventBusNames.MarketWidgetConfigurationSynced,
      undefined,
    );
  });
  expect(
    screen.getByRole('button', { name: 'market_widget_list__title #1 BTC' }),
  ).toBeDefined();

  await act(async () => rejectRefresh(new Error('WidgetKit unavailable')));
  const retry = screen.getByRole('button', { name: 'global.retry' });
  expect(
    screen.getByRole('button', { name: 'market_widget_list__title #1 BTC' }),
  ).toBeDefined();
  mockGetInstalledInstances.mockResolvedValueOnce(
    instances.map((instance) => ({
      ...instance,
      symbols: instance.instanceNumber === 1 ? ['ETH'] : instance.symbols,
    })),
  );
  fireEvent.click(retry);
  await screen.findByRole('button', {
    name: 'market_widget_list__title #1 ETH',
  });
  expect(mockGetInstalledInstances).toHaveBeenCalledTimes(3);

  mockFocused = false;
  rerender(<MarketWidgetList />);
  act(() => {
    appEventBus.emit(
      EAppEventBusNames.MarketWidgetConfigurationSynced,
      undefined,
    );
  });
  expect(mockGetInstalledInstances).toHaveBeenCalledTimes(3);
});
