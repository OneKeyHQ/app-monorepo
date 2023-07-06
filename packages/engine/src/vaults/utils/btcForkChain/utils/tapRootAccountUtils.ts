import { Address } from '../../../impl/btc/inscribe/sdk';

import type { ITaprootAddressInfo } from '../../../impl/btc/inscribe/types';
import type { Networks } from '@cmdcode/tapscript';

class TapRootAccountUtils {
  parseAddress({ address }: { address: string }): ITaprootAddressInfo {
    const tapKey = Address.p2tr.decode(address).hex;
    const scriptPubKey = `5120${tapKey}`;
    return {
      address,
      tapKey,
      scriptPubKey,
    };
  }

  parseTapKey({
    tapKey,
    network,
  }: {
    tapKey: string;
    network: Networks;
  }): ITaprootAddressInfo {
    const address = Address.p2tr.encode(tapKey, network);
    const scriptPubKey = `5120${tapKey}`;
    return {
      address,
      tapKey,
      scriptPubKey,
    };
  }

  parseScriptPubKey({
    scriptPubKey,
    network,
  }: {
    scriptPubKey: string;
    network: Networks;
  }) {
    const tapKey = scriptPubKey.replace(/^5120/gi, '');
    return this.parseTapKey({ tapKey, network });
  }
}

const tapRootAccountUtils = new TapRootAccountUtils();

export { tapRootAccountUtils };
