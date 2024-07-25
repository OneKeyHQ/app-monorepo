import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { IDBAccount } from '../../../dbs/local/types';
import type { IGetPrivateKeysResult } from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.dynex.hd;

  override async getPrivateKeys(): Promise<IGetPrivateKeysResult> {
    throw new NotImplemented('Method not implemented');
  }

  override async prepareAccounts(): Promise<IDBAccount[]> {
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.coming_soon,
      }),
    );
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented('Method not implemented');
  }

  override async signMessage(): Promise<string[]> {
    throw new NotImplemented('Method not implemented');
  }
}
