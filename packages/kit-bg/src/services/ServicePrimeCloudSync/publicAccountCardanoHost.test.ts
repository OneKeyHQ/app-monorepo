import { derivePublicAccountAddresses } from '@onekeyhq/core/src/chains/ada/sdkAda/publicAccountAddresses';

jest.mock(
  '@emurgo/cardano-serialization-lib-asmjs',
  () =>
    jest.requireActual<
      typeof import('@emurgo/cardano-serialization-lib-nodejs')
    >('@emurgo/cardano-serialization-lib-nodejs'),
  { virtual: true },
);

const xpub =
  'b26be5c118159882386e2b301486108a9d92cc7346c419f3f8e0fc74e89b0fe3c3c81ca61635db3464f15301413b92747a37c9c1ddb998f1257496903dc55890';
const address =
  'addr1qyrqyaqmp660u4jrpxv5xytsruvl0t644lwxvyvhsm7k3ye8xynpv3levq92pp7cmu7seltu8qxne2thlvpkqpd2k7mquxwa5w';
const stake = 'stake1uynnzfskglukqz4qslvd70gvl47rsrfu49mlkqmqqk4t0ds3rdgqv';

test('derives the existing public-only Cardano vector repeatedly in a single bounded batch', async () => {
  for (let index = 0; index < 20; index += 1) {
    await expect(
      derivePublicAccountAddresses({
        xpub,
        paths: ['0/0', '2/0', '0/0'],
        networkId: 1,
      }),
    ).resolves.toEqual({ '0/0': address, '2/0': stake });
  }
});

test.each(['3/0', '2/1', '0/-1', '0/2147483648', "0/0'", '__proto__', '0/1e3'])(
  'rejects unsupported or hardened public path %s',
  async (path) => {
    await expect(
      derivePublicAccountAddresses({ xpub, paths: [path], networkId: 1 }),
    ).resolves.toBeUndefined();
  },
);

test('rejects malformed public keys and oversized input before calling CSL', async () => {
  await expect(
    derivePublicAccountAddresses({
      xpub: xpub.slice(1),
      paths: ['0/0'],
      networkId: 1,
    }),
  ).resolves.toBeUndefined();
  await expect(
    derivePublicAccountAddresses({
      xpub,
      paths: Array.from({ length: 66 }, () => '0/0'),
      networkId: 1,
    }),
  ).resolves.toBeUndefined();
});
