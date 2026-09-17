/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { BorrowTestIDs } from '../testIDs';

import { BorrowMobileEmptyState } from './BorrowMobileEmptyState';

type ISupplyAsset = NonNullable<
  Parameters<typeof BorrowMobileEmptyState>[0]['assets']
>[number];

const asset = (symbol: string, fiatValue: string) =>
  ({
    reserveAddress: `0x${symbol}`,
    token: { symbol, logoURI: '' },
    walletBalance: {
      fiatValue,
      title: { text: symbol },
      description: { text: `$${fiatValue}` },
    },
    apyDetail: { apy: '1' },
  }) as unknown as ISupplyAsset;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    __esModule: true,
    IconButton: ({
      testID,
      onPress,
    }: {
      testID?: string;
      onPress?: () => void;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        refresh
      </button>
    ),
    SizableText: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('./BorrowTableList', () => ({
  __esModule: true,
  AssetWithAmountField: () => null,
  BorrowAPYField: () => null,
  BorrowTableList: ({ data }: { data: { token: { symbol: string } }[] }) => (
    <div data-testid="table">{data.map((d) => d.token.symbol).join(',')}</div>
  ),
}));

describe('BorrowMobileEmptyState', () => {
  // The metric row that normally carries refresh is not on screen in this
  // state, so without this the market has no way to be re-pulled at all.
  it('puts the refresh button on the list heading', () => {
    const onRefresh = jest.fn();
    const { queryByTestId } = render(
      <BorrowMobileEmptyState assets={[]} onRefresh={onRefresh} />,
    );

    expect(queryByTestId(BorrowTestIDs.overviewRefreshBtn)).toBeTruthy();
  });

  // Rendering the button is only half of it; the mock keeps onPress so a button
  // wired to the wrong prop cannot pass on presence alone.
  it('asks for a refresh when the button is pressed', () => {
    const onRefresh = jest.fn();
    const { getByTestId } = render(
      <BorrowMobileEmptyState assets={[]} onRefresh={onRefresh} />,
    );

    fireEvent.click(getByTestId(BorrowTestIDs.overviewRefreshBtn));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves the heading alone when no refresh was handed down', () => {
    const { queryByTestId } = render(<BorrowMobileEmptyState assets={[]} />);

    expect(queryByTestId(BorrowTestIDs.overviewRefreshBtn)).toBeNull();
  });

  // End to end through the component rather than the sort helper alone: the
  // list the user reads is the one that has to lead with what they hold.
  it('renders the assets largest holding first', () => {
    const { getByTestId } = render(
      <BorrowMobileEmptyState
        assets={[asset('SMALL', '0.24'), asset('BIG', '7.60')]}
      />,
    );

    expect(getByTestId('table').textContent).toBe('BIG,SMALL');
  });
});
