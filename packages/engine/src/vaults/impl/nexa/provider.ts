import * as bchaddrjs from 'bchaddrjs';
import * as BitcoinForkJS from 'bitcoinforkjs';
import { PublicKey } from 'nexcore-lib';

import { Provider as BaseProvider } from '../../utils/btcForkChain/provider';
import { AddressEncodings } from '../../utils/btcForkChain/types';

import type { Payment, Psbt } from 'bitcoinjs-lib';

export default class Provider extends BaseProvider {
  override decodeAddress(address: string): string {
    if (
      !bchaddrjs.isValidAddress(address) ||
      (bchaddrjs.isCashAddress(address) && !address.startsWith('bitcoincash:'))
    ) {
      throw new Error(`Invalid address: ${address}`);
    }
    if (bchaddrjs.isCashAddress(address)) {
      return bchaddrjs.toLegacyAddress(address);
    }

    return address;
  }

  override pubkeyToPayment(
    pubkey: Buffer,
    encoding: AddressEncodings,
  ): Payment {
    const payment: Payment = {
      pubkey,
      network: this.network,
    };
    switch (encoding) {
      case AddressEncodings.P2PKH:
        const address = new PublicKey(Buffer.from(pubkey).toString('hex'), {
          network: 'nexatest',
        })
          .toAddress()
          .toNexaAddress();
        return {
          pubkey,
          address,
        };

      default:
        throw new Error(`Invalid encoding: ${encoding as string}`);
    }
  }

  override encodeAddress(address: string): string {
    return address;
  }

  override getPsbt(): Psbt {
    // @ts-expect-error
    return new BitcoinForkJS.Psbt({ network: this.network, forkCoin: 'nexa' });
  }
}
