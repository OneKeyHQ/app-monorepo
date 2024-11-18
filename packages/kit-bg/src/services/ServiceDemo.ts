import { verifyMessage } from '@ethersproject/wallet';
import { random } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { DB_MAIN_CONTEXT_ID } from '@onekeyhq/shared/src/consts/dbConsts';
import { MinimumTransferBalanceRequiredError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
import type { ITransferInfo } from '../vaults/types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

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
    throw new Error('hello world: error toast: 3');
  }

  @backgroundMethod()
  @toastIfError()
  async demoError4() {
    return this.demoError4a();
  }

  @toastIfError()
  async demoError4a() {
    return this.demoError4b();
  }

  @toastIfError()
  async demoError4b() {
    throw new Error('hello world: error toast: 4b');
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
        accountId,
        networkId,
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
    const networkId = 'evm--1';
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

  @backgroundMethod()
  async addMultipleWatchingAccounts() {
    const { serviceAccount } = this.backgroundApi;
    const now = Date.now();
    void serviceAccount.addWatchingAccount({
      input: '0x519643f1732ac6444ab271e459b777f65a39c711',
      networkId: getNetworkIdsMap().eth,
      deriveType: 'default',
    });
    void serviceAccount.addWatchingAccount({
      input: '0x830e7d1a54acf4cde587884bb8169ad12dad63a5',
      networkId: getNetworkIdsMap().polygon,
      deriveType: 'default',
    });
    void serviceAccount.addWatchingAccount({
      input: '0xe74e378a4243064b2c5118c1a0ae4e834dad757b',
      networkId: getNetworkIdsMap().bsc,
      deriveType: 'default',
    });
    void serviceAccount.addWatchingAccount({
      input: '0xe3be49e36b5dda6f603fa2d69ab3d10bdaf52cd2',
      networkId: getNetworkIdsMap().arbitrum,
      deriveType: 'default',
    });
    void serviceAccount.addWatchingAccount({
      input: '0x96cfe53279c127044584e49bd63da73c513bf656',
      networkId: getNetworkIdsMap().avalanche,
      deriveType: 'default',
    });
    return Date.now() - now;
  }

  @backgroundMethod()
  @toastIfError()
  async demoHwGetBtcPublicKeysByLoop({
    connectId,
    deviceId,
  }: {
    connectId: string | undefined;
    deviceId: string | undefined;
  }) {
    defaultLogger.app.perf.resetTimestamp();
    if (!connectId || !deviceId) {
      throw new Error('connectId or deviceId is undefined');
    }

    defaultLogger.app.perf.logTime({ message: 'getSDKInstance' });
    const sdk = await this.backgroundApi.serviceHardware.getSDKInstance();
    defaultLogger.app.perf.logTime({ message: 'getSDKInstanceDone' });

    defaultLogger.app.perf.logTime({ message: 'btc1' });
    const response1 = await sdk.btcGetPublicKey(connectId, deviceId, {
      passphraseState: '',
      useEmptyPassphrase: true,
      bundle: [
        {
          coin: 'btc',
          path: "m/49'/0'/1'",
          showOnOneKey: false,
        },
      ],
    });
    defaultLogger.app.perf.logTime({
      message: 'btc1 done',
      data: (response1?.payload as any[])?.[0],
    });

    defaultLogger.app.perf.logTime({ message: 'btc2' });
    const response2 = await sdk.btcGetPublicKey(connectId, deviceId, {
      passphraseState: '',
      useEmptyPassphrase: true,
      bundle: [
        {
          coin: 'btc',
          path: "m/44'/0'/1'",
          showOnOneKey: false,
        },
      ],
    });
    defaultLogger.app.perf.logTime({
      message: 'btc2 done',
      data: (response2?.payload as any[])?.[0],
    });

    defaultLogger.app.perf.logTime({ message: 'btc3' });
    const response3 = await sdk.btcGetPublicKey(connectId, deviceId, {
      passphraseState: '',
      useEmptyPassphrase: true,
      bundle: [
        {
          coin: 'btc',
          path: "m/84'/0'/1'",
          showOnOneKey: false,
        },
      ],
    });
    defaultLogger.app.perf.logTime({
      message: 'btc3 done',
      data: (response3?.payload as any[])?.[0],
    });

    defaultLogger.app.perf.logTime({ message: 'btc4' });
    const response4 = await sdk.btcGetPublicKey(connectId, deviceId, {
      passphraseState: '',
      useEmptyPassphrase: true,
      bundle: [
        {
          coin: 'btc',
          path: "m/86'/0'/1'",
          showOnOneKey: false,
        },
      ],
    });
    defaultLogger.app.perf.logTime({
      message: 'btc4 done',
      data: (response4?.payload as any[])?.[0],
    });

    defaultLogger.app.perf.logTime({ message: 'evm1' });
    const response5 = await sdk.evmGetAddress(connectId, deviceId, {
      passphraseState: '',
      useEmptyPassphrase: true,
      bundle: [
        {
          // network: 'evm',
          path: "m/44'/60'/0'/0/0",
          showOnOneKey: false,
        },
      ],
    });
    defaultLogger.app.perf.logTime({
      message: 'evm1 done',
      data: (response5?.payload as any[])?.[0],
    });

    defaultLogger.app.perf.logTime({
      message: '-------- demoHwGetBtcPublicKeysByLoop Done',
      data: { response1, response2, response3, response4, response5 },
    });
    return { response1, response2, response3, response4, response5 };
  }

  @backgroundMethod()
  @toastIfError()
  async demoHwGetAllNetworkAddresses({
    connectId,
    deviceId,
  }: {
    connectId: string | undefined;
    deviceId: string | undefined;
  }) {
    defaultLogger.app.perf.resetTimestamp();
    if (!connectId || !deviceId) {
      throw new Error('connectId or deviceId is undefined');
    }

    defaultLogger.app.perf.logTime({ message: 'getSDKInstance' });
    const sdk = await this.backgroundApi.serviceHardware.getSDKInstance();
    defaultLogger.app.perf.logTime({ message: 'getSDKInstanceDone' });

    defaultLogger.app.perf.logTime({ message: 'demoHwGetAllNetworkAddresses' });
    const bundle: AllNetworkAddressParams[] = [
      {
        network: 'btc',
        path: "m/49'/0'/0'/0/0",
        showOnOneKey: false,
      },
      {
        network: 'btc',
        path: "m/44'/0'/0'/0/0",
        showOnOneKey: false,
      },
      {
        network: 'btc',
        path: "m/86'/0'/0'/0/0",
        showOnOneKey: false,
      },
      {
        network: 'btc',
        path: "m/84'/0'/0'/0/0",
        showOnOneKey: false,
      },
      {
        network: 'evm',
        path: "m/44'/60'/0'/0/0",
        showOnOneKey: false,
      },
      {
        network: 'sol',
        path: "m/44'/501'/0'/0'",
        showOnOneKey: false,
      },
      // {
      //   network: 'cfx',
      //   path: "m/44'/503'/0'/0/0",
      //   chainName: '1029',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'cfx',
      //   path: "m/44'/503'/0'/0/0",
      //   chainName: '1',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'cosmos',
      //   path: "m/44'/118'/0'/0/0",
      //   prefix: 'cosmos',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'cosmos',
      //   path: "m/44'/118'/0'/0/0",
      //   prefix: 'osmosis',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'dynex',
      //   path: "m/44'/29538'/0'/0'/0'",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'fil',
      //   path: "m/44'/461'/0'/0/0",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'kaspa',
      //   path: "m/44'/111111'/0'/0/0",
      //   prefix: 'kaspa',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'near',
      //   path: "m/44'/397'/0'",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'nexa',
      //   path: "m/44'/29223'/0'/0/0",
      //   prefix: 'nexa',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'nervos',
      //   path: "m/44'/309'/0'/0/0",
      //   chainName: 'ckb',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'dot',
      //   path: "m/44'/354'/0'/0'/0'",
      //   prefix: '0',
      //   chainName: 'polkadot',
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'xrp',
      //   path: "m/44'/144'/0'/0/0",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'sol',
      //   path: "m/44'/501'/0'/0'",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'stc',
      //   path: "m/44'/101010'/0'/0'/0'",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'sui',
      //   path: "m/44'/784'/0'/0'/0'",
      //   showOnOneKey: false,
      // },
      // {
      //   network: 'tron',
      //   path: "m/44'/195'/0'/0/0",
      //   showOnOneKey: false,
      // },
    ];
    console.log('sdk.allNetworkGetAddress bundle', bundle);
    const response = await convertDeviceResponse(() =>
      // TODO return public keys (xpub) or address
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      sdk.allNetworkGetAddress(connectId, deviceId, {
        passphraseState: '',
        useEmptyPassphrase: true,
        bundle,
      }),
    );
    defaultLogger.app.perf.logTime({
      message: '-------- demoHwGetAllNetworkAddresses Done',
      // TODO return type is Wrong
      data: (
        response as any as Array<{
          success: boolean;
          error?: string;
          payload?: { address: string; path: string };
        }>
      )?.map((item) => item.payload?.address),
    });
    return response;
  }
}

export default ServiceDemo;
