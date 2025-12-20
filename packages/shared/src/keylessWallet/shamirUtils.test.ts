import bufferUtils from '../utils/bufferUtils';

import shamirUtils from './shamirUtils';

/*
yarn test packages/shared/src/keylessWallet/shamirUtils.test.ts
*/

describe('shamirUtils', () => {
  const secret = 'onekey-is-awesome';
  const secretHex = bufferUtils.textToHex(secret);
  const secretBytes = bufferUtils.toBuffer(secretHex);

  const verifyCombine = async (
    sharesToCombine: Uint8Array[],
    expectedSecret: string,
  ) => {
    const combined = await shamirUtils.combine(sharesToCombine);
    const combinedStr = bufferUtils.bytesToText(combined);
    expect(combinedStr).toBe(expectedSecret);
  };

  const verifyRecover = async (params: {
    entropyHex: string;
    share: Uint8Array;
    missingX: number;
    expectedShare: Uint8Array;
  }) => {
    const { entropyHex, share, missingX, expectedShare } = params;
    const shareBase64 = bufferUtils.bytesToBase64(share);
    const recoveredShareBase64 = shamirUtils.recoverMissingShare({
      entropyHex,
      shareBase64,
      missingX,
    });
    const recoveredShare = new Uint8Array(
      bufferUtils.base64ToBytes(recoveredShareBase64),
    );
    expect(bufferUtils.bytesToHex(recoveredShare)).toBe(
      bufferUtils.bytesToHex(expectedShare),
    );
    await verifyCombine([recoveredShare, share], secret);
  };

  it('should split and combine correctly', async () => {
    // 2-of-3
    const shares = await shamirUtils.split(new Uint8Array(secretBytes), 3, 2);
    expect(shares.length).toBe(3);

    // combine any 2 shares
    await verifyCombine([shares[0], shares[1]], secret);
    await verifyCombine([shares[1], shares[2]], secret);
    await verifyCombine([shares[0], shares[2]], secret);

    // combine all 3 shares
    await verifyCombine([shares[0], shares[1], shares[2]], secret);

    // combine shares in different order
    await verifyCombine([shares[1], shares[0]], secret);
    await verifyCombine([shares[2], shares[1]], secret);
    await verifyCombine([shares[2], shares[0]], secret);
    await verifyCombine([shares[2], shares[1], shares[0]], secret);
    await verifyCombine([shares[0], shares[2], shares[1]], secret);
    await verifyCombine([shares[1], shares[0], shares[2]], secret);
  });

  it('should recover missing share correctly', async () => {
    // 2-of-3
    const shares = await shamirUtils.split(new Uint8Array(secretBytes), 3, 2);
    // shares are Uint8Array. format: [y-values..., x-coordinate]

    const share1 = shares[0];
    const share2 = shares[1];
    const share3 = shares[2];

    // x1
    const x1 = share1[share1.length - 1];
    const x2 = share2[share2.length - 1];
    const x3 = share3[share3.length - 1];

    // secret + share2 -> share1
    await verifyRecover({
      entropyHex: secretHex,
      share: share2,
      missingX: x1,
      expectedShare: share1,
    });

    // secret + share3 -> share1
    await verifyRecover({
      entropyHex: secretHex,
      share: share3,
      missingX: x1,
      expectedShare: share1,
    });

    // secret + share1 -> share2
    await verifyRecover({
      entropyHex: secretHex,
      share: share1,
      missingX: x2,
      expectedShare: share2,
    });

    // secret + share3 -> share2
    await verifyRecover({
      entropyHex: secretHex,
      share: share3,
      missingX: x2,
      expectedShare: share2,
    });

    // secret + share2 -> share3
    await verifyRecover({
      entropyHex: secretHex,
      share: share2,
      missingX: x3,
      expectedShare: share3,
    });

    // secret + share1 -> share3
    await verifyRecover({
      entropyHex: secretHex,
      share: share1,
      missingX: x3,
      expectedShare: share3,
    });
  });

  it('GF256 operations should be correct', () => {
    const { GF256 } = shamirUtils;
    // x + x = 0 in GF(2^n)
    expect(GF256.add(10, 10)).toBe(0);
    expect(GF256.sub(10, 10)).toBe(0);

    // mul by 0
    expect(GF256.mul(10, 0)).toBe(0);
    expect(GF256.mul(0, 10)).toBe(0);

    // div by 0 should throw
    expect(() => GF256.div(10, 0)).toThrow('GF256 division by zero');

    // a / a = 1
    expect(GF256.div(123, 123)).toBe(1);

    // div by self should be 1
    expect(GF256.div(255, 255)).toBe(1);

    // 0 / a = 0
    expect(GF256.div(0, 10)).toBe(0);
  });
});
