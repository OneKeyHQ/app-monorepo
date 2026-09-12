import { getTokenImagePrewarmSource } from './tokenImagePrewarm';

describe('getTokenImagePrewarmSource', () => {
  it('passes the md token size and pixel ratio to the image cache', () => {
    const uri = 'https://uni.onekey-asset.com/icons/token.png';
    const pixelRatio = 3;
    const source = getTokenImagePrewarmSource({ uri, pixelRatio });

    expect(source).toEqual({
      uri,
      resizeWidth: 32,
      pixelRatio,
    });
  });
});
