/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketPerpsTokenListItem } from './MarketPerpsTokenListItem';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

type IFrameProps = PropsWithChildren<{
  testID?: string;
  height?: number;
  px?: string;
  py?: string;
  gap?: string | number;
}>;

function Frame({ children, testID, height, px, py, gap }: IFrameProps) {
  return (
    <div
      data-testid={testID}
      data-height={height}
      data-px={px}
      data-py={py}
      data-gap={gap}
    >
      {children}
    </div>
  );
}

jest.mock('@onekeyhq/components', () => ({
  NumberSizeableText: ({ children }: PropsWithChildren) => (
    <span>{children}</span>
  ),
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  SkeletonContainer: ({ children }: PropsWithChildren) => <>{children}</>,
  XStack: (props: IFrameProps) => Frame(props),
  YStack: (props: IFrameProps) => Frame({ ...props, testID: 'perps-lines' }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('../../../components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  SubtitleText: ({ subtitle }: { subtitle: string }) => <span>{subtitle}</span>,
}));

jest.mock('../PriceChangeBadge', () => ({
  PriceChangeBadge: () => null,
}));

const perp: IMarketPerpsToken = {
  name: 'BTC',
  displayName: 'BTC',
  maxLeverage: 40,
  subtitle: 'Bitcoin',
  tokenImageUrl: '',
  markPrice: '12345.67',
  prevDayPrice: '12000',
  change24hPercent: -3.5,
  volume24h: '123456789',
  openInterest: '1000',
  fundingRate: '0.001',
};

describe('MarketPerpsTokenListItem', () => {
  it('uses the shared mobile row frame', () => {
    const { container } = render(
      <MarketPerpsTokenListItem item={perp} onPress={jest.fn()} />,
    );
    const row = container.firstElementChild as HTMLElement;

    expect(row.getAttribute('data-height')).toBe('72');
    expect(row.getAttribute('data-px')).toBe('$5');
    expect(row.getAttribute('data-py')).toBe('$3');
    expect(row.getAttribute('data-gap')).toBe('$2');
    // 14px from the logo to the text, 4px between the two lines.
    expect(
      (row.firstElementChild as HTMLElement).getAttribute('data-gap'),
    ).toBe('14');
    expect(screen.getByTestId('perps-lines').getAttribute('data-gap')).toBe(
      '$1',
    );
  });
});
