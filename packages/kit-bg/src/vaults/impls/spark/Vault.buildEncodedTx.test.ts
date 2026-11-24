import type { IEncodedTxLightningSpark } from '@onekeyhq/shared/types/lightning';

import SparkVault from './Vault';

import type {
  IBuildEncodedTxParams,
  IUpdateUnsignedTxParams,
} from '../../types';

// The first BOLT 11 example invoice, which has no amount.
const INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';
const PAYMENT_HASH =
  '0001020304050607080900010203040506070809000102030405060708090102';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeVault() {
  return Object.assign(Object.create(SparkVault.prototype), {
    backgroundApi: {
      serviceLightning: {
        decodeInvoiceByServer: jest.fn(async () => ({
          paymentRequest: INVOICE,
          tags: [{ tagName: 'payment_hash', data: PAYMENT_HASH }],
        })),
      },
    },
  }) as SparkVault;
}

const BUILD_PARAMS = {
  transfersInfo: [{ from: 'spark address', to: INVOICE, amount: '1000' }],
} as unknown as IBuildEncodedTxParams;

describe('Spark Vault idempotency key', () => {
  it('gives each send its own key', async () => {
    const first = await makeVault().buildEncodedTx(BUILD_PARAMS);
    const second = await makeVault().buildEncodedTx(BUILD_PARAMS);

    expect(first.idempotencyKey).toMatch(UUID_V4_PATTERN);
    expect(second.idempotencyKey).toMatch(UUID_V4_PATTERN);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('keeps the key when the confirm page applies the approved fee', async () => {
    const vault = makeVault();
    const encodedTx = await vault.buildEncodedTx(BUILD_PARAMS);

    const updated = await vault.updateUnsignedTx({
      unsignedTx: { encodedTx },
      feeInfo: { common: { baseFee: '3' } },
    } as unknown as IUpdateUnsignedTxParams);

    expect(updated.encodedTx as IEncodedTxLightningSpark).toMatchObject({
      idempotencyKey: encodedTx.idempotencyKey,
      maxFeeSats: '3',
    });
  });
});
