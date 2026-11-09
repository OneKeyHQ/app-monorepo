/* eslint-disable import/first */

import { act, render } from '@testing-library/react-native';

import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  TWAP_MIN_ORDER_NOTIONAL,
  isTwapTotalNotionalValid,
} from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

import { type ISizeInputMinimumOrderAction, SizeInput } from './SizeInput';

const mockSetTradingPreferences = jest.fn();
let mockSizeInputUnit: 'usd' | 'token' | 'margin' = 'usd';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      `${id}:${values?.amount ?? ''}`,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsTradingPreferencesAtom: () => [
    { sizeInputUnit: mockSizeInputUnit },
    mockSetTradingPreferences,
  ],
}));

jest.mock('../selectors/SizeInputModeSelector', () => ({
  SizeInputModeSelector: () => null,
}));

jest.mock('./TradingFormInput', () => ({
  TradingFormInput: () => null,
}));

describe('SizeInput minimum order action', () => {
  beforeEach(() => {
    mockSizeInputUnit = 'usd';
  });

  it.each([
    ['usd', '$100.69'],
    ['token', '1.26 HYPE'],
    ['margin', '$5.04'],
  ] as const)(
    'fills a valid TWAP minimum from the %s shortcut',
    (inputMode, expectedLabel) => {
      mockSizeInputUnit = inputMode;
      const onChange = jest.fn<void, [string]>();
      const minimumOrderActionRef: {
        current: ISizeInputMinimumOrderAction | undefined;
      } = { current: undefined };

      render(
        <SizeInput
          value=""
          side="long"
          symbol="HYPE"
          onChange={onChange}
          activeAsset={{ universe: { szDecimals: 2 } } as IPerpsActiveAssetAtom}
          isAssetCtxReady
          referencePrice="79.905"
          sizeInputMode={EPerpsSizeInputMode.MANUAL}
          sliderPercent={0}
          leverage={20}
          minimumOrderNotional={TWAP_MIN_ORDER_NOTIONAL}
          minimumOrderActionRef={minimumOrderActionRef}
        />,
      );

      expect(minimumOrderActionRef.current?.amountLabel).toBe(expectedLabel);
      act(() => minimumOrderActionRef.current?.onPress());
      expect(onChange).toHaveBeenCalledWith('1.26');
      expect(
        isTwapTotalNotionalValid({
          size: onChange.mock.calls[0][0],
          price: '79.905',
          szDecimals: 2,
        }),
      ).toBe(true);
    },
  );

  it('switches a slider value to the precision-safe minimum manual value', () => {
    const onChange = jest.fn();
    const onRequestManualMode = jest.fn();
    const minimumOrderActionRef: {
      current: ISizeInputMinimumOrderAction | undefined;
    } = { current: undefined };

    render(
      <SizeInput
        value=""
        side="long"
        symbol="NVDA"
        onChange={onChange}
        activeAsset={
          {
            universe: { szDecimals: 1 },
          } as IPerpsActiveAssetAtom
        }
        isAssetCtxReady
        referencePrice="3.39"
        sizeInputMode={EPerpsSizeInputMode.SLIDER}
        sliderPercent={11}
        onRequestManualMode={onRequestManualMode}
        leverage={20}
        minimumOrderActionRef={minimumOrderActionRef}
      />,
    );

    expect(minimumOrderActionRef.current?.amountLabel).toBe('$10.17');

    act(() => minimumOrderActionRef.current?.onPress());

    expect(onRequestManualMode).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('3');
  });
});
