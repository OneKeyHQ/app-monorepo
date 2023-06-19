import { Transaction } from '@kaspa/core-lib';
import { hexToBytes } from '@noble/hashes/utils';

import { RestAPIClient } from './clientRestApi';
import { privateKeyFromOriginPrivateKey } from './privatekey';
import { publicKeyFromOriginPubkey } from './publickey';
import { signTransaction, submitTransactionFromString } from './transaction';
import { UnspentOutput } from './types';
import { queryConfirmUTXOs, selectUTXOs } from './utxo';

import type { UnspentOutputInfo } from './types';
import type { PublicKey } from '@kaspa/core-lib';

jest.setTimeout(3 * 60 * 1000);

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

  it('kaspa transaction UTXO', async () => {
    // process.stdout.write(`>> origin pubKey ${publicKeyBuf.toString('hex')}\n`);
    // process.stdout.write(`>> origin priKey ${privateKeyBuf.toString('hex')}\n`);

    // process.stdout.write(`>> pubKey ${publicKey.toBuffer().toString('hex')}\n`);
    // process.stdout.write(`>> priKey ${privateKey.toString()}\n`);
    let utxos: UnspentOutputInfo[] = [];
    try {
      const confirmUTXOs = await queryConfirmUTXOs(client, from);
      const selectUTXOsRes = selectUTXOs(confirmUTXOs, 100000);
      utxos = selectUTXOsRes.utxos;
    } catch (error) {
      // ignore
    }

    const transaction: Transaction = new Transaction()
      .from(utxos.map((utxo) => new UnspentOutput(utxo)))
      .to(to, 100000)
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

  it('kaspa transaction UTXO 1', async () => {
    // process.stdout.write(`>> origin pubKey ${publicKeyBuf.toString('hex')}\n`);
    // process.stdout.write(`>> origin priKey ${privateKeyBuf.toString('hex')}\n`);

    // process.stdout.write(`>> pubKey ${publicKey.toBuffer().toString('hex')}\n`);
    // process.stdout.write(`>> priKey ${privateKey.toString()}\n`);

    const utxos = [
      new UnspentOutput({
        txid: '6d4bc796e16cb6278ce1dfeb9cb89aabf702f9292d6ddc463131c1cd2faa82d0',
        address:
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
        vout: 0,
        scriptPubKey:
          '207afdae557e69c0040fd4135adffc60f9486fb21f4cbae233fd6db3e84ba47c55ac',
        scriptPublicKeyVersion: 0,
        satoshis: 27000000000,
        blockDaaScore: 44431383,
      }),
    ];

    const transaction: Transaction = new Transaction()
      .from(utxos)
      .to(to, 100000000)
      .setVersion(0)
      .fee(2069)
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

  it.skip('kaspa selector UTXO', async () => {
    const confirmUTXOs = await queryConfirmUTXOs(
      client,
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );

    const selectedUTXOs = selectUTXOs(confirmUTXOs, 100000);

    process.stdout.write(`pubkeyInfos: ${JSON.stringify(selectedUTXOs)}\n`);
  });
});

export {};
