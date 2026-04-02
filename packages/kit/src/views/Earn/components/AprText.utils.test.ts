import {
  buildAprRangeText,
  formatRewardText,
  withRewardUnit,
} from './AprText.utils';

describe('AprText utils', () => {
  it('does not append a custom reward unit when the text already has one', () => {
    expect(withRewardUnit('10.5% Rate', 'Rate')).toBe('10.5% Rate');
  });

  it('strips a custom reward unit when hideSuffix is enabled', () => {
    expect(
      formatRewardText({
        text: '10.5% Rate',
        rewardUnit: 'Rate',
        hideSuffix: true,
      }),
    ).toBe('10.5%');
  });

  it('builds range text without duplicating a custom reward unit', () => {
    expect(
      buildAprRangeText({
        minAprInfo: {
          normal: {
            text: '10.5% Rate',
          },
        },
        maxAprInfo: {
          normal: {
            text: '12.5% Rate',
          },
        },
        rewardUnit: 'Rate',
      }),
    ).toBe('10.5% - 12.5% Rate');
  });
});
