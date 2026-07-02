import {
  convertLtcXpub,
  getBtcForkNetwork,
  getInputsToSignFromPsbt,
  getSignPsbtOptionsForPsbtIndex,
} from '.';

import { Psbt } from 'bitcoinjs-lib';

import type { ISignPsbtOptions } from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';

import type { ICoreApiSignAccount } from '../../../types';

const convertLtcXpubTestCases = [
  {
    purpose: "44'",
    xpub: 'Ltub2YYecr1EWBPtSQsF6KvyQ62fetqpG3ptF9tMCHo2qWcQRLFhsm2N7wpnCsXrY5CxSvnMXkxpw3ja7YPwUkGppQFf1EQBSCR7nufxZkbeGNH',
    expected:
      'Ltub2YYecr1EWBPtSQsF6KvyQ62fetqpG3ptF9tMCHo2qWcQRLFhsm2N7wpnCsXrY5CxSvnMXkxpw3ja7YPwUkGppQFf1EQBSCR7nufxZkbeGNH',
  },
  {
    purpose: "48'",
    xpub: 'Ltub2Yx3Zi4MYz9BDF5g1CtREi4KPvrUq4MBKAvwzEPMdASY6FCwWXiEfBiUywks8qxhD792mBkFHxs6zDtMW9jZtTdf8aUqWmkRN4ScCNnoz9a',
    expected:
      'Ltub2Yx3Zi4MYz9BDF5g1CtREi4KPvrUq4MBKAvwzEPMdASY6FCwWXiEfBiUywks8qxhD792mBkFHxs6zDtMW9jZtTdf8aUqWmkRN4ScCNnoz9a',
  },
  {
    purpose: "49'",
    xpub: 'Ltub2ZjUF4oMpXrWHAkE6qabBvk7tzNaBT7VEHfHEEMtuD7scjXDeXn1KyRDebMiewtpTRb4A6tQAg8tqnRqmDVzZX2JYtaZJAwSrmL4dykbt2D',
    expected:
      'Mtub2tZjYjUGyDPz8TwLwCNDQ1qd4xX2856z9QBW1dFnHDVkfqLSuBwZx35MfoKJerYjs4hruaUxdLVSj53QUuv1MkhuREGyt5kw8VPi2VwQWko',
  },
  {
    purpose: "84'",
    xpub: 'Ltub2ZwewHnM43H1RLMQ7pkYPtW8ZmPWvpurGZZshtkQHSKVHuoBmht3fSPYmgALAjsU2Pt4TE1ZwXhbJcAAYefwP6pKiKE5cRYa3CKrFyELUhd',
    expected:
      'zpub6sB55yv9Ty3xsZThC4KnxCaupuMr4HNhyWQLSbo4fxEYfjnqd1iS5vDPTDZUW9n4FTi6N3p91pmJy62B59QX8eQ79rjU7ZRW69go8cLh54i',
  },
];

describe('BTC SDK tests', () => {
  it('convertLtcXpub test', async () => {
    for (const testCase of convertLtcXpubTestCases) {
      const result = await convertLtcXpub({
        purpose: testCase.purpose,
        xpub: testCase.xpub,
      });
      expect(result).toBe(testCase.expected);
    }
  });
});

// Real single-psbt payload captured from the Babylon devnet bug report
// (https://demo.vault-devnet.babylonlabs.io). The single input is a script-path
// taproot spend whose derived address differs from the signing account address,
// so it is only signed when the per-psbt options (`toSignInputs` /
// `isBtcWalletProvider`) are preserved.
const BABYLON_SINGLE_PSBT_HEX =
  '70736274ff01005e0200000001a1a9dd6bf28fd4d756be39c78325e98ee009dbc8d455631f05526989dab7a99c0000000000b001000001b06a14000000000022512053bea6a3e87c00ca8cfff0ebcc53acf2ae4590e208f3f4f6b6719c535c166529000000000001012bf06b140000000000225120025f94c02d52276a8e411d1265166a79426f470403b02a0e19c17fca41bc67d74215c050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0543f95859a7067673cafd4f4f70ae74468231a81f21afb71ce5da4f5edccf3912720358818f214fcd9d4ccc4296c9079ec25ed440b0df4acc34bedaa76c2c1955a19ad02b001b2c001172050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac00000';
const BABYLON_ACCOUNT: ICoreApiSignAccount = {
  address: 'tb1p2wl2dglg0sqv4r8l7r4uc5av72hyty8zprelfa4kwxw9xhqkv55s3kz7ze',
  path: "m/86'/1'/0'/0/0",
  pub: '02358818f214fcd9d4ccc4296c9079ec25ed440b0df4acc34bedaa76c2c1955a19',
};

describe('getSignPsbtOptionsForPsbtIndex', () => {
  const optionA: ISignPsbtOptions = {
    autoFinalized: true,
    toSignInputs: [{ index: 0 }],
  };
  const optionB: ISignPsbtOptions = {
    autoFinalized: false,
    toSignInputs: [{ index: 1 }],
  };

  it('returns the per-psbt entry for the UniSat/Babylon array form', () => {
    const options = [optionA, optionB];
    expect(getSignPsbtOptionsForPsbtIndex({ options, index: 0 })).toBe(optionA);
    expect(getSignPsbtOptionsForPsbtIndex({ options, index: 1 })).toBe(optionB);
  });

  it('shares the single object across every psbt for the legacy form', () => {
    expect(getSignPsbtOptionsForPsbtIndex({ options: optionA, index: 0 })).toBe(
      optionA,
    );
    expect(getSignPsbtOptionsForPsbtIndex({ options: optionA, index: 5 })).toBe(
      optionA,
    );
  });

  it('handles undefined options and out-of-range indexes', () => {
    expect(
      getSignPsbtOptionsForPsbtIndex({ options: undefined, index: 0 }),
    ).toBeUndefined();
    expect(
      getSignPsbtOptionsForPsbtIndex({ options: [optionA], index: 3 }),
    ).toBeUndefined();
  });

  it('recovers per-psbt toSignInputs that whole-array access dropped', () => {
    const options = [optionA];
    // The pre-fix bug: reading fields straight off the array (treating it as a
    // single options object) yields undefined, so toSignInputs/isBtcWalletProvider
    // are lost and inputsToSign ends up empty.
    expect(
      (options as unknown as ISignPsbtOptions).toSignInputs,
    ).toBeUndefined();
    // The helper restores the per-psbt entry.
    expect(
      getSignPsbtOptionsForPsbtIndex({ options, index: 0 })?.toSignInputs,
    ).toEqual([{ index: 0 }]);
  });
});

describe('getInputsToSignFromPsbt - Babylon signPsbts regression', () => {
  const psbtNetwork = getBtcForkNetwork('tbtc');
  const buildPsbt = () =>
    Psbt.fromHex(BABYLON_SINGLE_PSBT_HEX, { network: psbtNetwork });

  it('returns empty inputsToSign when per-psbt options are lost (reproduces the hang)', () => {
    // Mirrors the broken path: signPsbts handed the whole options array to
    // _signPsbt, so isBtcWalletProvider resolved to false. The script-path
    // input address differs from the account address, so nothing is selected
    // to sign -> buildDecodedPsbtTx throws "inputsToSign is empty" -> the
    // confirm page stays on the loading skeleton forever.
    const inputsToSign = getInputsToSignFromPsbt({
      psbt: buildPsbt(),
      psbtNetwork,
      account: BABYLON_ACCOUNT,
      isBtcWalletProvider: false,
    });
    expect(inputsToSign).toEqual([]);
  });

  it('signs the script-path input once per-psbt isBtcWalletProvider is preserved', () => {
    const inputsToSign = getInputsToSignFromPsbt({
      psbt: buildPsbt(),
      psbtNetwork,
      account: BABYLON_ACCOUNT,
      isBtcWalletProvider: true,
    });
    expect(inputsToSign).toHaveLength(1);
    expect(inputsToSign[0].index).toBe(0);
    expect(inputsToSign[0].publicKey).toBe(BABYLON_ACCOUNT.pub);
    expect(inputsToSign[0].address).toBe(BABYLON_ACCOUNT.address);
  });

  it('end-to-end: array-form options[0] re-enables Babylon signing', () => {
    const options: ISignPsbtOptions[] = [{ isBtcWalletProvider: true }];

    // Pre-fix: whole array used as options -> isBtcWalletProvider undefined.
    const buggyIsBtcWalletProvider =
      (options as unknown as ISignPsbtOptions).isBtcWalletProvider ?? false;
    expect(
      getInputsToSignFromPsbt({
        psbt: buildPsbt(),
        psbtNetwork,
        account: BABYLON_ACCOUNT,
        isBtcWalletProvider: buggyIsBtcWalletProvider,
      }),
    ).toEqual([]);

    // Post-fix: extract options[0] before reading the flag.
    const fixedOptions = getSignPsbtOptionsForPsbtIndex({ options, index: 0 });
    expect(
      getInputsToSignFromPsbt({
        psbt: buildPsbt(),
        psbtNetwork,
        account: BABYLON_ACCOUNT,
        isBtcWalletProvider: fixedOptions?.isBtcWalletProvider ?? false,
      }),
    ).toHaveLength(1);
  });
});
