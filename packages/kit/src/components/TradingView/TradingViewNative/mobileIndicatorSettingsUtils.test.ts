import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
} from './indicatorSettingsAdapter';
import { mergeMobileIndicatorSettings } from './mobileIndicatorSettingsUtils';

describe('mergeMobileIndicatorSettings', () => {
  it('saves only the edited indicator and preserves concurrent selection and settings', () => {
    const current = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const draft = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const currentBoll = current.mainIndicators.find(({ id }) => id === 'BOLL');
    const draftBoll = draft.mainIndicators.find(({ id }) => id === 'BOLL');
    const currentRsi = current.subIndicators.find(({ id }) => id === 'RSI');
    if (!currentBoll || !draftBoll || !currentRsi) {
      throw new OneKeyLocalError(
        'Expected BOLL and RSI in the indicator catalog',
      );
    }
    currentBoll.active = true;
    currentRsi.active = true;
    currentRsi.parameters.period = 28;
    draftBoll.parameters.period = 30;
    draftBoll.lines.middle.color = '#123456';

    const result = mergeMobileIndicatorSettings(current, draft, 'BOLL');

    expect(result.mainIndicators.find(({ id }) => id === 'BOLL')).toEqual({
      ...draftBoll,
      active: true,
    });
    expect(result.subIndicators).toEqual(current.subIndicators);
    expect(result.mainIndicators.filter(({ id }) => id !== 'BOLL')).toEqual(
      current.mainIndicators.filter(({ id }) => id !== 'BOLL'),
    );
    expect(currentBoll.parameters.period).toBe(20);
  });

  it('adds a setting to empty storage without enabling the indicator', () => {
    const next = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const result = mergeMobileIndicatorSettings(
      {
        schemaVersion: next.schemaVersion,
        mainIndicators: [],
        subIndicators: [],
      },
      next,
      'RSI',
    );
    expect(result.mainIndicators).toEqual([]);
    expect(result.subIndicators).toEqual([
      expect.objectContaining({ id: 'RSI', active: false }),
    ]);
  });
});
