import { verifyMessage } from '@ethersproject/wallet';
import { random } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { DB_MAIN_CONTEXT_ID } from '@onekeyhq/shared/src/consts/dbConsts';
import { MinimumTransferBalanceRequiredError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IWalletConnectChainString } from '@onekeyhq/shared/src/walletConnect/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import { settingsPersistAtom } from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IDBExternalAccount } from '../dbs/local/types';
import type { KeyringSoftwareBase } from '../vaults/base/KeyringSoftwareBase';
import type { ITransferInfo } from '../vaults/types';

@backgroundClass()
class ServiceDemo extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // ---------------------------------------------- demo

  @backgroundMethod()
  async demoJotaiGetSettings() {
    const settings = await settingsPersistAtom.get();

    return {
      settings,
    };
  }

  @backgroundMethod()
  async demoJotaiUpdateSettings() {
    const settings = await settingsPersistAtom.set((v) => ({
      ...v,
      locale: v.locale !== 'zh-CN' ? 'zh-CN' : 'en-US',
      theme: v.theme !== 'dark' ? 'dark' : 'light',
    }));
    return {
      settings,
    };
  }

  @backgroundMethod()
  async demoGetAllRecords() {
    const { records } = await localDb.getAllRecords({
      name: ELocalDBStoreNames.Credential,
    });

    // const ctx = await localDb.getContext();
    return records;
  }

  @backgroundMethod()
  async demoGetDbContextWithoutTx() {
    const ctx = await localDb.getRecordById({
      name: ELocalDBStoreNames.Context,
      id: DB_MAIN_CONTEXT_ID,
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  @backgroundMethod()
  async demoGetDbContext() {
    const c = await localDb.demoGetDbContext();
    return c;
  }

  @backgroundMethod()
  async demoGetDbContextCount() {
    const c = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.Context,
    });
    return c;
  }

  @backgroundMethod()
  async demoGetDbAccountsCount() {
    const c = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.Account,
    });
    return c;
  }

  @backgroundMethod()
  async demoGetDbWalletsCount() {
    const c = await localDb.getRecordsCount({
      name: ELocalDBStoreNames.Wallet,
    });
    return c;
  }

  @backgroundMethod()
  async demoDbUpdateUUID() {
    const c = await localDb.demoDbUpdateUUID();
    return c;
  }

  @backgroundMethod()
  async demoDbUpdateUUIDFixed() {
    const ctx = await localDb.demoDbUpdateUUIDFixed();
    return ctx;
  }

  @backgroundMethod()
  async demoAddRecord1() {
    const ctx = await localDb.demoAddRecord1();
    return ctx;
  }

  @backgroundMethod()
  async demoRemoveRecord1() {
    const ctx = await localDb.demoRemoveRecord1();
    return ctx;
  }

  @backgroundMethod()
  async demoUpdateCredentialRecord() {
    const ctx = await localDb.demoUpdateCredentialRecord();
    return ctx;
  }

  @backgroundMethod()
  async demoError(): Promise<string> {
    await timerUtils.wait(600);
    throw new MinimumTransferBalanceRequiredError({
      autoToast: true,
      info: {
        symbol: 'BTC',
        amount: '0.0001',
      },
    });
  }

  @backgroundMethod()
  async demoError2() {
    throw new Error('hello world: no error toast');
  }

  @backgroundMethod()
  @toastIfError()
  async demoError3() {
    throw new Error('hello world: error toast');
  }

  @backgroundMethod()
  async demoGetPrivateKey({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
      });
    return vault.keyring.exportAccountSecretKeys({
      password,
      xprvt: true,
      privateKey: true,
    });
    // const privateKeysMap = await keyring.getPrivateKeys({
    //   password,
    //   // relPaths: ['0/0'],
    // });
    // const account = await this.backgroundApi.serviceAccount.getAccount({
    //   accountId,
    //   networkId,
    // });
    // const networkInfo = await keyring.getCoreApiNetworkInfo();
    // const network = getBtcForkNetwork(networkInfo.networkChainCode);

    // const { deriveInfo } =
    //   await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate({
    //     networkId,
    //     template: account.template,
    //   });

    // const xprvts = await Promise.all(
    //   Object.values(privateKeysMap).map(async (privateKey) => {
    //     const addressEncoding =
    //       deriveInfo?.addressEncoding || ('' as EAddressEncodings);
    //     const { private: xprvVersionBytes } =
    //       (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

    //     return [
    //       bs58check.encode(decrypt(password, privateKey)),
    //       bs58check.encode(
    //         Buffer.from(bs58check.decode((account as IDBUtxoAccount).xpub))
    //           .fill(
    //             Buffer.from(
    //               xprvVersionBytes.toString(16).padStart(8, '0'),
    //               'hex',
    //             ),
    //             0,
    //             4,
    //           )
    //           .fill(
    //             Buffer.concat([
    //               Buffer.from([0]),
    //               decrypt(password, privateKey),
    //             ]),
    //             45,
    //             78,
    //           ),
    //       ),
    //     ];
    //   }),
    // );

    // return {
    //   privateKeysMap,
    //   xprvts,
    // };
  }

  @backgroundMethod()
  @toastIfError()
  public async demoSend({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const transferInfo: ITransferInfo = {
      from: account.address,
      to: account.address,
      amount: `0.00000${random(1, 20)}`,
      tokenInfo: {
        address: '',
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH',
        isNative: true,
      },
    };

    // PagePreSend -> TokenInput、AmountInput、ReceiverInput -> unsignedTx
    // PageSendConfirm
    let unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [transferInfo],
    });

    // PageSendConfirm -> feeInfoEditor -> rebuild unsignedTx
    unsignedTx = await vault.updateUnsignedTx({
      unsignedTx,
      feeInfo: {
        common: {
          nativeDecimals: 18,
          nativeSymbol: 'ETH',
          feeDecimals: 9,
          feeSymbol: 'Gwei',
          nativeTokenPrice: 2000,
        },
        gas: {
          gasPrice: '0x2a', // 42
          gasLimit: '0x5208', // 21000
        },
      },
    });

    // @ts-ignore
    unsignedTx.encodedTx.nonce = '0x817'; // Nonce: 2071

    // PageSendConfirm -> password auth -> send tx
    const signedTxWithoutBroadcast =
      await this.backgroundApi.serviceSend.signTransaction({
        networkId,
        accountId,
        unsignedTx,
        signOnly: false,
      });

    // const txid = await this.broadcastTransaction({
    //   networkId,
    //   signedTx: signedTxWithoutBroadcast,
    // });
    const txid =
      await this.backgroundApi.serviceSend.broadcastTransactionLegacy({
        accountId,
        networkId,
        accountAddress: '',
        signedTx: signedTxWithoutBroadcast,
      });

    const signedTx = {
      ...signedTxWithoutBroadcast,
      txid,
    };

    console.log({
      vault,
      unsignedTx,
      signedTx,
      transferInfo,
      signedTxWithoutBroadcast,
    });
    return Promise.resolve('hello world');
  }

  @backgroundMethod()
  public async demoBuildDecodedTx(): Promise<IDecodedTx> {
    const networkId = 'evm--5';
    const accountId = "hd-1--m/44'/60'/0'/0/0";
    return Promise.resolve({
      txid: '0x1234567890',

      owner: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      signer: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',

      nonce: 1,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
            label: 'Send',
            sends: [
              {
                from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
                to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
                tokenIdOnNetwork: '',
                label: '',
                amount: '1',
                name: 'Ethereum',
                symbol: 'ETH',
                icon: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
              },
            ],
            receives: [],
          },
        },
      ],

      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),

      status: EDecodedTxStatus.Pending,
      networkId,
      accountId,
      extraInfo: null,
    });
  }

  @backgroundMethod()
  async testEvmSendTxSign({
    networkId,
    accountId,
    encodedTx,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTxEvm;
  }) {
    const result = await this.backgroundApi.serviceSend.signTransaction({
      networkId,
      accountId,
      unsignedTx: {
        encodedTx,
      },
      signOnly: true,
    });
    return result;
  }

  @backgroundMethod()
  async testEvmPersonalSign({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const address = await vault.getAccountAddress();
    const message = 'Example `personal_sign` message';
    const hexMsg = bufferUtils.textToHex(message, 'utf-8');
    // personal_sign params
    const params = [hexMsg, address];
    // const payload = {
    //   method: 'personal_sign',
    //   params,
    // };

    const signature = await this.backgroundApi.serviceSend.signMessage({
      // TODO build message in vault
      unsignedMessage: {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message: hexMsg,
        payload: params,
      },
      accountId,
      networkId,
    });
    /*
    import {
      encrypt,
      recoverPersonalSignature,
      recoverTypedSignatureLegacy,
      recoverTypedSignature,
      recoverTypedSignature_v4 as recoverTypedSignatureV4,
    } from 'eth-sig-util';
    */
    // TODO verifyMessage() not working for HW account, but personal_ecRecover() works
    // https://github.com/MetaMask/test-dapp/
    const verifyMessageFn = verifyMessage;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const verifyResult = verifyMessageFn(
      hexUtils.stripHexPrefix(hexMsg),
      hexUtils.addHexPrefix(signature),
    ); // verify signature

    return {
      address,
      verifyResult,
      isVerified: verifyResult === address,
      message,
      hexMsg,
      signature,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async testExternalAccountPersonalSign({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const chainData =
      await this.backgroundApi.serviceWalletConnect.getChainDataByNetworkId({
        networkId,
      });
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    return this._testExternalAccountPersonalSign({
      address: account.address,
      wcChain: chainData?.wcChain || '',
      topic:
        (account as IDBExternalAccount).connectionInfo?.walletConnect?.topic ||
        '',
      account: account as IDBExternalAccount,
    });
  }

  async _testExternalAccountPersonalSign({
    address,
    wcChain,
    topic,
    account,
  }: {
    address: string;
    wcChain: IWalletConnectChainString;
    topic: string;
    account: IDBExternalAccount;
  }) {
    const provider =
      await this.backgroundApi.serviceWalletConnect.dappSide.getOrCreateProvider(
        {
          topic,
          updateDB: true,
        },
      );

    const message = `My email is john@doe.com - ${Date.now()}`;
    const hexMsg = bufferUtils.textToHex(message, 'utf-8');
    // personal_sign params
    const params = [hexMsg, address];
    const payload = {
      method: 'personal_sign',
      params,
    };

    console.log(
      'testExternalAccountPersonalSign',
      payload,
      topic,
      provider.session?.namespaces?.eip155,
      provider.session?.topic,
    );
    this.backgroundApi.serviceWalletConnect.dappSide.openNativeWalletAppByDeepLink(
      {
        account,
      },
    );
    const result = await provider.request(payload, wcChain);
    console.log('testExternalAccountPersonalSign RESULT: ', payload, result);

    return result as string;
  }

  @backgroundMethod()
  async clearQrWalletAirGapAccountKeys({ walletId }: { walletId: string }) {
    await localDb.clearQrWalletAirGapAccountKeys({ walletId });
  }
}

export default ServiceDemo;
