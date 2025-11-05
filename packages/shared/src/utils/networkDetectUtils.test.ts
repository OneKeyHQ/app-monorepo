/* eslint-disable spellcheck/spell-checker */
import { presetNetworksMap } from '../config/presetNetworks';

import networkDetectUtils from './networkDetectUtils';

/*
yarn test packages/shared/src/utils/networkDetectUtils.test.ts
*/

describe('Network Detection by Private Key', () => {
  describe('BTC Series - Extended Private Keys', () => {
    test('detects BTC Legacy (xprv)', async () => {
      const privateKey =
        'xprv9yh7er1pynFJCxmown6L9K9xZARVsXGF8JsD4rULzMR8YifQb31FA3ugMoC9E6XXfTapQxvKS6qMoSYrazeutw26Cm4xo54GTqkm2Rq1CbU';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      });
    });

    test('detects BTC Native SegWit (zprv)', async () => {
      const privateKey =
        'zprvAdLnmntBQG8yBz7ozABuv5NbrGzPoTMDxgZGyEdH6QCs2Ad9BXc5rm15vDJL6rdUPMz531C8xzuqzd6LTMxe7F11doAvm1eiJ3ohx5jx7ND';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual({
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      });
    });

    test('detects BTC Nested SegWit (yprv)', async () => {
      const privateKey =
        'yprvAK1pWtDhs8mfVpomJb6eeBiJysWc9zaMXPgPS8ovnv7Dko28CGsoeAzFbcJZefteGnjbftxEJ2zZJ57D81KgeshBiWc4Fn3wsdgUig5PXhN';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      });
    });

    test('detects BTC Taproot (xprv)', async () => {
      const privateKey =
        'xprv9z3f3zh1W5NWgJ64x7buzP32ChAhT2AxBDbg4DVQjhyJm7x5V5UmD7KsYNmxzZakidFZdyBB2rC6QK2sftr6MPH6XgAsDgfzvcHGKfWWbCW';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual({
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      });
    });

    test('detects BCH (xprv)', async () => {
      const privateKey =
        'xprv9zKmn6V4XdvEwD1c8gW9funqQQV1Z6EckKjAt31WJPV9vccu4mMqsj1Qk4FbWTJZzH2WurGgaVAn4hnZuWd2uYm7jLfyEpwef5E2h2Xc53Y';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.bch.id,
        impl: presetNetworksMap.bch.impl,
      });
    });

    test('detects Neurai (xprv)', async () => {
      const privateKey =
        'xprv9zHrJk3zbu6aXR5HrR7hnaJ7B4nbLZ4ZrAWDtwaqs31R8tK3ypLDoVGgdayCbdzJs8vFpnE1KRvZ5UUtWDg4pdgrsUpJ35gyXNYSUoBPAXq';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.neurai.id,
        impl: presetNetworksMap.neurai.impl,
      });
    });
  });

  describe('BTC Testnet - Extended Private Keys', () => {
    test('detects TBTC Legacy (tprv)', async () => {
      const privateKey =
        'tprv8fRswazqdbgVGW3ZVA7ziodfxNL3xDphbckQsBaWMKbZCqkCtYhqJaHbdKVkQDqFSWx4SWbi39NAkvejHZbMitjMYp2YibVuuYkTQ8SoWEz';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.tbtc.id,
          impl: presetNetworksMap.tbtc.impl,
        },
      ]);
    });

    test('detects TBTC Native SegWit (vprv)', async () => {
      const privateKey =
        'vprv9KF3u9XUrrEGpz8v9PNA7iWJwaxG2aLqQAao1ykH5XCHs9TwBoD22YG7WAiwn6NhymqPhEq4tXufwA6eNHzjgPTYbZ7sRBQcwF2ZFyCCXer';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.tbtc.id,
          impl: presetNetworksMap.tbtc.impl,
        },
      ]);
    });

    test('detects TBTC Nested SegWit (uprv)', async () => {
      const privateKey =
        'uprv91kHPF7vFcZmvs2gWw5occocgsdb7uCiJPhgiyw58tNcQaVoki9vqiTinq2sLgjy383Tfuwn8hsEUYK8Hr5y5Eabee78BqEv6QJMMj27tta';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.tbtc.id,
          impl: presetNetworksMap.tbtc.impl,
        },
      ]);
    });

    test('detects TBTC Taproot (tprv)', async () => {
      const privateKey =
        'tprv8gkVsRsnRBrunsHp1RhHpXgsDPv7BRC3xeiE4tonXfpcQGNP1YEyiYHDe2q62aYuDsSQZY56RT6rQGt8UJ2uvShG1bRt3S4rSN4T9Mo9s8S';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.tbtc.id,
          impl: presetNetworksMap.tbtc.impl,
        },
      ]);
    });
  });

  describe('Litecoin - Extended Private Keys', () => {
    test('detects LTC Legacy (Ltpv)', async () => {
      const privateKey =
        'Ltpv78KssZW51d5MEerJkXP6JfNGGCBbbhYdQD4w6KaJdHW7WsrG8GsqJ3Ccc6tNVcaMwLcBkYzApfh2Dx12gb67FGDTaCvRoKbTg4mFgWSnQ5J';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.ltc.id,
          impl: presetNetworksMap.ltc.impl,
        },
      ]);
    });

    test('detects LTC Native SegWit (zprv) - shared with BTC', async () => {
      const privateKey =
        'zprvAcr9AQ7AMJRhe1TMXF3wAt2SyCfGHECx9Ruc6KXg2q5wjyFiGshPTo52yjFnE2HhyVrX15MmP4mwuwssE29kpa6daFRfsRprhDTPonGNwui';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      // Should detect both BTC and LTC
      expect(result).toContainEqual({
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.ltc.id,
        impl: presetNetworksMap.ltc.impl,
      });
    });

    test('detects LTC Nested SegWit (Mtpv)', async () => {
      const privateKey =
        'Mtpv7TRKRrj3u3BtgceHPeAYwW4mPAavSiaM3p4nmNxokDiwMLV1NKBJ5fUxW9WnchrS22CYJ7yLXqp8VeouyECYVejKARzRSPBsqKnRVjUCqh7';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.ltc.id,
          impl: presetNetworksMap.ltc.impl,
        },
      ]);
    });
  });

  describe('Dogecoin - Extended Private Keys', () => {
    test('detects DOGE (dgpv)', async () => {
      const privateKey =
        'dgpv58tkpgt8udMcqnJrCswRYNsJe8sY7VZkrwypFqD7PKTwN4Sdz4cLSULcvGdCF7cphd34zEYufT3D4aowgxMnsHomhgpL3aMtM5dG1NRFWeA';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.doge.id,
          impl: presetNetworksMap.doge.impl,
        },
      ]);
    });
  });

  describe('Cardano - Extended Private Keys', () => {
    test('detects Cardano (xprv1)', async () => {
      const privateKey =
        'xprv1pz8k3cag6yh8lhdzv8me3cjz6504z424catmccpkfre97qwmyay0rvxrfgyrffyc9w2p0tnh2rhjyl5nr5n2yl0kc45trt0zukajkhteg36tq6ukwpgxhcxjlhhm8cyaxyruptn8f2ml3fl4y3gq7qxqzqcqfu854y';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.cardano.id,
          impl: presetNetworksMap.cardano.impl,
        },
      ]);
    });
  });

  describe('0x-prefixed 64 hex - Multi-chain Detection', () => {
    test('detects ETH and other 0x-prefixed chains', async () => {
      const privateKey =
        '0xf357470894ac56d21893d045001e207509bbeae7b9004d08ab099a60176c376a';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      // Should detect multiple chains
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual({
        networkId: presetNetworksMap.eth.id,
        impl: presetNetworksMap.eth.impl,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.kaspa.id,
        impl: presetNetworksMap.kaspa.impl,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.polkadot.id,
        impl: presetNetworksMap.polkadot.impl,
      });
    });

    test('detects Cosmos family (0x-prefixed)', async () => {
      const privateKey =
        '0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.cosmoshub.id,
        impl: presetNetworksMap.cosmoshub.impl,
      });
    });

    test('detects Aptos (0x-prefixed)', async () => {
      const privateKey =
        '0x25cb5c737d8bff654fc62a6af4b00224f3a4b5c963a898a7e8ea9f08cbda5b2a';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.aptos.id,
        impl: presetNetworksMap.aptos.impl,
      });
    });

    test('detects Sui (0x-prefixed)', async () => {
      const privateKey =
        '0x644fedb8ebfec83d4a1cc983beb499048f8199bf72c8e8e57d5775603b8c5dd1';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.sui.id,
        impl: presetNetworksMap.sui.impl,
      });
    });

    test('detects Conflux (0x-prefixed)', async () => {
      const privateKey =
        '0x5f4c247c0fcd8430ccc2cbd2eba2def7b85860f7a353ab43f58bbb2249665d15';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.cfx.id,
        impl: presetNetworksMap.cfx.impl,
      });
    });

    test('detects BenFen (0x-prefixed)', async () => {
      const privateKey =
        '0x81164a30cdd8552b2fdb8de0f7188b97c7e160099ecac7eb3fa4d7d8460f8e9a';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.benfen.id,
        impl: presetNetworksMap.benfen.impl,
      });
    });

    test('detects Nervos/CKB (0x-prefixed)', async () => {
      const privateKey =
        '0xdae4fea05307de23c96125b5a514eb1991913dfbd863b599e804ebaa450bb44b';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.ckb.id,
        impl: presetNetworksMap.ckb.impl,
      });
    });

    test('detects Polkadot (0x-prefixed)', async () => {
      const privateKey =
        '0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.polkadot.id,
        impl: presetNetworksMap.polkadot.impl,
      });
    });
  });

  describe('64 hex without 0x prefix - Multi-chain Detection', () => {
    test('detects TON (64 hex no prefix)', async () => {
      const privateKey =
        'e37632253d40d954f56ebf0593c56c6cf52ecd46dbcc40b055334cba18d8bc5e';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.ton.id,
        impl: presetNetworksMap.ton.impl,
      });
    });

    test('detects TRON (64 hex no prefix)', async () => {
      const privateKey =
        'e777082ffadf85dbb56176c04add4cc104e244b3061260c8d4120619da80df25';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.tron.id,
        impl: presetNetworksMap.tron.impl,
      });
    });

    test('detects Kaspa (64 hex no prefix)', async () => {
      const privateKey =
        'ae5ab015a709194d1c8bcc06892c13ac4ff4b18687714ec1e2cf7ca33d570773';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual({
        networkId: presetNetworksMap.kaspa.id,
        impl: presetNetworksMap.kaspa.impl,
      });
    });

    test('detects Nexa (64 hex no prefix)', async () => {
      const privateKey =
        '66bbcedd3a66c7e110a9bce152c646d8c2d17c43783319c623e489bf86dafa47';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toContainEqual({
        networkId: presetNetworksMap.nexa.id,
        impl: presetNetworksMap.nexa.impl,
      });
    });
  });

  describe('Solana - Base58 Private Keys', () => {
    test('detects Solana bip44 (Base58 87-88 chars)', async () => {
      const privateKey =
        '2RBoeu3fhpNFZ5QdDSRZaRtnFMSUe4WjtXbnjZHijwWUzpz19Bxa8jBghq8mQexEXBzSAnGd3xsrwC3vWqr7NN21';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.sol.id,
          impl: presetNetworksMap.sol.impl,
        },
      ]);
    });

    test('detects Solana ledger live (Base58 87-88 chars)', async () => {
      const privateKey =
        '2fuk2nFbn2K7UKeLzjHJKUdc319LVHMBtR79BjM8v2vENYeoSM3gHqKtWBYxPVhKgdcf7yCNy5co8tc1hX24ZfH';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.sol.id,
          impl: presetNetworksMap.sol.impl,
        },
      ]);
    });
  });

  describe('Algorand - Mnemonic Format', () => {
    test('detects Algorand (mnemonic with spaces)', async () => {
      const privateKey =
        'comic alter amused vendor hold food adapt ring evoke security current mandate plate market despair industry use under yard survey picnic odor jewel absent symbol';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.algo.id,
          impl: presetNetworksMap.algo.impl,
        },
      ]);
    });
  });

  describe('Filecoin - Long Hex String', () => {
    test('detects Filecoin (150+ hex chars)', async () => {
      const privateKey =
        '7b2254797065223a22736563703235366b31222c22507269766174654b6579223a227050415a744c5344353451425039754c6b2b395350356e4150434f34473876312b4d63594b5666567175733d227d';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.fil.id,
          impl: presetNetworksMap.fil.impl,
        },
      ]);
    });
  });

  describe('NEAR - ed25519 Prefix', () => {
    test('detects NEAR (ed25519: prefix)', async () => {
      const privateKey =
        'ed25519:F3GHuuNKq6CnkcpQkaHfv2nuw7EWjcZnfZ8c3bwhQePsiRBYoeKeEH2Zz6xKWimEf2N4koXE3AmSbjyBy7wFSJd';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.near.id,
          impl: presetNetworksMap.near.impl,
        },
      ]);
    });
  });

  describe('Ripple - 66 Uppercase Hex', () => {
    test('detects Ripple (66 uppercase hex chars)', async () => {
      const privateKey =
        '0099FA332D42C7A99727D47BD0BB47F14655ACE7F64C56E795997011EECD348E7D';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.ripple.id,
          impl: presetNetworksMap.ripple.impl,
        },
      ]);
    });
  });

  describe('Edge Cases', () => {
    test('returns empty array for empty string', async () => {
      const privateKey = '';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([]);
    });

    test('returns empty array for invalid format', async () => {
      const privateKey = 'invalid_private_key_format_12345';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([]);
    });

    test('trims whitespace before detection', async () => {
      const privateKey =
        '  dgpv58tkpgt8udMcqnJrCswRYNsJe8sY7VZkrwypFqD7PKTwN4Sdz4cLSULcvGdCF7cphd34zEYufT3D4aowgxMnsHomhgpL3aMtM5dG1NRFWeA  ';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([
        {
          networkId: presetNetworksMap.doge.id,
          impl: presetNetworksMap.doge.impl,
        },
      ]);
    });

    test('returns empty array for short random string', async () => {
      const privateKey = 'abc123';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result).toEqual([]);
    });

    test('handles mixed case hex with 0x prefix', async () => {
      const privateKey =
        '0xF357470894AC56d21893d045001e207509BBEAE7b9004d08ab099a60176c376a';
      const result = await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual({
        networkId: presetNetworksMap.eth.id,
        impl: presetNetworksMap.eth.impl,
      });
    });
  });
});
