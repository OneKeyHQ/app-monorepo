import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase | undefined = undefined;

  override verifySignedTxMatched(...args: any[]): Promise<void> {
    throw new NotImplemented();
  }

  override signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override signMessage(): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }

  override async prepareAccounts(): Promise<IDBAccount[]> {
    throw new NotImplemented();
  }
}
