/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { BalanceDisplay } from './BalanceDisplay';

import type { IToken } from '../types';

let mockSelectedDeriveType: unknown;
let mockSelectorProps: Record<string, unknown> | undefined;

jest.mock('@onekeyhq/components', () => {
  const Stub = () => null;
  return {
    Icon: Stub,
    Image: Stub,
    NumberSizeableText: Stub,
    Skeleton: Stub,
    XStack: ({ children }: { children?: unknown }) => children ?? null,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger',
  () => ({ DeriveTypeSelectorTriggerIconRenderer: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockSelectorProps = props;
      return null;
    },
  }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [mockSelectedDeriveType, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emit: jest.fn() },
}));

jest.mock('./InfoItemLabel', () => ({ InfoItemLabel: () => null }));

const BTC_TOKEN = { networkId: 'btc--0', symbol: 'BTC' } as IToken;

function renderBalance() {
  render(<BalanceDisplay token={BTC_TOKEN} enableAddressTypeSelector />);
}

describe('BalanceDisplay address type selector', () => {
  beforeEach(() => {
    mockSelectorProps = undefined;
  });

  it('judges the type the panel trades with, not the app default', () => {
    mockSelectedDeriveType = { networkId: 'btc--0', deriveType: 'BIP84' };
    renderBalance();
    expect(mockSelectorProps?.whenCollapsed).toBe('hide');
    expect(mockSelectorProps?.activeDeriveType).toBe('BIP84');
  });

  it('falls back to the app default without a pick on this network', () => {
    mockSelectedDeriveType = { networkId: 'ltc--0', deriveType: 'BIP84' };
    renderBalance();
    expect(mockSelectorProps?.activeDeriveType).toBeUndefined();
  });
});
