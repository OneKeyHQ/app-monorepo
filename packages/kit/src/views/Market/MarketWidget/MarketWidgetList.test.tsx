/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MarketWidgetList } from './MarketWidgetList';

const mockPush = jest.fn();
const mockInstances = [
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
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    YStack: Container,
    SizableText: Container,
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
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: { instances: mockInstances } }),
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => false },
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

it('distinguishes widgets with the same assets and opens the selected instance', () => {
  render(<MarketWidgetList />);
  for (const { id, kind, instanceNumber } of mockInstances) {
    const row = screen.getByRole('button', {
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
