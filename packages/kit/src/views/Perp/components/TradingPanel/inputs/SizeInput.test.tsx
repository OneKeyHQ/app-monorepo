/* eslint-disable import/first */

import { act, render } from '@testing-library/react-native';

import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

import { type ISizeInputMinimumOrderAction, SizeInput } from './SizeInput';

const mockSetTradingPreferences = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      `${id}:${values?.amount ?? ''}`,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsTradingPreferencesAtom: () => [
    { sizeInputUnit: 'usd' },
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
