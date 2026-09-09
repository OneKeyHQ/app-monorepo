import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { OffchainMessage } from './OffchainMessage';

// yarn jest packages/core/src/chains/sol/sdkSol/OffchainMessageV1Sign.test.ts

/**
 * End-to-end check of the version 1 offchain message signing path:
 * what the wallet signs must be byte-identical to what a dapp rebuilds from the spec,
 * otherwise the dapp cannot verify the signature it gets back.
 */
describe('Offchain message v1 signing', () => {
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
  const address = new PublicKey(keypair.publicKey).toBase58();

  // Mirrors CoreChainSoftware.signMessage's version 1 branch.
  const walletSign = (message: string, requiredSigners: string[]) => {
    const signedOffchainMessage = OffchainMessage.createOffChainMessageV1Bytes({
      message,
      requiredSigners: requiredSigners.map((signer) => bs58.decode(signer)),
    });
    const signature = nacl.sign.detached(
      Buffer.from(signedOffchainMessage),
      keypair.secretKey,
    );
    return {
      signature: bs58.encode(signature),
      signedOffchainMessage: bs58.encode(signedOffchainMessage),
    };
  };

  it('should produce a signature the dapp can verify against rebuilt bytes', () => {
    const message = 'Hello from the dapp!';
    const result = walletSign(message, [address]);

    // The dapp only knows the message and the required signers, and rebuilds the bytes.
    const rebuilt = OffchainMessage.createOffChainMessageV1Bytes({
      message,
      requiredSigners: [bs58.decode(address)],
    });

    expect(bs58.encode(rebuilt)).toBe(result.signedOffchainMessage);
    expect(
      nacl.sign.detached.verify(
        rebuilt,
        bs58.decode(result.signature),
        keypair.publicKey,
      ),
    ).toBe(true);
  });

  it('should stay verifiable when the dapp passes signers in a different order', () => {
    const message = 'multi signer message';
    const other = new PublicKey(new Uint8Array(32).fill(9)).toBase58();

    const walletResult = walletSign(message, [address, other]);
    const rebuilt = OffchainMessage.createOffChainMessageV1Bytes({
      message,
      // dapp rebuilds with the opposite order; sorting must make them converge
      requiredSigners: [other, address].map((signer) => bs58.decode(signer)),
    });

    expect(bs58.encode(rebuilt)).toBe(walletResult.signedOffchainMessage);
    expect(
      nacl.sign.detached.verify(
        rebuilt,
        bs58.decode(walletResult.signature),
        keypair.publicKey,
      ),
    ).toBe(true);
  });

  it('should not be verifiable against version 0 bytes', () => {
    const message = 'Hello from the dapp!';
    const result = walletSign(message, [address]);

    const v0Bytes = Buffer.from(
      OffchainMessage.createOffChainMessage({
        message,
        signerPublicKeys: [bs58.decode(address)],
        applicationDomain: 'test.app',
        format: 0,
        isLegacy: false,
      }),
      'hex',
    );

    expect(
      nacl.sign.detached.verify(
        v0Bytes,
        bs58.decode(result.signature),
        keypair.publicKey,
      ),
    ).toBe(false);
  });
});
