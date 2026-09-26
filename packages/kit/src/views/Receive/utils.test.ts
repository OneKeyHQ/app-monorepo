import { getManualAddressVerificationPath } from './utils';

describe('getManualAddressVerificationPath', () => {
  it.each(["m/44'/60'/0'/0/0", "m/44'/501'/0'/0'", "m/44'/195'/0'/0/0"])(
    'uses the full account path for a non-BTC address: %s',
    (accountPath) => {
      expect(
        getManualAddressVerificationPath({ accountPath, isBtcNetwork: false }),
      ).toBe(accountPath);
    },
  );

  it('uses the specific BTC receiving path instead of the account path', () => {
    expect(
      getManualAddressVerificationPath({
        accountPath: "m/84'/0'/0'",
        receiveAddressPath: "m/84'/0'/0'/1/7",
        isBtcNetwork: true,
      }),
    ).toBe("m/84'/0'/0'/1/7");
  });

  it('does not present a BTC account path as an address path', () => {
    expect(
      getManualAddressVerificationPath({
        accountPath: "m/84'/0'/0'",
        isBtcNetwork: true,
      }),
    ).toBeUndefined();
  });
});
