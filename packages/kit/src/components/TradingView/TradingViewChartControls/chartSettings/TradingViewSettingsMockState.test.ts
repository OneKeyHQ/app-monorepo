import {
  createTradingViewIndicatorSettingsValue,
  updateTradingViewSettingsMockIndicatorParameter,
  updateTradingViewSettingsMockLineColor,
  updateTradingViewSettingsMockLinePeriod,
} from './TradingViewSettingsMockState';

describe('TradingViewSettingsMockState', () => {
  it('updates a line only inside the selected indicator', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const firstIndicator = value.indicators[0];
    const secondIndicator = value.indicators[1];
    const firstLine = firstIndicator?.lines[0];
    const secondLine = secondIndicator?.lines[0];
    expect(firstIndicator).toBeDefined();
    expect(secondIndicator).toBeDefined();
    expect(firstLine).toBeDefined();
    expect(secondLine).toBeDefined();
    if (!firstIndicator || !secondIndicator || !firstLine || !secondLine) {
      return;
    }

    secondLine.id = firstLine.id;
    const originalSecondColor = secondLine.color;
    const nextValue = updateTradingViewSettingsMockLineColor(
      value,
      firstIndicator.id,
      firstLine.id,
      '#123456',
    );

    expect(nextValue.indicators[0]?.lines[0]?.color).toBe('#123456');
    expect(nextValue.indicators[1]?.lines[0]?.color).toBe(originalSecondColor);
  });

  it('updates a parameter only inside the selected indicator', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const indicatorsWithParameters = value.indicators.filter(
      (indicator) => indicator.parameters?.length,
    );
    const firstIndicator = indicatorsWithParameters[0];
    const secondIndicator = indicatorsWithParameters[1];
    const firstParameter = firstIndicator?.parameters?.[0];
    const secondParameter = secondIndicator?.parameters?.[0];
    expect(firstIndicator).toBeDefined();
    expect(secondIndicator).toBeDefined();
    expect(firstParameter).toBeDefined();
    expect(secondParameter).toBeDefined();
    if (
      !firstIndicator ||
      !secondIndicator ||
      !firstParameter ||
      !secondParameter
    ) {
      return;
    }

    secondParameter.id = firstParameter.id;
    const originalSecondValue = secondParameter.value;
    const nextValue = updateTradingViewSettingsMockIndicatorParameter(
      value,
      firstIndicator.id,
      firstParameter.id,
      firstParameter.value + 1,
    );

    expect(
      nextValue.indicators.find(
        (indicator) => indicator.id === firstIndicator.id,
      )?.parameters?.[0]?.value,
    ).toBe(firstParameter.value + 1);
    expect(
      nextValue.indicators.find(
        (indicator) => indicator.id === secondIndicator.id,
      )?.parameters?.[0]?.value,
    ).toBe(originalSecondValue);
  });

  it('keeps editable indicator periods aligned with the renderer minimum', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const indicator = value.indicators[0];
    const line = indicator?.lines[0];
    expect(indicator).toBeDefined();
    expect(line).toBeDefined();
    if (!indicator || !line) {
      return;
    }

    const nextValue = updateTradingViewSettingsMockLinePeriod(
      value,
      indicator.id,
      line.id,
      0,
    );

    expect(nextValue.indicators[0]?.lines[0]?.period).toBe(1);
  });
});
