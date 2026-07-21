/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { useSwapProAmountSlider } from './useSwapProAmountSlider';

const mockToastMessage = jest.fn();
let mockInputToken:
  | {
      balanceParsed: string;
      contractAddress: string;
      decimals: number;
      isNative?: boolean;
      networkId: string;
      symbol: string;
    }
  | undefined;
let mockSwapProTradeType = ESwapProTradeType.MARKET;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: (...args: unknown[]) => {
      mockToastMessage(...args);
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapNativeTokenReserveGasAtom: () => [[]],
  useSwapProTradeTypeAtom: () => [mockSwapProTradeType],
}));

jest.mock('./useSwapPro', () => ({
  useSwapProInputToken: () => mockInputToken,
}));

describe('useSwapProAmountSlider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSwapProTradeType = ESwapProTradeType.MARKET;
    mockInputToken = {
      balanceParsed: '0',
      contractAddress: '0xzero',
      decimals: 18,
      networkId: 'evm--1',
      symbol: 'ZERO',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a zero-balance token slider interactive while the amount stays zero', () => {
    const onAmountChange = jest.fn();
    const { result, rerender } = renderHook(
      (props: { inputAmount: string }) =>
        useSwapProAmountSlider({
          inputAmount: props.inputAmount,
          onAmountChange,
        }),
      {
        initialProps: { inputAmount: '' },
      },
    );

    expect(result.current.sliderDisabled).toBe(false);

    act(() => {
      result.current.onSlideStart();
      result.current.onSliderChange(25);
    });

    expect(result.current.sliderValue).toBe(25);
    expect(onAmountChange).toHaveBeenCalledWith('0');

    rerender({ inputAmount: '0' });
    expect(result.current.sliderValue).toBe(25);

    act(() => {
      result.current.onSliderChange(100);
      result.current.onSlideComplete();
    });

    expect(result.current.sliderValue).toBe(100);
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('resets the zero-balance percentage when the input token changes', () => {
    const onAmountChange = jest.fn();
    const { result, rerender } = renderHook(
      () =>
        useSwapProAmountSlider({
          inputAmount: '0',
          onAmountChange,
        }),
      {},
    );

    act(() => {
      result.current.onSliderChange(50);
    });
    expect(result.current.sliderValue).toBe(50);

    mockInputToken = {
      balanceParsed: '0',
      contractAddress: '0xother',
      decimals: 18,
      networkId: 'evm--1',
      symbol: 'OTHER',
    };
    rerender();

    expect(result.current.sliderValue).toBe(0);
  });

  it('keeps the slider disabled until an input token is selected', () => {
    mockInputToken = undefined;

    const { result } = renderHook(() =>
      useSwapProAmountSlider({
        inputAmount: '',
        onAmountChange: jest.fn(),
      }),
    );

    expect(result.current.sliderDisabled).toBe(true);
  });
});
