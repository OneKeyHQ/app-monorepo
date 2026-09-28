/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { OpenOrdersRow } from './OpenOrdersRow';

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({ children }: { children?: ReactNode }) => (
    <button>{children}</button>
  ),
  Spinner: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { switchTradeInstrument: jest.fn() },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSpotPairDisplayMapAtom: () => [{}],
  useSpotPairDisplayNameMapAtom: () => [{}],
}));

const order: IPerpsFrontendOrder = {
  coin: 'xyz:INTC',
  side: 'A',
  limitPx: '100',
  sz: '0',
  origSz: '0',
  oid: 1,
  cloid: null,
  timestamp: 1_790_240_000_000,
  orderType: 'Stop Market',
  isTrigger: true,
  triggerCondition: 'Price below 115',
  triggerPx: '115',
  isPositionTpsl: true,
  reduceOnly: true,
  children: [],
  tif: 'Gtc',
};

const columns = Array.from({ length: 11 }, (_, index) => ({
  key: String(index),
  title: String(index),
}));

function renderOrder(
  overrides: Partial<IPerpsFrontendOrder>,
  isMobile: boolean,
) {
  return render(
    <OpenOrdersRow
      order={{ ...order, ...overrides }}
      cellMinWidth={900}
      columnConfigs={columns}
      handleCancelOrder={jest.fn()}
      handleChaseOrder={jest.fn()}
      canChaseOrder={false}
      isChasingOrder={false}
      isMobile={isMobile}
      index={0}
    />,
  );
}

describe.each([true, false])('open order sizes (mobile=%s)', (isMobile) => {
  it.each(['Stop Market', 'Take Profit Market'] as const)(
    'shows placeholders for position-sized %s orders',
    (orderType) => {
      const screen = renderOrder(
        { orderType, sz: '0.0', origSz: '0.00' },
        isMobile,
      );
      expect(screen.getAllByText('--')).toHaveLength(isMobile ? 1 : 2);
      expect(screen.queryByText('0 / 0')).toBeNull();
    },
  );

  it('keeps explicit quantities for partial-position orders', () => {
    const screen = renderOrder({ sz: '4', origSz: '4' }, isMobile);
    expect(screen.getAllByText(isMobile ? '4 / 4' : '4')).toHaveLength(
      isMobile ? 1 : 2,
    );
    expect(screen.queryByText('--')).toBeNull();
  });

  it('preserves zero remaining size for an explicitly sized order', () => {
    const screen = renderOrder({ sz: '0', origSz: '4' }, isMobile);
    expect(screen.getByText(isMobile ? '0 / 4' : '0')).toBeTruthy();
    expect(screen.queryByText('--')).toBeNull();
  });

  it('does not hide zero sizes on ordinary orders', () => {
    const screen = renderOrder(
      { isPositionTpsl: false, orderType: 'Limit' },
      isMobile,
    );
    expect(screen.getAllByText(isMobile ? '0 / 0' : '0')).toHaveLength(
      isMobile ? 1 : 2,
    );
    expect(screen.queryByText('--')).toBeNull();
  });
});
