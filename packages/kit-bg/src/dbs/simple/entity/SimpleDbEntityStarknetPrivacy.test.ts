import { EStrk20OptInStatus } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20AccountPrivacyState } from '@onekeyhq/shared/types/starknetPrivacy';

import {
  SimpleDbEntityStarknetPrivacy,
  buildStrk20RecordKey,
} from './SimpleDbEntityStarknetPrivacy';

import type { IStarknetPrivacyDBStruct } from './SimpleDbEntityStarknetPrivacy';

const key = {
  networkId: 'starknet--mainnet',
  accountId: 'test-account',
  poolAddress: '0x1',
};
const record: IStrk20AccountPrivacyState = {
  ...key,
  profileId: 'account-leaf-v1',
  version: 1,
  chainId: '0x1',
  accountAddress: '0x2',
  keyIndex: 0,
  accountKeyScheme: 'stark-curve',
  accountKeyFingerprint: 'public-key-fingerprint',
  optInStatus: EStrk20OptInStatus.None,
  registerTxid: '0x3',
};

function setup(value: IStrk20AccountPrivacyState) {
  let data: IStarknetPrivacyDBStruct = {
    records: { [buildStrk20RecordKey(key)]: value },
  };
  const entity = Object.create(
    SimpleDbEntityStarknetPrivacy.prototype,
  ) as SimpleDbEntityStarknetPrivacy;
  Object.assign(entity, {
    getRawData: async () => data,
    setRawData: async (
      update: (previous: IStarknetPrivacyDBStruct) => IStarknetPrivacyDBStruct,
    ) => {
      data = update(data);
    },
  });
  return entity;
}

it('does not turn privacy back on when an old receipt races with opt-out', async () => {
  const entity = setup(record);
  const updated = await entity.patchRecord({
    ...key,
    expected: {
      optInStatus: EStrk20OptInStatus.RegisterPending,
      registerTxid: '0x3',
    },
    patch: { optInStatus: EStrk20OptInStatus.Registered },
  });
  expect(updated?.optInStatus).toBe(EStrk20OptInStatus.None);
});

it('does not replace a newer transfer with an older receipt', async () => {
  const entity = setup({
    ...record,
    lastTransfer: {
      txid: '0xnew',
      kind: 'transfer',
      status: 'pending',
      submittedAt: 100,
    },
  });
  const updated = await entity.patchRecord({
    ...key,
    expected: { lastTransferTxid: '0xold' },
    patch: {
      lastTransfer: {
        txid: '0xold',
        kind: 'transfer',
        status: 'confirmed',
        submittedAt: 50,
      },
    },
  });
  expect(updated?.lastTransfer?.txid).toBe('0xnew');
  expect(updated?.lastTransfer?.status).toBe('pending');
});

it('keeps the cooldown block monotonic when receipts resolve out of order', async () => {
  const entity = setup({ ...record, lastTxBlockNumber: 200 });
  const updated = await entity.patchRecord({
    ...key,
    patch: { lastTxBlockNumber: 100 },
  });
  expect(updated?.lastTxBlockNumber).toBe(200);
});

it('does not clear a new activation when an older receipt read finishes later', async () => {
  const entity = setup({ ...record, activationTxid: '0xnew' });
  const result = await entity.patchRecord({
    ...key,
    expected: { activationTxid: '0xold' },
    patch: { activationTxid: undefined, lastTxBlockNumber: 100 },
  });
  expect(result?.activationTxid).toBe('0xnew');
  expect(result?.lastTxBlockNumber).toBeUndefined();
});
