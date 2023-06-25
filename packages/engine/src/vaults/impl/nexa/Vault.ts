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

import memoizee from 'memoizee';

import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_NEXA } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../errors';
import { VaultBase } from '../../VaultBase';

import {
  KeyringHardware,
  KeyringHd,
  KeyringImported,
  KeyringWatching,
} from './keyring';
import Provider from './provider';
import { Nexa } from './sdk';
import settings from './settings';
import { verifyNexaAddress } from './utils';

import type { BaseClient } from '../../../client/BaseClient';
import type { IClientEndpointStatus } from '../../types';
import type BigNumber from 'bignumber.js';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override settings = settings;

  override createClientFromURL(url: string): BaseClient {
    return new Nexa(url);
  }

  createSDKClient = memoizee(
    async (rpcUrl: string, networkId: string) => {
      const sdkClient = this.createClientFromURL(rpcUrl) as Nexa;
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(networkId);
      // TODO move to base, setChainInfo like what ProviderController.getClient() do
      sdkClient.setChainInfo(chainInfo);
      return sdkClient;
    },
    {
      promise: true,
      primitive: true,
      normalizer(
        args: Parameters<(rpcUrl: string, networkId: string) => Promise<Nexa>>,
      ): string {
        return `${args[0]}:${args[1]}`;
      },
      max: 1,
      maxAge: 1000 * 60 * 15,
    },
  );

  async getSDKClient(): Promise<Nexa> {
    const { rpcURL } = await this.getNetwork();
    return this.createSDKClient(rpcURL, this.networkId);
  }

  override async getClientEndpointStatus(): Promise<IClientEndpointStatus> {
    const client = await this.getSDKClient();
    const start = performance.now();
    const latestBlock = (await client.getInfo()).bestBlockNumber;
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async validateAddress(address: string): Promise<string> {
    const { isValid, normalizedAddress } = verifyNexaAddress(address);
    if (isValid) {
      return Promise.resolve(normalizedAddress || address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<Array<BigNumber | undefined>> {
    // Abstract requests
    const client = await this.getSDKClient();
    return client.getBalances(
      requests.map(({ address, tokenAddress }) => ({
        address,
        coin: { ...(typeof tokenAddress === 'string' ? { tokenAddress } : {}) },
      })),
    );
  }
}
