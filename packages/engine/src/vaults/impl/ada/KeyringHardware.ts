import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { CardanoGetAddressMethodParams, PROTO } from '@onekeyfe/hd-core';

import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';

import { getChangeAddress } from './helper/cardanoUtils';
import { getCardanoApi } from './helper/sdk';
import {
  transformToOneKeyInputs,
  transformToOneKeyOutputs,
} from './helper/transformations';
import { IEncodedTxADA, NetworkId } from './types';

import type AdaVault from './Vault';

const PATH_PREFIX = `m/1852'/${COIN_TYPE}'`;
const ProtocolMagic = 764824073;

export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { indexes, names } = params;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const paths = usedIndexes.map((index) => `${PATH_PREFIX}/${index}'/0/0`);
    const stakingPaths = usedIndexes.map(
      (index) => `${PATH_PREFIX}/${index}'/2/0`,
    );

    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const bundle = paths.map((path, index) => ({
      addressParameters: {
        addressType: PROTO.CardanoAddressType.BASE,
        path,
        stakingPath: stakingPaths[index],
      },
      networkId: NetworkId.MAINNET,
      protocolMagic: 764824073,
      derivationType: PROTO.CardanoDerivationType.ICARUS_TREZOR,
      showOnOneKey,
    })) as CardanoGetAddressMethodParams[];

    let response;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      response = await HardwareSDK.cardanoGetAddress(connectId, deviceId, {
        ...passphraseState,
        bundle,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw deviceUtils.convertDeviceError(response.payload);
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const client = await (this.vault as AdaVault).getClient();
    const ret = [];
    let index = 0;
    const firstAddressRelPath = '0/0';
    const stakingAddressRelPath = '2/0';
    for (const addressInfo of response.payload) {
      const { address, xpub, serializedPath, stakeAddress } = addressInfo;
      if (address) {
        const name =
          (names || [])[index] || `CARDANO #${usedIndexes[index] + 1}`;
        const addresses: Record<string, string> = {
          [firstAddressRelPath]: address,
        };
        if (stakeAddress) {
          addresses[stakingAddressRelPath] = stakeAddress;
        }
        const accountPath = serializedPath.slice(0, -4);
        if (!ignoreFirst || index > 0) {
          ret.push({
            id: `${this.walletId}--${accountPath}`,
            name,
            type: AccountType.UTXO,
            path: serializedPath,
            coinType: COIN_TYPE,
            xpub: xpub ?? '',
            address,
            addresses,
          });
        }

        if (usedIndexes.length === 1) {
          // Only getting the first account, ignore balance checking.
          break;
        }

        const { tx_count: txCount } = await client.getAddressDetails(address);
        if (txCount > 0) {
          index += 1;
          // api rate limit
          await new Promise((r) => setTimeout(r, 200));
        } else {
          break;
        }
      }
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const { path } = params;
    const stakingPath = `${path.split('/').slice(0, 4).join('/')}/2/0`;
    const response = await HardwareSDK.cardanoGetAddress(connectId, deviceId, {
      ...passphraseState,
      addressParameters: {
        addressType: PROTO.CardanoAddressType.BASE,
        path,
        stakingPath,
      },
      networkId: NetworkId.MAINNET,
      protocolMagic: ProtocolMagic,
      derivationType: PROTO.CardanoDerivationType.ICARUS_TREZOR,
      isCheck: true,
      showOnOneKey: true,
    });

    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw deviceUtils.convertDeviceError(response.payload);
  }

  override async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const encodedTx = unsignedTx.payload.encodedTx as unknown as IEncodedTxADA;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const utxos = await (
      await (this.vault as AdaVault).getClient()
    ).getUTXOs(dbAccount);

    const { inputs, outputs, fee, tx } = encodedTx;
    const res = await HardwareSDK.cardanoSignTransaction(connectId, deviceId, {
      ...passphraseState,
      signingMode: PROTO.CardanoTxSigningMode.ORDINARY_TRANSACTION,
      inputs: transformToOneKeyInputs(inputs, utxos),
      outputs: transformToOneKeyOutputs(
        outputs,
        changeAddress.addressParameters,
      ),
      fee,
      protocolMagic: ProtocolMagic,
      derivationType: PROTO.CardanoDerivationType.ICARUS_TREZOR,
      networkId: NetworkId.MAINNET,
      // TODO: certificates, withdrawals
    });

    if (!res.success) {
      throw deviceUtils.convertDeviceError(res.payload);
    }

    const CardanoApi = await getCardanoApi();
    const signedTx = await CardanoApi.hwSignTransaction(
      tx.body,
      res.payload.witnesses,
      {
        signOnly: !!encodedTx.signOnly,
      },
    );

    return {
      rawTx: signedTx,
      txid: tx.hash,
    };
  }

  signMessage(): Promise<string[]> {
    throw new NotImplemented();
  }
}
