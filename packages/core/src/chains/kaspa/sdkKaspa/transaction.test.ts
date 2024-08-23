import { hexToBytes } from '@noble/hashes/utils';
import { Address, Transaction } from '@onekeyfe/kaspa-core-lib';
import BigNumber from 'bignumber.js';

import { MAX_UINT64_VALUE } from '@onekeyhq/core/src/consts';

import { RestAPIClient } from './clientRestApi';
import { privateKeyFromOriginPrivateKey } from './privatekey';
import { publicKeyFromOriginPubkey } from './publickey';
import { signTransaction, submitTransactionFromString } from './transaction';
import { UnspentOutput } from './types';
import { queryConfirmUTXOs, selectUTXOs } from './utxo';

import type {
  IKaspaSubmitTransactionRequest,
  IKaspaUnspentOutputInfo,
} from './types';
import type { PublicKey } from '@onekeyfe/kaspa-core-lib';

jest.setTimeout(3 * 60 * 1000);

const checkTransactionResult = ({
  submitTransaction,
  originOutputs,
  sendAmount,
  feeAmount,
  from,
  to,
}: {
  submitTransaction: IKaspaSubmitTransactionRequest;
  originOutputs: IKaspaUnspentOutputInfo[];
  sendAmount: string;
  feeAmount: number;
  from: string;
  to: string;
}) => {
  const totalInput = originOutputs.reduce(
    (sum, utxo) => sum.plus(utxo.satoshis),
    new BigNumber(0),
  );

  // 计算输出总额
  const totalOutput = submitTransaction.transaction.outputs.reduce(
    (sum, output) => sum.plus(output.amount?.toString() || '0'),
    new BigNumber(0),
  );

  // 获取转账金额和找零金额
  const transferAmount = new BigNumber(sendAmount);
  const changeAmount = totalOutput.minus(transferAmount);

  // 计算手续费
  const fee = totalInput.minus(totalOutput);

  expect(totalInput.toString()).toBe(totalOutput.plus(fee).toString());
  expect(fee.toNumber()).toBe(feeAmount);
  expect(fee.toNumber() < 5000).toBe(true);
  expect(changeAmount.toString()).toBe(
    totalInput.minus(transferAmount).minus(fee).toString(),
  );

  submitTransaction.transaction.inputs.forEach((input) => {
    const originOutput = originOutputs.find(
      (utxo) => utxo.txid === input.previousOutpoint.transactionId,
    );
    // check
    expect(input.previousOutpoint.index).toBe(originOutput?.vout);
  });

  submitTransaction.transaction.outputs.forEach((output, index) => {
    const scriptPublicKey = output.scriptPublicKey.scriptPublicKey.slice(2, -2);
    const address = new Address(
      Buffer.from(scriptPublicKey, 'hex'),
      // @ts-expect-error
      'kaspa',
      'pubkey',
    ).toString();

    if (index === 0) {
      expect(output.amount?.toString()).toBe(sendAmount);
      expect(address).toBe(to);
    } else if (index === 1) {
      expect(output.amount?.toString()).toBe(changeAmount.toString());
      expect(address).toBe(from);
    }
  });
};

describe('Kaspa transaction Tests', () => {
  const client = new RestAPIClient('https://api.kaspa.org');
  const from =
    'kaspa:qzst4v3nqy3zdgd5ju8c9mp6wtad68r76hq55frej2w6m24n80yku0mz8ck34';
  const to =
    'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu';

  const publicKeyBuf = Buffer.from(
    Buffer.from(
      hexToBytes(
        '03f27b1427fd68bae008590f15958ad3eafa0a6875d7fdaa3034ebc00ceadbb7fe',
      ),
    ),
  );
  const privateKeyBuf = Buffer.from(
    Buffer.from(
      hexToBytes(
        // all(12) m/44'/111111'/0'/0/0
        'd4ace23e6d39d75a31b4eb9a3b05cea4bd00627bbe122c83a091a6d000e4c6fc',
      ),
    ),
  );
  const publicKey = publicKeyFromOriginPubkey(publicKeyBuf);
  const privateKey = privateKeyFromOriginPrivateKey(
    privateKeyBuf,
    publicKeyBuf,
    'kaspa',
  );

  it.skip('kaspa transaction UTXO (on network)', async () => {
    const sendAmount = '100000';
    let utxos: IKaspaUnspentOutputInfo[] = [];
    try {
      const confirmUTXOs = await queryConfirmUTXOs(client, from);
      const selectUTXOsRes = selectUTXOs(
        confirmUTXOs,
        new BigNumber(sendAmount),
      );
      utxos = selectUTXOsRes.utxos;
    } catch (error) {
      // ignore
    }

    const transaction: Transaction = new Transaction()
      .from(utxos.map((utxo) => new UnspentOutput(utxo)))
      .to(to, sendAmount)
      .setVersion(0)
      .fee(3000)
      .change(from);

    const rawTx = await signTransaction(transaction, {
      getPublicKey(): PublicKey {
        return publicKey;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async getPrivateKey() {
        return privateKey;
      },
    });

    const submitTransaction = submitTransactionFromString(rawTx);

    process.stdout.write(
      `transaction json: ${JSON.stringify(submitTransaction)}\n`,
    );
    process.stdout.write(`transaction: ${rawTx}\n`);
  });

  it('kaspa transaction normal', async () => {
    const sendAmount = '100000000';
    const feeAmount = 3000;
    const utxos = [
      {
        txid: '6d4bc796e16cb6278ce1dfeb9cb89aabf702f9292d6ddc463131c1cd2faa82d0',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: 27_000_000_000,
        blockDaaScore: 44_431_383,
      },
    ];

    const transaction: Transaction = new Transaction()
      .from(utxos.map((utxo) => new UnspentOutput(utxo)))
      .to(to, sendAmount)
      .setVersion(0)
      .fee(feeAmount)
      .change(from);

    const rawTx = await signTransaction(transaction, {
      getPublicKey(): PublicKey {
        return publicKey;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async getPrivateKey() {
        return privateKey;
      },
    });

    const submitTransaction = submitTransactionFromString(rawTx);

    checkTransactionResult({
      submitTransaction,
      originOutputs: utxos,
      sendAmount,
      feeAmount: transaction.getFee(),
      from,
      to,
    });
  });

  it('kaspa transaction send big Amount (exceed uint32)', async () => {
    const sendAmount = '111231231231231231';
    const utxos = [
      {
        txid: '06019dc89ee09708cd1b083cf992851a7212a14ca2abf6571bc9fbc910d7720c',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '951231231231231231',
        blockDaaScore: 67_062_530,
      },
      {
        txid: '98b691e57be57efcc0178f45edd1130c9c905dd8cb6a78a66076e8a839e9d2d8',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '951231231231231231',
        blockDaaScore: 67_063_717,
      },
    ];

    const transaction = new Transaction()
      .from(utxos.map((utxo) => new UnspentOutput(utxo)))
      .to(to, sendAmount)
      .setVersion(0)
      .fee(3000)
      .change(from);

    const rawTx = await signTransaction(transaction, {
      getPublicKey(): PublicKey {
        return publicKey;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async getPrivateKey() {
        return privateKey;
      },
    });

    const submitTransaction = submitTransactionFromString(rawTx);

    checkTransactionResult({
      submitTransaction,
      originOutputs: utxos,
      sendAmount,
      feeAmount: transaction.getFee(),
      from,
      to,
    });
  });

  it('kaspa transaction UTXO total amount Uint64 max', async () => {
    const sendAmount = '100000000';
    const feeAmount = 3000;
    const utxos = [
      {
        txid: 'c81ad4b7d1f160132fc7d5f60f3b429b93738dffac2693d28968b5bf0f325903',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: MAX_UINT64_VALUE.toString(), // Uint64 max
        blockDaaScore: 44_431_383,
      },
    ];

    const transaction: Transaction = new Transaction()
      .from(utxos.map((utxo) => new UnspentOutput(utxo)))
      .to(to, sendAmount)
      .setVersion(0)
      .fee(feeAmount)
      .change(from);

    const rawTx = await signTransaction(transaction, {
      getPublicKey(): PublicKey {
        return publicKey;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async getPrivateKey() {
        return privateKey;
      },
    });

    const submitTransaction = submitTransactionFromString(rawTx);

    checkTransactionResult({
      submitTransaction,
      originOutputs: utxos,
      sendAmount,
      feeAmount: transaction.getFee(),
      from,
      to,
    });
  });

  it('kaspa transaction UTXO total Amount overflow Uint64', async () => {
    const utxos = [
      new UnspentOutput({
        txid: '06019dc89ee09708cd1b083cf992851a7212a14ca2abf6571bc9fbc910d7720c',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '9500000000000000000',
        blockDaaScore: 67_062_530,
      }),
      new UnspentOutput({
        txid: '98b691e57be57efcc0178f45edd1130c9c905dd8cb6a78a66076e8a839e9d2d8',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '9500000000000000000',
        blockDaaScore: 67_063_717,
      }),
    ];

    try {
      new Transaction()
        .from(utxos)
        .to(to, 100_000_000)
        .setVersion(0)
        .fee(2069)
        .change(from);

      // 不通过测试
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain(
        'Invalid state: Output satoshis is not a natural number',
      );
    }
  });

  it.skip('kaspa selector UTXO', async () => {
    const confirmUTXOs = await queryConfirmUTXOs(
      client,
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );

    const selectedUTXOs = selectUTXOs(confirmUTXOs, new BigNumber(100_000));

    process.stdout.write(`pubkeyInfos: ${JSON.stringify(selectedUTXOs)}\n`);
  });

  it('kaspa selector UTXO Amount overflow', async () => {
    const utxos = [
      {
        txid: '06019dc89ee09708cd1b083cf992851a7212a14ca2abf6571bc9fbc910d7720c',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '951231231231231231111',
        blockDaaScore: 67_062_530,
      },
      {
        txid: '98b691e57be57efcc0178f45edd1130c9c905dd8cb6a78a66076e8a839e9d2d8',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '2088a88e27e7337ecdcd535f2e5dce132508270e3ce1f7662fee99711d625b2eeeac',
        scriptPublicKeyVersion: 0,
        satoshis: '951231231231231231111',
        blockDaaScore: 67_063_717,
      },
    ];

    try {
      selectUTXOs(utxos, new BigNumber(9_500_000_000_001_000));

      // 不通过测试
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('utxo amount is too large');
    }
  });
});

export {};
