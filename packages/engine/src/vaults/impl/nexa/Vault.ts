// import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
// import { COINTYPE_BCH } from '@onekeyhq/shared/src/engine/engineConsts';

// import { VaultBase } from '../../VaultBase';

// import { KeyringHardware } from './KeyringHardware';
// import { KeyringHd } from './KeyringHd';
// import { KeyringImported } from './KeyringImported';
// import { KeyringWatching } from './KeyringWatching';
// import Provider from './provider';
// import settings from './settings';

// import type { AccountCredentialType } from '../../../types/account';
// import type { PartialTokenInfo } from '../../../types/provider';
// import type { WalletType } from '../../../types/wallet';
// import type { KeyringBaseMock } from '../../keyring/KeyringBase';
// import type {
//   IApproveInfo,
//   IDecodedTx,
//   IEncodedTx,
//   IEncodedTxUpdateOptions,
//   IFeeInfo,
//   IFeeInfoUnit,
//   ITransferInfo,
//   IUnsignedTxPro,
//   IVaultSettings,
// } from '../../types';
// import type { EVMDecodedItem } from '../evm/decoder/types';

// export default class Vault extends VaultBase {
//   keyringMap = {
//     hd: KeyringHd,
//     hw: KeyringHardware,
//     imported: KeyringImported,
//     watching: KeyringWatching,
//     external: KeyringWatching,
//   };

//   override attachFeeInfoToEncodedTx(params: {
//     encodedTx: IEncodedTx;
//     feeInfoValue: IFeeInfoUnit;
//   }): Promise<IEncodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<EVMDecodedItem> {
//     throw new Error('Method not implemented.');
//   }

//   override buildEncodedTxFromTransfer(
//     transferInfo: ITransferInfo,
//   ): Promise<IEncodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override buildEncodedTxFromApprove(
//     approveInfo: IApproveInfo,
//   ): Promise<IEncodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override updateEncodedTxTokenApprove(
//     encodedTx: IEncodedTx,
//     amount: string,
//   ): Promise<IEncodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override updateEncodedTx(
//     encodedTx: IEncodedTx,
//     payload: any,
//     options: IEncodedTxUpdateOptions,
//   ): Promise<IEncodedTx> {
//     throw new Error('Method not implemented.');
//   }

//   override buildUnsignedTxFromEncodedTx(
//     encodedTx: IEncodedTx,
//   ): Promise<IUnsignedTxPro> {
//     throw new Error('Method not implemented.');
//   }

//   override fetchFeeInfo(
//     encodedTx: IEncodedTx,
//     signOnly?: boolean | undefined,
//     specifiedFeeRate?: string | undefined,
//     transferCount?: number | undefined,
//   ): Promise<IFeeInfo> {
//     throw new Error('Method not implemented.');
//   }

//   override getExportedCredential(
//     password: string,
//     credentialType: AccountCredentialType,
//   ): Promise<string> {
//     throw new Error('Method not implemented.');
//   }

//   override settings: IVaultSettings;

//   override fetchTokenInfos(
//     tokenAddresses: string[],
//   ): Promise<(PartialTokenInfo | undefined)[]> {
//     throw new Error('Method not implemented.');
//   }
// }
import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_NEXA } from '@onekeyhq/shared/src/engine/engineConsts';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import Provider from './provider';
import settings from './settings';

export default class Vault extends VaultBtcFork {
  override providerClass = Provider;

  override keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override settings = settings;

  override getDefaultPurpose() {
    return 44;
  }

  override getCoinName() {
    return 'nexatest';
  }

  override getCoinType() {
    return COINTYPE_NEXA;
  }

  override getXprvReg() {
    return /^([x]prv)/;
  }

  override getXpubReg() {
    return /^([x]pub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [25, 5, 1];
  }

  override getDefaultBlockTime(): number {
    return 600;
  }
}