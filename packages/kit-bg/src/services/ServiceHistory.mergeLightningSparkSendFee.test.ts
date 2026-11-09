import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import { mergeLightningSparkSendFee } from './ServiceHistory';

const SPARK = 'lightningspark--0';

function transfer(amount: string, price?: string): IDecodedTxTransferInfo {
  return {
    from: 'spark1self',
    to: '',
    amount,
    icon: '',
    name: 'sats',
    symbol: 'sats',
    tokenIdOnNetwork: '',
    isNative: true,
    ...(price ? { price } : {}),
  };
}

function createTx({
  networkId = SPARK,
  status = EDecodedTxStatus.Confirmed,
  sends = [transfer('25')],
  receives = [],
  fee = '0',
  feeFiat = '0',
}: {
  networkId?: string;
  status?: EDecodedTxStatus;
  sends?: IDecodedTxTransferInfo[];
  receives?: IDecodedTxTransferInfo[];
  fee?: string;
  feeFiat?: string;
}): IAccountHistoryTx {
  return {
    id: 'history-id',
    isLocalCreated: false,
    decodedTx: {
      txid: 'payment-id',
      owner: 'spark1self',
      signer: 'spark1self',
      nonce: 0,
      accountId: 'account-id',
      networkId,
      status,
      totalFeeInNative: fee,
      totalFeeFiatValue: feeFiat,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: { from: 'spark1self', to: '', sends, receives },
        },
      ],
    },
  } as IAccountHistoryTx;
}

const sendAmount = (tx: IAccountHistoryTx) =>
  tx.decodedTx.actions[0].assetTransfer?.sends[0].amount;

describe('mergeLightningSparkSendFee', () => {
  it('splits the server total into the amount this device paid and the fee', () => {
    const merged = mergeLightningSparkSendFee({
      localTx: createTx({
        status: EDecodedTxStatus.Pending,
        sends: [transfer('23')],
        fee: '3',
      }),
      onChainHistoryTx: createTx({ sends: [transfer('25', '0.0007')] }),
    });

    expect(sendAmount(merged)).toBe('23');
    expect(merged.decodedTx.totalFeeInNative).toBe('2');
    expect(merged.decodedTx.totalFeeFiatValue).toBe('0.0014');
    expect(merged.decodedTx.status).toBe(EDecodedTxStatus.Confirmed);
  });

  it('keeps the split when the merged record is the local record of a later merge', () => {
    const first = mergeLightningSparkSendFee({
      localTx: createTx({ sends: [transfer('23')] }),
      onChainHistoryTx: createTx({}),
    });
    const second = mergeLightningSparkSendFee({
      localTx: first,
      onChainHistoryTx: createTx({}),
    });

    expect(sendAmount(second)).toBe('23');
    expect(second.decodedTx.totalFeeInNative).toBe('2');
  });

  it('keeps the server fiat value when the transfer has no price', () => {
    const merged = mergeLightningSparkSendFee({
      localTx: createTx({ sends: [transfer('23')] }),
      onChainHistoryTx: createTx({ feeFiat: '0' }),
    });

    expect(merged.decodedTx.totalFeeInNative).toBe('2');
    expect(merged.decodedTx.totalFeeFiatValue).toBe('0');
  });

  it('keeps the server total when the local record is a server record', () => {
    const onChainHistoryTx = createTx({});
    const merged = mergeLightningSparkSendFee({
      localTx: createTx({}),
      onChainHistoryTx,
    });

    expect(sendAmount(merged)).toBe('25');
    expect(merged.decodedTx.totalFeeInNative).toBe('0');
  });

  it.each([
    ['another network', { networkId: 'evm--1' }, {}],
    ['a pending record', { status: EDecodedTxStatus.Pending }, {}],
    ['a failed record', { status: EDecodedTxStatus.Failed }, {}],
    ['a total below the local amount', {}, { sends: [transfer('26')] }],
    [
      'a local receive',
      {},
      { sends: [] as IDecodedTxTransferInfo[], receives: [transfer('23')] },
    ],
    ['a zero local amount', {}, { sends: [transfer('0')] }],
  ])(
    'returns the server record unchanged for %s',
    (_name, onChainOverrides, localOverrides) => {
      const onChainHistoryTx = createTx(onChainOverrides);
      const merged = mergeLightningSparkSendFee({
        localTx: createTx({ sends: [transfer('23')], ...localOverrides }),
        onChainHistoryTx,
      });

      expect(merged).toBe(onChainHistoryTx);
    },
  );
});
