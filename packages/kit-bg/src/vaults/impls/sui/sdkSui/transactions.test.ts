import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import transactionUtils from './transactions';

import type { OneKeySuiClient } from './ClientSui';

const SENDER = `0x${'1'.repeat(64)}`;
const RECIPIENT = `0x${'2'.repeat(64)}`;

function mockClient(
  coinBalance: string,
  addressBalance: string,
): OneKeySuiClient {
  const totalBalance = String(BigInt(coinBalance) + BigInt(addressBalance));
  return {
    getBalance: jest.fn().mockResolvedValue({
      totalBalance,
      fundsInAddressBalance: addressBalance,
    }),
  } as unknown as OneKeySuiClient;
}

function buildTx(opts: {
  coinBalance: string;
  addressBalance: string;
  amount: string;
  maxSendNativeToken?: boolean;
}) {
  return transactionUtils.createTokenTransaction({
    client: mockClient(opts.coinBalance, opts.addressBalance),
    sender: SENDER,
    recipient: RECIPIENT,
    amount: opts.amount,
    coinType: SUI_TYPE_ARG,
    maxSendNativeToken: opts.maxSendNativeToken,
  });
}

describe('sui createTokenTransaction native max-send', () => {
  it('Direction 1 (has coin objects): transfers the gas coin, no split', async () => {
    const tx = await buildTx({
      coinBalance: '1000',
      addressBalance: '0',
      amount: '900',
      maxSendNativeToken: true,
    });
    const { commands } = tx.getData();

    expect(commands.some((c) => c.$kind === 'SplitCoins')).toBe(false);
    const transfer = commands.find((c) => c.$kind === 'TransferObjects');
    expect(transfer?.TransferObjects?.objects?.[0]?.$kind).toBe('GasCoin');
  });

  it('Direction 2 (address balance only): withdraws via coinWithBalance, never the gas coin', async () => {
    const tx = await buildTx({
      coinBalance: '0',
      addressBalance: '1000',
      amount: '900',
      maxSendNativeToken: true,
    });
    const { commands } = tx.getData();

    expect(
      commands.some((c) => c.$kind === '$Intent'), // coinWithBalance intent
    ).toBe(true);
    const transfer = commands.find((c) => c.$kind === 'TransferObjects');
    expect(transfer?.TransferObjects?.objects?.[0]?.$kind).not.toBe('GasCoin');
  });

  it('normal (non-max) transfer: keeps the coinWithBalance split path', async () => {
    const tx = await buildTx({
      coinBalance: '1000',
      addressBalance: '0',
      amount: '100',
    });
    const { commands } = tx.getData();

    const transfer = commands.find((c) => c.$kind === 'TransferObjects');
    expect(transfer?.TransferObjects?.objects?.[0]?.$kind).not.toBe('GasCoin');
  });
});
