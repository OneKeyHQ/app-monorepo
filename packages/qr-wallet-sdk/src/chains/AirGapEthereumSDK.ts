import {
  findHDPathFromAddress,
  generateAddressFromXpub,
} from '@keystonehq/bc-ur-registry-eth';
import { KeystoneEthereumSDK } from '@keystonehq/keystone-sdk';

export class AirGapEthereumSDK extends KeystoneEthereumSDK {
  generateAddressFromXpub(params: { xpub: string; derivePath: string }) {
    // derivePath: `m/0/0`, `m/0/1` `m/0/2`
    return generateAddressFromXpub(params.xpub, params.derivePath);
  }

  findHDPathFromAddress(params: {
    address: string;
    xpub: string;
    numberLimit: number;
    rootPath: string;
  }) {
    return findHDPathFromAddress(
      params.address,
      params.xpub,
      params.numberLimit,
      params.rootPath,
    );
  }

  // TODO serializeUnsignedTx(tx: TxData | AccessListEIP2930TxData | FeeMarketEIP1559TxData): string
  // import {
  // Transaction,
  // FeeMarketEIP1559Transaction,
  // TransactionFactory,
  // } from '@ethereumjs/tx';
  //   const tx0 = Transaction.fromTxData(encodedTx); // legacyTx
  //   const message0 = tx0.getMessageToSign(false); // generate the unsigned transaction
  //   const serializedMessage0 = Buffer.from(
  //     RLP.encode(bufArrToArr(message0)),
  //   ).toString('hex'); // use this for the HW wallet input
  // const eip1559Tx2 = FeeMarketEIP1559Transaction.fromTxData(txParams); // eip1559Tx
  // const unsignedMessage2 = Buffer.from(
  //   eip1559Tx2.getMessageToSign(false),
  // ).toString('hex');

  // TODO buildSignedTx(tx, signature): {rawTx, txid}
  // const typedTx = TransactionFactory.fromTxData({
  //   ...txShared,
  //   type: txShared.type,
  //   r: hexUtils.addHexPrefix(r),
  //   s: hexUtils.addHexPrefix(s),
  //   v: hexUtils.addHexPrefix(v),
  // });
  // const txid = hexUtils.addHexPrefix(typedTx.hash().toString('hex'));
  // const rawTx = hexUtils.addHexPrefix(
  //   typedTx.serialize().toString('hex'),
  // );
}
