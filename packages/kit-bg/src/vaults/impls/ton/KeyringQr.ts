import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareQrAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase | undefined = undefined;

  override signTransaction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new NotImplemented();
  }
}
