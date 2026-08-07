import { getTokenImagePrewarmUri } from './tokenImagePrewarm';

describe('getTokenImagePrewarmUri', () => {
  it('uses the same md token TOS URL as the Earn detail header', () => {
    const uri = 'https://uni.onekey-asset.com/icons/token.png';
    const pixelRatio = 3;
    const prewarmUri = getTokenImagePrewarmUri({ uri, pixelRatio });

    expect(prewarmUri).toBe(
      'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_128',
    );
  });

  it('preserves a non-TOS URL because ImageV2 does not optimize it', () => {
    const uri = 'https://example.com/icons/token.png';

    expect(getTokenImagePrewarmUri({ uri, pixelRatio: 3 })).toBe(uri);
  });
});
