import { RestAPIClient } from './clientRestApi';

jest.setTimeout(3 * 60 * 1000);

describe('Kaspa Rest API Client Tests', () => {
  const client = new RestAPIClient('https://api.kaspa.org');

  it.skip('kaspa query network info', async () => {
    const info = await client.getNetworkInfo();
    process.stdout.write(`query network info: ${JSON.stringify(info)}\n`);
  });

  it.skip('kaspa query balance', async () => {
    const balance = await client.queryBalance(
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );
    process.stdout.write(`query balance: ${balance}\n`);
  });

  it.skip('kaspa query utxo', async () => {
    const utxo = await client.queryUtxos(
      'kaspa:qrkk52m4ddq405jvvfg7acwu6g48zd25dzekger3wftq7uat6xcw6cqq63a78',
    );
    process.stdout.write(`query utxo length: ${utxo.length}\n`);
  });
});

export {};
