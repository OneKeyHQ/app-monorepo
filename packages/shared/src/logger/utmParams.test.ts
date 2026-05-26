import {
  captureLoggerUtmParamsFromUrl,
  getLoggerGlobalUtmParams,
  getLoggerUtmParamsFromUrl,
} from './utmParams';

describe('logger utm params helpers', () => {
  it('reads all utm params from full URLs and paths', () => {
    expect(
      getLoggerUtmParamsFromUrl(
        'https://app.onekey.so/market?utm_source=x&utm_kol=kol_001&foo=bar',
      ),
    ).toEqual({
      utm_kol: 'kol_001',
      utm_source: 'x',
    });
    expect(
      getLoggerUtmParamsFromUrl('/perps?utm_medium=social&utm_campaign=may'),
    ).toEqual({
      utm_campaign: 'may',
      utm_medium: 'social',
    });
  });

  it('reads utm params from hash route URLs', () => {
    expect(
      getLoggerUtmParamsFromUrl(
        'https://app.onekey.so/#/perps?utm_content=hero&utm_kol=kol_003',
      ),
    ).toEqual({
      utm_content: 'hero',
      utm_kol: 'kol_003',
    });
  });

  it('caps collected utm params across search and hash params', () => {
    const params = getLoggerUtmParamsFromUrl(
      [
        'https://app.onekey.so/perps?',
        'utm_1=one&utm_2=two&utm_3=three&utm_4=four',
        '&utm_5=five&utm_6=six&utm_7=seven&utm_8=eight',
        '#/market?utm_9=nine&utm_1=updated',
      ].join(''),
    );

    expect(Object.keys(params)).toHaveLength(8);
    expect(params).toEqual({
      utm_1: 'updated',
      utm_2: 'two',
      utm_3: 'three',
      utm_4: 'four',
      utm_5: 'five',
      utm_6: 'six',
      utm_7: 'seven',
      utm_8: 'eight',
    });
  });

  it('normalizes utm values and stores them as global event props', () => {
    const captured = captureLoggerUtmParamsFromUrl(
      `https://app.onekey.so/perps?utm_kol=${encodeURIComponent(
        '  kol_004\n  ',
      )}&utm_source=twitter`,
    );

    expect(captured).toEqual({
      params: {
        utm_kol: 'kol_004',
        utm_source: 'twitter',
      },
      shouldReport: true,
    });
    expect(getLoggerGlobalUtmParams()).toEqual({
      utm_kol: 'kol_004',
      utm_source: 'twitter',
    });
  });

  it('clears stale global utm params when a later capture omits them', () => {
    captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=twitter&utm_campaign=old',
    );

    const captured = captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=discord',
    );

    expect(captured).toEqual({
      params: {
        utm_source: 'discord',
      },
      shouldReport: true,
    });
    expect(getLoggerGlobalUtmParams()).toEqual({
      utm_source: 'discord',
    });
  });

  it('clears stale global utm params when a later capture has no utm params', () => {
    captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=twitter&utm_campaign=old',
    );

    expect(captureLoggerUtmParamsFromUrl('/wallet')).toBeUndefined();
    expect(getLoggerGlobalUtmParams()).toEqual({});
  });

  it('marks only the first matching utm snapshot for reporting', () => {
    const url =
      'https://app.onekey.so/perps?utm_source=once&utm_campaign=report';

    expect(captureLoggerUtmParamsFromUrl(url)?.shouldReport).toBe(true);
    expect(captureLoggerUtmParamsFromUrl(url)?.shouldReport).toBe(false);
  });
});
