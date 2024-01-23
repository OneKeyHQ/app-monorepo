import { RestAPIClient } from './clientRestApi';
import { queryConfirmUTXOs, selectUTXOs } from './utxo';

jest.setTimeout(3 * 60 * 1000);

describe('Kaspa UTXO Tests', () => {
  const client = new RestAPIClient('https://api.kaspa.org');

  it.skip('kaspa query UTXO', async () => {
    const confirmUTXOs = await queryConfirmUTXOs(
      client,
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );
    process.stdout.write(`pubkeyInfos: ${JSON.stringify(confirmUTXOs)}\n`);
  });

  it.skip('kaspa selector UTXO', async () => {
    const confirmUTXOs = await queryConfirmUTXOs(
      client,
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );

    const selectedUTXOs = selectUTXOs(confirmUTXOs, 100000);

    process.stdout.write(`pubkeyInfos: ${JSON.stringify(selectedUTXOs)}\n`);
  });

  it.skip('kaspa selector UTXO satoshis priority', async () => {
    const confirmUTXOs = await queryConfirmUTXOs(
      client,
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );

    const selectedUTXOs = selectUTXOs(confirmUTXOs, 100000, {
      satoshis: true,
    });

    process.stdout.write(`pubkeyInfos: ${JSON.stringify(selectedUTXOs)}\n`);
  });
});

export {};
