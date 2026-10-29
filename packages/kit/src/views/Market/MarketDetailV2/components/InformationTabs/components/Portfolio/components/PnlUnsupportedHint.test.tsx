/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import {
  PnlUnsupportedHint,
  hasPnlUnsupportedPosition,
} from './PnlUnsupportedHint';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: { children: string }) => <span>{children}</span>,
  XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const HINT_KEY = 'market.pnl_not_supported_for_token';

describe('hasPnlUnsupportedPosition', () => {
  const pnl = (isPnlSupported: boolean) => ({
    isPnlSupported,
    totalPnlUsd: '0',
    totalPnlPercent: '0',
    unrealizedPnlUsd: '0',
    unrealizedPnlPercent: '0',
  });

  it('flags a list with at least one explicitly unsupported position', () => {
    expect(
      hasPnlUnsupportedPosition([{ pnl: pnl(true) }, { pnl: pnl(false) }]),
    ).toBe(true);
  });

  it('ignores supported, missing and empty PnL data', () => {
    expect(hasPnlUnsupportedPosition([{ pnl: pnl(true) }])).toBe(false);
    expect(hasPnlUnsupportedPosition([{ pnl: undefined }])).toBe(false);
    expect(hasPnlUnsupportedPosition([])).toBe(false);
  });
});

describe('PnlUnsupportedHint', () => {
  it('shows the translated hint', () => {
    const view = render(<PnlUnsupportedHint />);
    expect(view.getByText(HINT_KEY)).toBeTruthy();
  });
});
