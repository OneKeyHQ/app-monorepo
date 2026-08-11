import { stampCustomInjectionRequestContext } from './customInjectionRequestContext';

describe('stampCustomInjectionRequestContext', () => {
  it('marks requests from a WebView using the Custom Injection preload', () => {
    expect(
      stampCustomInjectionRequestContext({ origin: 'https://dapp.test' }, true),
    ).toMatchObject({
      origin: 'https://dapp.test',
      isCustomInjectionRequest: true,
    });
  });

  it('prevents a regular page from spoofing Custom Injection context', () => {
    expect(
      stampCustomInjectionRequestContext(
        { isCustomInjectionRequest: true },
        false,
      ),
    ).toEqual({
      isCustomInjectionRequest: false,
    });
  });
});
