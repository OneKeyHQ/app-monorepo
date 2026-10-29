/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapProviderSelectContent } from './SwapProviderSelectContent';

jest.mock('@onekeyhq/components', () => {
  function MockStack({ children }: PropsWithChildren) {
    return <div>{children}</div>;
  }
  function MockSectionList({
    sections,
    renderItem,
  }: {
    sections: { type: string; data: IFetchQuoteResult[] }[];
    renderItem: (props: {
      item: IFetchQuoteResult;
      index: number;
    }) => ReactNode;
  }) {
    return sections.map((section) => (
      <div key={section.type} data-testid={`section-${section.type}`}>
        {section.data.map((item, index) => (
          <div key={item.info.provider}>{renderItem({ item, index })}</div>
        ))}
      </div>
    ));
  }
  MockSectionList.SectionHeader = MockStack;
  const Page = Object.assign(MockStack, { Header: () => null });
  return {
    Button: MockStack,
    Icon: MockStack,
    IconButton: MockStack,
    LottieView: MockStack,
    Page,
    Popover: MockStack,
    SectionList: MockSectionList,
    Select: MockStack,
    SizableText: MockStack,
    Stack: MockStack,
    XStack: MockStack,
    YStack: MockStack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('./SwapProviderListItem', () => ({
  __esModule: true,
  default: ({
    providerResult,
    disabled,
    onPress,
  }: {
    providerResult: IFetchQuoteResult;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {providerResult.info.providerName}
    </button>
  ),
}));

const token: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xtoken',
  symbol: 'USDT',
  decimals: 18,
};

function makeQuote(
  providerName: string,
  values: Partial<IFetchQuoteResult>,
): IFetchQuoteResult {
  return {
    info: { provider: providerName, providerName },
    fromTokenInfo: token,
    toTokenInfo: token,
    ...values,
  };
}

it('groups and selects providers by the amount, not merely the presence of limits', () => {
  const inRange = makeQuote('In range', {
    toAmount: '9',
    limit: { min: '5', max: '10' },
  });
  const overMax = makeQuote('Above maximum', {
    toAmount: '9',
    limit: { max: '9' },
  });
  const belowMin = makeQuote('Below minimum', {
    toAmount: '9',
    limit: { min: '11' },
  });
  const noQuote = makeQuote('No quote', { limit: { max: '10' } });
  const providerError = makeQuote('Provider error', {
    toAmount: '9',
    limit: { max: '10' },
    errorMessage: 'failed',
  });
  const zeroQuote = makeQuote('Zero quote', { toAmount: '0' });
  const onSelectQuote = jest.fn();
  render(
    <SwapProviderSelectContent
      quoteListForDisplay={[
        inRange,
        overMax,
        belowMin,
        noQuote,
        providerError,
        zeroQuote,
      ]}
      activeFromTokenAmount="10"
      activeFromToken={token}
      activeToToken={token}
      currencySymbol="$"
      onSelectQuote={onSelectQuote}
    />,
  );

  const available = screen.getByTestId('section-Available');
  const unavailable = screen.getByTestId('section-Unavailable');
  fireEvent.click(within(available).getByRole('button', { name: 'In range' }));
  expect(onSelectQuote).toHaveBeenCalledWith(expect.objectContaining(inRange));
  for (const name of [
    'Above maximum',
    'Below minimum',
    'No quote',
    'Provider error',
    'Zero quote',
  ]) {
    const item = within(unavailable).getByRole('button', { name });
    expect((item as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(item);
  }
  expect(onSelectQuote).toHaveBeenCalledTimes(1);
});
