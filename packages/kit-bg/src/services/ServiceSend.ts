import { random } from 'lodash';

import { encodePassword } from '@onekeyhq/core/src/secret';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { ITransferInfo } from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoSendEvmTx() {
    const vault = await vaultFactory.getVault({
      networkId: 'evm--5',
      accountId: "hd-1--m/44'/60'/0'/0/0",
    });
    const transferInfo: ITransferInfo = {
      from: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      to: '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
      amount: `0.00000${random(1, 20)}`,
      token: '',
    };
    // PagePreSend -> TokenInput、AmountInput、ReceiverInput -> encodedTx
    // Dapp -> encodedTx
    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [transferInfo],
    });

    // PageSendConfirm
    let unsignedTx = await vault.buildUnsignedTx({ encodedTx });

    // PageSendConfirm -> feeInfoEditor -> rebuild unsignedTx
    unsignedTx = await vault.updateUnsignedTx({
      unsignedTx,
      feeInfo: {
        gas: {
          'gasLimit': '0x5208', // 21000
          'gasPrice': '0x2a', // 42
        },
      },
    });

    // PageSendConfirm -> password auth -> send tx
    const signedTx = await vault.signAndSendTransaction({
      unsignedTx,
      password: encodePassword({ password: '11111111' }),
    });

    // signOnly
    const signedTxWithoutBroadcast = await vault.signTransaction({
      unsignedTx,
      password: encodePassword({ password: '11111111' }),
    });
    console.log({
      vault,
      encodedTx,
      unsignedTx,
      signedTx,
      transferInfo,
      signedTxWithoutBroadcast,
    });
    return Promise.resolve('hello world');
  }

  @backgroundMethod()
  public async buildEncodedTx({
    transfersInfo,
  }: {
    transfersInfo: ITransferInfo[];
  }) {
    const vault = await vaultFactory.getVault({
      networkId: 'evm--5',
      accountId: "hd-1--m/44'/60'/0'/0/0",
    });
    return vault.buildEncodedTx({ transfersInfo });
  }

  @backgroundMethod()
  public async buildUnsignedTx({ encodedTx }: { encodedTx: IEncodedTx }) {
    const vault = await vaultFactory.getVault({
      networkId: 'evm--5',
      accountId: "hd-1--m/44'/60'/0'/0/0",
    });
    return vault.buildUnsignedTx({ encodedTx });
  }
}

export default ServiceSend;
