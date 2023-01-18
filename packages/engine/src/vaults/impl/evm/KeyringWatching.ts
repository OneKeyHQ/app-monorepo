import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_ETH as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IEncodedTx,
  IPrepareWatchingAccountsParams,
  ISignCredentialOptions,
} from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  // TODO remove
  override async signTransaction(
    unsignedTx: UnsignedTx,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const encodedTx: IEncodedTx = unsignedTx.payload?.encodedTx;
    const dbAccount = await this.getDbAccount();
    debugLogger.sendTx.info(
      'KeyringWatching > signTransaction >>>>> ',
      dbAccount.address,
      encodedTx,
    );
    // TODO create wc connector, and check peerMeta.url, chainId, accounts matched,
    return Promise.resolve({
      txid: '1111',
      rawTx: '11118888',
    });
  }

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target, accountIdPrefix } = params;
    const { normalizedAddress, isValid } =
      await this.engine.providerManager.verifyAddress(this.networkId, target);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${normalizedAddress}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: normalizedAddress,
      },
    ]);
  }
}
