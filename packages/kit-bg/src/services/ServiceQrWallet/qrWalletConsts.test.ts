import { UR_DEFAULT_ORIGIN } from './qrWalletConsts';

describe('qrWalletConsts', () => {
  it('keeps the origin Keystone matches exactly', () => {
    expect(UR_DEFAULT_ORIGIN).toBe('OneKey');
  });
});
