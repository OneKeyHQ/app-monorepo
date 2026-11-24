/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_EURC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { useSwapProAmountSlider } from './useSwapProAmountSlider';

const mockToastMessage = jest.fn();
let mockReserveGas: { networkId: string; reserveGas: string }[] = [];
let mockInputToken:
  | {
      balanceMultiplier?: string;
      balanceParsed?: string;
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
  useSwapNativeTokenReserveGasAtom: () => [mockReserveGas],
  useSwapProTradeTypeAtom: () => [mockSwapProTradeType],
}));

jest.mock('./useSwapPro', () => ({
  useSwapProInputToken: () => mockInputToken,
}));

describe('useSwapProAmountSlider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReserveGas = [];
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

  it.each([
    ['0.0000001', '1.123455'],
    ['2', '0'],
  ])(
    'reserves Arc gas %s at 100% with ERC-20 precision',
    (reserveGas, expectedAmount) => {
      mockInputToken = {
        balanceParsed: '1.123456',
        contractAddress: ARC_ERC20_USDC_CONTRACT_ADDRESS,
        decimals: 6,
        isNative: false,
        networkId: ARC_NETWORK_ID,
        symbol: 'USDC',
      };
      mockReserveGas = [{ networkId: ARC_NETWORK_ID, reserveGas }];
      const onAmountChange = jest.fn();
      const { result, rerender } = renderHook(() =>
        useSwapProAmountSlider({ inputAmount: '', onAmountChange }),
      );
      act(() => {
        result.current.onSlideStart();
        result.current.onSliderChange(100);
        result.current.onSlideComplete();
      });
      expect(onAmountChange).toHaveBeenLastCalledWith(expectedAmount);
      expect(mockInputToken.isNative).toBe(false);

      mockInputToken = {
        ...mockInputToken,
        contractAddress: ARC_EURC_CONTRACT_ADDRESS,
        symbol: 'EURC',
      };
      rerender();
      act(() => {
        result.current.onSlideStart();
        result.current.onSliderChange(100);
        result.current.onSlideComplete();
      });
      expect(onAmountChange).toHaveBeenLastCalledWith('1.123456');
    },
  );

  describe('a share below one raw unit', () => {
    // Three raw units shown as 0.000006: a quarter is three quarters of a unit.
    beforeEach(() => {
      mockInputToken = {
        balanceMultiplier: '2',
        balanceParsed: '0.000003',
        contractAddress: '0xrebase',
        decimals: 6,
        networkId: 'evm--1',
        symbol: 'REBASE',
      };
    });

    it('answers a completed selection with 0 instead of keeping the max amount', () => {
      const onAmountChange = jest.fn();
      const { result } = renderHook(() =>
        useSwapProAmountSlider({ inputAmount: '0.000006', onAmountChange }),
      );
      act(() => {
        result.current.onSlideStart();
        result.current.onSliderChange(25);
        result.current.onSlideComplete();
      });
      expect(onAmountChange).toHaveBeenLastCalledWith('0');
    });

    it('ignores a completion that belongs to a balance the slider no longer shows', () => {
      // Four raw units: a quarter is one whole unit, so the drag writes it.
      mockInputToken = { ...mockInputToken!, balanceParsed: '0.000004' };
      const onAmountChange = jest.fn();
      const { result, rerender } = renderHook(() =>
        useSwapProAmountSlider({ inputAmount: '0.000008', onAmountChange }),
      );
      act(() => {
        result.current.onSlideStart();
        result.current.onSliderChange(25);
      });
      onAmountChange.mockClear();
      // The balance drops to three units and the release lands in the same
      // tick, before the hook has reset the gesture for the new balance.
      act(() => {
        mockInputToken = { ...mockInputToken!, balanceParsed: '0.000003' };
        rerender();
        result.current.onSlideComplete();
      });
      expect(onAmountChange).not.toHaveBeenCalledWith('0');
    });

    it('keeps the amount while the drag is still in progress', () => {
      const onAmountChange = jest.fn();
      const { result } = renderHook(() =>
        useSwapProAmountSlider({ inputAmount: '0.000006', onAmountChange }),
      );
      act(() => {
        result.current.onSlideStart();
        result.current.onSliderChange(25);
        jest.advanceTimersByTime(500);
      });
      expect(onAmountChange).not.toHaveBeenCalled();
    });
  });

  it('writes a spendable share once when the selection completes', () => {
    mockInputToken = {
      balanceParsed: '1',
      contractAddress: '0xplain',
      decimals: 18,
      networkId: 'evm--1',
      symbol: 'PLAIN',
    };
    const onAmountChange = jest.fn();
    const { result } = renderHook(() =>
      useSwapProAmountSlider({ inputAmount: '', onAmountChange }),
    );
    act(() => {
      result.current.onSlideStart();
      result.current.onSliderChange(25);
      result.current.onSlideComplete();
    });
    expect(onAmountChange).toHaveBeenCalledTimes(1);
    expect(onAmountChange).toHaveBeenLastCalledWith('0.25');
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

    expect(result.current.sliderValue).toBe(0);
    expect(onAmountChange).toHaveBeenCalledWith('0');

    act(() => {
      result.current.onSlideComplete();
    });

    expect(result.current.sliderValue).toBe(25);

    rerender({ inputAmount: '0' });
    expect(result.current.sliderValue).toBe(25);

    act(() => {
      result.current.onSlideStart();
      result.current.onSliderChange(100);
      result.current.onSlideComplete();
    });

    expect(result.current.sliderValue).toBe(100);
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('defers the zero-balance slider value update until the drag completes', () => {
    const onAmountChange = jest.fn();
    const { result } = renderHook(() =>
      useSwapProAmountSlider({
        inputAmount: '0',
        onAmountChange,
      }),
    );

    act(() => {
      result.current.onSlideStart();
      result.current.onSliderChange(25);
      result.current.onSliderChange(50);
    });

    expect(result.current.sliderValue).toBe(0);

    act(() => {
      result.current.onSlideComplete();
    });

    expect(result.current.sliderValue).toBe(50);
  });

  it('updates the zero-balance slider value for a keyboard change', () => {
    const { result } = renderHook(() =>
      useSwapProAmountSlider({
        inputAmount: '0',
        onAmountChange: jest.fn(),
      }),
    );

    act(() => {
      result.current.onSliderChange(50);
    });

    expect(result.current.sliderValue).toBe(50);
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
      result.current.onSlideStart();
      result.current.onSliderChange(50);
      result.current.onSlideComplete();
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

  it('resets the zero-balance percentage when the amount is cleared externally', () => {
    const { result, rerender } = renderHook(
      (props: { inputAmount: string }) =>
        useSwapProAmountSlider({
          inputAmount: props.inputAmount,
          onAmountChange: jest.fn(),
        }),
      {
        initialProps: { inputAmount: '0' },
      },
    );

    act(() => {
      result.current.onSlideStart();
      result.current.onSliderChange(50);
      result.current.onSlideComplete();
    });
    expect(result.current.sliderValue).toBe(50);

    rerender({ inputAmount: '' });

    expect(result.current.sliderValue).toBe(0);
  });

  it('cancels a pending trailing commit when the amount is cleared externally', () => {
    const onAmountChange = jest.fn();
    const { result, rerender } = renderHook(
      (props: { inputAmount: string }) =>
        useSwapProAmountSlider({
          inputAmount: props.inputAmount,
          onAmountChange,
        }),
      {
        initialProps: { inputAmount: '0' },
      },
    );

    act(() => {
      result.current.onSliderChange(25);
      result.current.onSliderChange(50);
    });
    expect(onAmountChange).toHaveBeenCalledTimes(1);

    rerender({ inputAmount: '' });
    onAmountChange.mockClear();

    act(() => {
      jest.runAllTimers();
    });

    expect(onAmountChange).not.toHaveBeenCalled();
  });

  it('keeps the slider disabled until the token balance is loaded and valid', () => {
    const onAmountChange = jest.fn();
    mockInputToken = {
      balanceParsed: undefined,
      contractAddress: '0xloading',
      decimals: 18,
      networkId: 'evm--1',
      symbol: 'LOADING',
    };

    const { result, rerender } = renderHook(() =>
      useSwapProAmountSlider({
        inputAmount: '',
        onAmountChange,
      }),
    );

    expect(result.current.sliderDisabled).toBe(true);
    act(() => {
      result.current.onSliderChange(50);
    });

    mockInputToken = {
      ...mockInputToken,
      balanceParsed: 'invalid',
    };
    rerender();
    expect(result.current.sliderDisabled).toBe(true);

    mockInputToken = {
      ...mockInputToken,
      balanceParsed: '0',
    };
    rerender();
    expect(result.current.sliderDisabled).toBe(false);

    act(() => {
      jest.runAllTimers();
    });
    expect(onAmountChange).not.toHaveBeenCalled();
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
