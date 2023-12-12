import { bytesToHex } from '@noble/hashes/utils';
import * as bip39 from 'bip39';

import { getBitcoinBip32 } from '../../../utils/btcForkChain/utils';

import {
  NOSTR_ADDRESS_INDEX,
  getNip19EncodedPubkey,
  getNostrPath,
} from './NostrSDK';

const fixtures = [
  {
    mnemonic:
      'leader monkey parrot ring guide accident before fence cannon height naive bean',
    password: '',
    privateKey:
      '7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a',
    nsec: 'nsec10allq0gjx7fddtzef0ax00mdps9t2kmtrldkyjfs8l5xruwvh2dq0lhhkp',
    pubkey: '17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917',
    npub: 'npub1zutzeysacnf9rru6zqwmxd54mud0k44tst6l70ja5mhv8jjumytsd2x7nu',
  },
  {
    mnemonic:
      'what bleak badge arrange retreat wolf trade produce cricket blur garlic valid proud rude strong choose busy staff weather area salt hollow arm fade',
    password: '',
    privateKey:
      'c15d739894c81a2fcfd3a2df85a0d2c0dbc47a280d092799f144d73d7ae78add',
    nsec: 'nsec1c9wh8xy5eqdzln7n5t0ctgxjcrdug73gp5yj0x03gntn67h83twssdfhel',
    pubkey: 'd41b22899549e1f3d335a31002cfd382174006e166d3e658e3a5eecdb6463573',
    npub: 'npub16sdj9zv4f8sl85e45vgq9n7nsgt5qphpvmf7vk8r5hhvmdjxx4es8rq74h',
  },
];

describe('test Nostr', () => {
  // https://github.com/nostr-protocol/nips/blob/master/06.md
  test('NIP-06 Basic key derivation from mnemonic seed phrase', () => {
    fixtures.forEach((fixture) => {
      const seed = bip39.mnemonicToSeedSync(fixture.mnemonic, fixture.password);
      const root = getBitcoinBip32().fromSeed(seed);
      const node = root.derivePath(`${getNostrPath(0)}/${NOSTR_ADDRESS_INDEX}`);
      expect(bytesToHex(node.privateKey ?? Buffer.from(''))).toEqual(
        fixture.privateKey,
      );
      expect(bytesToHex(node.publicKey.slice(1, 33))).toEqual(fixture.pubkey);
      expect(
        getNip19EncodedPubkey(bytesToHex(node.publicKey.slice(1, 33))),
      ).toEqual(fixture.npub);
    });
  });

  // test('NIP-04 Encrypted Direct Message', () => {
  //   const [alice, bob] = fixtures;
  //   const { entropyWithLangPrefixed: aliceEntropy } =
  //     revealableSeedFromMnemonic(alice.mnemonic, alice.password);
  //   const { entropyWithLangPrefixed: bobEntropy } = revealableSeedFromMnemonic(
  //     bob.mnemonic,
  //     bob.password,
  //   );
  //   const aliceNostr = new Nostr(aliceEntropy, alice.password);

  //   const message =
  //     'This is a message sent from Alice to Bob, encrypted using the Nostr NIP-04 protocol.';
  //   const encrypted = aliceNostr.encrypt(bob.pubkey, message);

  //   const bobNostr = new Nostr(bobEntropy, bob.password);

  //   const decrypted = bobNostr.decrypt(alice.pubkey, encrypted);

  //   expect(decrypted).toMatch(message);
  // });
});
