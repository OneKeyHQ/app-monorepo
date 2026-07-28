import { createChartOptions } from './chartOptions';

const theme = {
  bgColor: 'transparent',
  textSubduedColor: '#666666',
  lineColor: '#008000',
  topColor: 'transparent',
  bottomColor: 'transparent',
};

describe('createChartOptions', () => {
  it('reserves the requested price scale width on the first layout', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      { top: 0.12, bottom: 0.1 },
      true,
      true,
      true,
      64,
    );

    expect(options.rightPriceScale).toMatchObject({
      visible: true,
      minimumWidth: 64,
    });
  });

  it('keeps the library default width when no minimum is requested', () => {
    const options = createChartOptions(theme);

    expect(options.rightPriceScale).not.toHaveProperty('minimumWidth');
  });
});
