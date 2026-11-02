import { wordlists } from 'bip39';
import bs58check from 'bs58check';

import { COINTYPE_LIGHTNING_SPARK } from '@onekeyhq/shared/src/engine/engineConsts';

import { entropyToMnemonic, mnemonicToSeedSync } from '../bip39';
import {
  BIP85_PURPOSE,
  LIGHTNING_SPARK_BIP85_APP,
  LIGHTNING_SPARK_BIP85_PATH,
  deriveBip85,
  deriveLightningSparkChildMnemonic,
  generateSecp256k1MasterKeyFromSeed,
} from '../bip85';
import { secp256k1 } from '../curves';
import {
  decodeLightningSparkAddress,
  deriveLightningSparkIdentityPublicKey,
  encodeLightningSparkAddress,
} from '../lightningSpark';

import type { IBip32ExtendedKey } from '../bip32';

// Expected values come from the Python reference implementation in the
// Lightning handoff (tools/bip85/bip85_check.py, stdlib only, English wordlist
// from bitcoin/bips@100ba872). They are external vectors on purpose: internal
// consistency across platforms is not proof of following BIP-85.

function rootFromXprv(xprv: string): IBip32ExtendedKey {
  const decoded = Buffer.from(bs58check.decode(xprv));
  return {
    chainCode: decoded.subarray(13, 45),
    key: decoded.subarray(46, 78),
  };
}

function rootFromMnemonic(mnemonic: string, passphrase = '') {
  return generateSecp256k1MasterKeyFromSeed(
    mnemonicToSeedSync(mnemonic, passphrase),
  );
}

describe('BIP-85 spec vectors (bip-0085.mediawiki @100ba872)', () => {
  const root = rootFromXprv(
    'xprv9s21ZrQH143K2LBWUUQRFXhucrQqBpKdRRxNVq2zBqsx8HVqFk2uYo8kmbaLLHRdqtQpUm98uKfu3vca1LqdGhUtyoFnCNkfmXRyPXLjbKb',
  );

  it.each([
    {
      label: 'TC1',
      path: [BIP85_PURPOSE, 0, 0],
      derivedKey:
        'cca20ccb0e9a90feb0912870c3323b24874b0ca3d8018c4b96d0b97c0e82ded0',
      entropy:
        'efecfbccffea313214232d29e71563d941229afb4338c21f9517c41aaa0d16f00b83d2a09ef747e7a64e8e2bd5a14869e693da66ce94ac2da570ab7ee48618f7',
    },
    {
      label: 'TC2',
      path: [BIP85_PURPOSE, 0, 1],
      derivedKey:
        '503776919131758bb7de7beb6c0ae24894f4ec042c26032890c29359216e21ba',
      entropy:
        '70c6e3e8ebee8dc4c0dbba66076819bb8c09672527c4277ca8729532ad711872218f826919f6b67218adde99018a6df9095ab2b58d803b5b93ec9802085a690e',
    },
  ])('$label', ({ path, derivedKey, entropy }) => {
    const result = deriveBip85({ root, path });
    expect(result.derivedKey.toString('hex')).toBe(derivedKey);
    expect(result.entropy.toString('hex')).toBe(entropy);
  });

  it('BIP39 application, English, 12 words, index 0', () => {
    const { entropy } = deriveBip85({
      root,
      path: [BIP85_PURPOSE, 39, 0, 12, 0],
    });
    const childEntropy = entropy.subarray(0, 16);
    expect(childEntropy.toString('hex')).toBe(
      '6250b68daf746d12a24d58b4787a714b',
    );
    expect(entropyToMnemonic(childEntropy, wordlists.english)).toBe(
      'girl mad pet galaxy egg matter matrix prison refuse sense ordinary nose',
    );
  });

  it('rejects empty paths and indices that are already hardened', () => {
    expect(() => deriveBip85({ root, path: [] })).toThrow();
    expect(() =>
      deriveBip85({ root, path: [BIP85_PURPOSE, 0x80_00_00_00] }),
    ).toThrow();
  });
});

describe('BitBox02 LN vectors (keystore.rs test_bip85_ln @27d03b6)', () => {
  const root = rootFromMnemonic(
    'virtual weapon code laptop defy cricket vicious target wave leopard garden give',
  );

  it.each([
    { index: 0, entropy: '3a5f3b888aab88e2a9ab991b60a03ed8' },
    { index: 1, entropy: 'e7d9ce75f8cb17570e665417b47fa0be' },
    { index: 2_147_483_647, entropy: '1f3b75ea252749700a1e453469148ca6' },
  ])('app 19534 index $index', ({ index, entropy }) => {
    const result = deriveBip85({
      root,
      path: [BIP85_PURPOSE, 19_534, 0, 12, index],
    });
    expect(result.entropy.subarray(0, 16).toString('hex')).toBe(entropy);
  });

  it('BIP39 application child mnemonic', () => {
    const { entropy } = deriveBip85({
      root,
      path: [BIP85_PURPOSE, 39, 0, 12, 0],
    });
    expect(entropyToMnemonic(entropy.subarray(0, 16), wordlists.english)).toBe(
      'slender whip place siren tissue chaos ankle door only assume tent shallow',
    );
  });
});

describe('OneKey Lightning (OKLN) vectors, spec v1', () => {
  it('pins the application number and path', () => {
    expect(LIGHTNING_SPARK_BIP85_APP).toBe(Buffer.from('OKLN').readUInt32BE(0));
    expect(LIGHTNING_SPARK_BIP85_PATH).toEqual([
      83_696_968, 1_330_334_798, 0, 12, 0,
    ]);
    // Spark account templates embed the coin type as the path's second element.
    expect(COINTYPE_LIGHTNING_SPARK).toBe(String(LIGHTNING_SPARK_BIP85_APP));
  });

  // The regtest identities and addresses of the cases with an empty, Chinese
  // and full-width passphrase on the 12-word mnemonic were also confirmed
  // against Breez SDK 0.26.1 connect(Seed.Mnemonic) on regtest (2026-10-27).
  it.each([
    {
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: '',
      kPublicKey:
        '02f78362f64bf12a0884335ae0fa57ed0601756645c945c45673f3f542fa510791',
      childEntropy: '527b9d073f9bc922e42f82b213b239e9',
      childMnemonic:
        'fame table dove left route multiply mouse utility rare outside mobile square',
      identityRegtest:
        '0234bd9573b850f495f52e9801cfc9023b898b31a4eef314f404dc158b414b9027',
      identityMainnet:
        '028033ca289d5e5062a46f2f959a88448a899401fd6edbd2d22268f5df6018c2c0',
      sparkAddressRegtest:
        'sparkrt1pgssyd9aj4ems585jh6jaxqpelysywuf3vc6fmhnzn6qfhq43dq5hyp8anlxjm',
      sparkAddressMainnet:
        'spark1pgss9qpneg5f6hjsv2jx7tu4n2yyfz5fjsql6mkm6tfzy684masp3skqscrzqr',
    },
    {
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: 'TREZOR',
      kPublicKey:
        '0222ba292f14dd718c01e96f722e053540fe3fa02bb0392094d29ad5444f620d1a',
      childEntropy: '9a972540a00db6f2b8af51ffa9040bdc',
      childMnemonic:
        'once rice expand divorce swarm junk tired tuition zero else actual retreat',
      identityRegtest:
        '03760fa5d69d7ab87a116bdeb2d09eec2adc2fe7cdd682ab483f101214ed7f6232',
      identityMainnet:
        '02b6118ff2b6677d5e5fe73ac2f6da5e546190f59f4a3fea8f09ea3a2e005ab1e0',
      sparkAddressRegtest:
        'sparkrt1pgssxas05htf674c0ggkhh4j6z0wc2ku9lnum45z4dyr7yqjznkh7c3jfvwquu',
      sparkAddressMainnet:
        'spark1pgss9ds33letvemate07wwkz7md9u4rpjr6e7j3la28sn6369cq94v0qm7xev9',
    },
    {
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: '闪电钱包',
      kPublicKey:
        '03b9742d84400053fe19f3b3702a0695512fb3bd225643a98d667c6e3a8b67677d',
      childEntropy: '6d5b5e6528472d04bbdbf6d48c0e3303',
      childMnemonic:
        'hood sustain off explain index liquid urge learn stand gather mimic allow',
      identityRegtest:
        '037fc619c4b225880897dd40f12721120fee767ef12c9daa400a2438608959adc3',
      identityMainnet:
        '03a4c08428068f51375891d34abbc01740e39614769ca2aa33308295b5f35b3c11',
      sparkAddressRegtest:
        'sparkrt1pgssxl7xr8ztyfvgpzta6s83yus3yrlwwel0ztya4fqq5fpcvzy4ntwrkm3ygm',
      sparkAddressMainnet:
        'spark1pgss8fxqss5qdr63xavfr562h0qpws8rjc28d89z4genpq54khe4k0q3c7sj8a',
    },
    {
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: 'ｏｎｅｋｅｙ',
      kPublicKey:
        '030aa205656a5a096b497546556722d89d169ce44e2bb0f117cfd3e4a40ba22d23',
      childEntropy: 'd5010ab1c73769839fafc7af8452c510',
      childMnemonic:
        'steak analyst property mobile isolate scrub leaf wedding question card rally camera',
      identityRegtest:
        '03acaca8bb2c35736395095cb59e42c4d0a994223430958ca82828e4b0bb06e8f0',
      identityMainnet:
        '02c2e7a7624df9de7be68ff9dbc52e405ba66a0edf12a114991c9ef892ebb2fa61',
      sparkAddressRegtest:
        'sparkrt1pgss8t9v4zajcdtnvw2sjh94nepvf59fjs3rgvy43j5zs28ykzasd68sxun3tv',
      sparkAddressMainnet:
        'spark1pgss9sh85a3ym7w700ngl7wmc5hyqkaxdg8d7y4pzjv3e8hcjt4m97npqhfzyq',
    },
    {
      mnemonic:
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
      passphrase: '',
      kPublicKey:
        '03457068172fd92162a0bd44c44d3fb536c562aae7e416edde6ee23dc11ff2d01d',
      childEntropy: 'dfeba7ce18e06798da6d08228fed9ed0',
      childMnemonic:
        'that frog vicious crack all small have patient card legal guilt park',
      identityRegtest:
        '021d2eaf17833670597b8998c321b781678c7f7d86c5e4f74d64c5dd4588df1342',
      identityMainnet:
        '03b0f8f945697179e4c50567365bee62a7e6ecf67d2d225d47a9acc9ae7ff59fc4',
      sparkAddressRegtest:
        'sparkrt1pgssy8fw4utcxdnst9acnxxryxmczeuv0a7cd30y7axkf3wagkyd7y6zgyf0nz',
      sparkAddressMainnet:
        'spark1pgss8v8cl9zkjuteunzs2eekt0hx9flxanm86tfzt4r6ntxf4ellt87ygr2ywf',
    },
    {
      mnemonic:
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
      passphrase: 'TREZOR',
      kPublicKey:
        '033b37b8610ea73859927590cd7086cbfad19d5fcedbab93ce8872fde0a861bbf4',
      childEntropy: '16017ff10472f74122fee9b9131d8d58',
      childMnemonic:
        'bid armor wisdom angry control party message tag ribbon ocean globe ramp',
      identityRegtest:
        '026cf7255ba466794d48ea19b099a05453ce7415abb3d4e2a6d14a1cc8f96a4922',
      identityMainnet:
        '02713b5991f473c5d4070a5ab1c0c371807375f987d56f57642d60f88068483b18',
      sparkAddressRegtest:
        'sparkrt1pgssym8hy4d6genef4yw5xdsnxs9g57wws26hv75u2ndzjsueruk5jfzp5lfsr',
      sparkAddressMainnet:
        'spark1pgssyufmtxglgu796srs5k43crphrqrnwhuc04t02ajz6c8csp5yswccqws7gv',
    },
    {
      mnemonic:
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
      passphrase: '闪电钱包',
      kPublicKey:
        '03cbdfc056a7916e97ec971fc2b5ac794a5e2ca20cb0fd1bbf3a6ff17c5770e4c5',
      childEntropy: 'ba9425e4ab602d411464ed70197d190b',
      childMnemonic:
        'ritual patrol junior fine actress party face oval hybrid slogan edge blind',
      identityRegtest:
        '03423be2b2d956e330812e08f78e607833f1b35b897b6c6352f6063082051d9d5d',
      identityMainnet:
        '023e649e698f8879bb8e0faf02a3724d47f60dd5397dc73b0d46e52d3d96d043b8',
      sparkAddressRegtest:
        'sparkrt1pgssxs3mu2edj4hrxzqjuz8h3es8svl3kddcj7mvvdf0vp3ssgz3m82a8qapaa',
      sparkAddressMainnet:
        'spark1pgssy0nyne5clzrehw8qltcz5dey63lkph2njlw88vx5defd8ktdqsacchenyt',
    },
    {
      mnemonic:
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
      passphrase: 'ｏｎｅｋｅｙ',
      kPublicKey:
        '026af4a0257a29abe5caa1181d961a96d4de8f50178d026d25cc47dbcfcad5a75a',
      childEntropy: '7e7a3a1ab2feff8b7b082a2bf4df56c7',
      childMnemonic:
        'lazy spike mammal grass useful shield umbrella aim cloud plunge stick mom',
      identityRegtest:
        '0365af571cde8d3b8920afce3f58d5aaf13279cd5aa1e4267fd9be1547f511e254',
      identityMainnet:
        '0265d2f09c96bc5ac3ca2f5d26dfad9b65a5c74202898855fd8bdec295f4fb8439',
      sparkAddressRegtest:
        'sparkrt1pgssxed02uwdarfm3ys2ln3ltr264ufj08x44g0yyelan0s4gl63rcj5gyc4rf',
      sparkAddressMainnet:
        'spark1pgssyewj7zwfd0z6c09z7hfxm7keked9capq9zvg2h7chhkzjh60hppeazfdfz',
    },
  ])(
    '$mnemonic / passphrase $passphrase',
    ({
      mnemonic,
      passphrase,
      kPublicKey,
      childEntropy,
      childMnemonic,
      identityRegtest,
      identityMainnet,
      sparkAddressRegtest,
      sparkAddressMainnet,
    }) => {
      const { derivedKey, entropy } = deriveBip85({
        root: rootFromMnemonic(mnemonic, passphrase),
        path: LIGHTNING_SPARK_BIP85_PATH,
      });
      expect(secp256k1.publicFromPrivate(derivedKey).toString('hex')).toBe(
        kPublicKey,
      );
      expect(entropy.subarray(0, 16).toString('hex')).toBe(childEntropy);

      const child = deriveLightningSparkChildMnemonic({
        seed: mnemonicToSeedSync(mnemonic, passphrase),
      });
      expect(child).toBe(childMnemonic);
      expect(child.split(' ')).toHaveLength(12);

      const regtest = deriveLightningSparkIdentityPublicKey({
        childMnemonic: child,
        network: 'regtest',
      });
      const mainnet = deriveLightningSparkIdentityPublicKey({
        childMnemonic: child,
        network: 'mainnet',
      });
      expect(regtest.toString('hex')).toBe(identityRegtest);
      expect(mainnet.toString('hex')).toBe(identityMainnet);
      expect(
        encodeLightningSparkAddress({
          identityPublicKey: regtest,
          network: 'regtest',
        }),
      ).toBe(sparkAddressRegtest);
      expect(
        encodeLightningSparkAddress({
          identityPublicKey: mainnet,
          network: 'mainnet',
        }),
      ).toBe(sparkAddressMainnet);
    },
  );

  it('normalizes the passphrase with NFKD before stretching', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const composed = deriveLightningSparkChildMnemonic({
      seed: mnemonicToSeedSync(mnemonic, 'café'),
    });
    const decomposed = deriveLightningSparkChildMnemonic({
      seed: mnemonicToSeedSync(mnemonic, 'café'),
    });
    expect(composed).toBe(decomposed);
  });

  it('matches an address produced by the Breez SDK', () => {
    expect(
      encodeLightningSparkAddress({
        identityPublicKey: Buffer.from(
          '0376f1a5958538510a5aaed0b1798faa8451e467cf4fd3ceb73fa148b6bfd73e74',
          'hex',
        ),
        network: 'regtest',
      }),
    ).toBe(
      'sparkrt1pgssxah35k2c2wz3pfd2a5930x864pz3u3nu7n7ne6mnlg2gk6law0n5fuwwny',
    );
  });
});

describe('Spark address decoding', () => {
  const identityHex =
    '0376f1a5958538510a5aaed0b1798faa8451e467cf4fd3ceb73fa148b6bfd73e74';
  const regtestAddress =
    'sparkrt1pgssxah35k2c2wz3pfd2a5930x864pz3u3nu7n7ne6mnlg2gk6law0n5fuwwny';

  it('round-trips the identity public key', () => {
    expect(
      decodeLightningSparkAddress({
        address: regtestAddress,
        network: 'regtest',
      }).identityPublicKey.toString('hex'),
    ).toBe(identityHex);
  });

  it('rejects other networks, mixed case, bad checksums and bad keys', () => {
    const mainnetAddress = encodeLightningSparkAddress({
      identityPublicKey: Buffer.from(identityHex, 'hex'),
      network: 'mainnet',
    });
    const notOnCurve = encodeLightningSparkAddress({
      identityPublicKey: Buffer.from(`02${'00'.repeat(32)}`, 'hex'),
      network: 'regtest',
    });
    const invalidInputs = [
      { address: mainnetAddress, network: 'regtest' as const },
      { address: regtestAddress, network: 'mainnet' as const },
      { address: regtestAddress.toUpperCase(), network: 'regtest' as const },
      {
        address: `${regtestAddress.slice(0, -1)}q`,
        network: 'regtest' as const,
      },
      { address: notOnCurve, network: 'regtest' as const },
      {
        address: 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080',
        network: 'regtest' as const,
      },
    ];
    for (const input of invalidInputs) {
      expect(() => decodeLightningSparkAddress(input)).toThrow(
        'Invalid Spark address',
      );
    }
  });
});
