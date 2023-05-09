import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import { COINTYPE_ADA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError, OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { getChangeAddress } from './helper/cardanoUtils';
import sdk from './helper/sdk';
import {
  transformToOneKeyInputs,
  transformToOneKeyOutputs,
} from './helper/transformations';
import { NetworkId } from './types';

import type { DBUTXOAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';
import type { IUnsignedMessageEvm } from '../evm/Vault';
import type { IEncodedTxADA } from './types';
import type AdaVault from './Vault';
import type { CardanoGetAddressMethodParams } from '@onekeyfe/hd-core';

const PATH_PREFIX = `m/1852'/${COIN_TYPE}'`;
const ProtocolMagic = 764824073;

const getCardanoConstant = async () => {
  const { PROTO } = await CoreSDKLoader();
  return {
    addressType: PROTO.CardanoAddressType.BASE,
    derivationType: PROTO.CardanoDerivationType.ICARUS,
    protocolMagic: ProtocolMagic,
    networkId: NetworkId.MAINNET,
  };
};

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

    const { derivationType, addressType, networkId, protocolMagic } =
      await getCardanoConstant();

    const bundle = paths.map((path, index) => ({
      addressParameters: {
        addressType,
        path,
        stakingPath: stakingPaths[index],
      },
      networkId,
      protocolMagic,
      derivationType,
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
      throw convertDeviceError(response.payload);
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
    const { derivationType, addressType, networkId, protocolMagic } =
      await getCardanoConstant();
    const response = await HardwareSDK.cardanoGetAddress(connectId, deviceId, {
      ...passphraseState,
      addressParameters: {
        addressType,
        path,
        stakingPath,
      },
      networkId,
      protocolMagic,
      derivationType,
      isCheck: true,
      showOnOneKey: true,
    });

    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const { derivationType, addressType, networkId, protocolMagic } =
      await getCardanoConstant();
    const response = await HardwareSDK.cardanoGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => {
        const stakingPath = `${path.split('/').slice(0, 4).join('/')}/2/0`;
        return {
          addressParameters: {
            addressType,
            path,
            stakingPath,
          },
          networkId,
          protocolMagic,
          derivationType,
          isCheck: true,
          showOnOneKey: !!showOnOneKey,
        };
      }),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.serializedPath,
      address: item.address,
    }));
  }

  override async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const { PROTO } = await CoreSDKLoader();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const encodedTx = unsignedTx.payload.encodedTx as unknown as IEncodedTxADA;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const { derivationType, networkId, protocolMagic } =
      await getCardanoConstant();
    const utxos = await (
      await (this.vault as AdaVault).getClient()
    ).getUTXOs(dbAccount.xpub, dbAccount.path, dbAccount.addresses);

    const { inputs, outputs, fee, tx } = encodedTx;
    const isSignOnly = !!encodedTx.signOnly;
    const { rawTxHex } = tx;
    const CardanoApi = await sdk.getCardanoApi();
    let cardanoParams;
    // sign for DApp
    if (isSignOnly && rawTxHex) {
      const stakingPath = `${dbAccount.path
        .split('/')
        .slice(0, 4)
        .join('/')}/2/0`;
      const keys = {
        payment: { hash: null, path: dbAccount.path },
        stake: { hash: null, path: stakingPath },
      };
      cardanoParams = await CardanoApi.txToOneKey(
        rawTxHex,
        networkId,
        keys,
        dbAccount.xpub,
        changeAddress,
      );
    } else {
      cardanoParams = {
        signingMode: PROTO.CardanoTxSigningMode.ORDINARY_TRANSACTION,
        outputs: transformToOneKeyOutputs(
          outputs,
          changeAddress.addressParameters,
        ),
        fee,
        protocolMagic,
        networkId,
      };
    }

    debugLogger.hardwareSDK.info('cardano signTx params: ', cardanoParams);

    const res = await HardwareSDK.cardanoSignTransaction(connectId, deviceId, {
      ...passphraseState,
      inputs: transformToOneKeyInputs(inputs, utxos),
      derivationType,
      ...cardanoParams,
    } as any);
    if (!res.success) {
      throw convertDeviceError(res.payload);
    }

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

  override async signMessage(
    messages: IUnsignedMessageEvm[],
  ): Promise<string[]> {
    debugLogger.common.info('signMessage', messages);
    const dbAccount = await this.getDbAccount();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { derivationType, networkId } = await getCardanoConstant();
    const result = await Promise.all(
      messages.map(
        // @ts-expect-error
        async ({ payload }: { payload: { addr: string; payload: string } }) => {
          const response = await HardwareSDK.cardanoSignMessage(
            connectId,
            deviceId,
            {
              ...passphraseState,
              path: dbAccount.path,
              networkId,
              derivationType,
              message: payload.payload,
            },
          );
          if (!response.success) {
            throw convertDeviceError(response.payload);
          }
          return response.payload;
        },
      ),
    );
    return result.map((ret) => JSON.stringify(ret));
  }
}
