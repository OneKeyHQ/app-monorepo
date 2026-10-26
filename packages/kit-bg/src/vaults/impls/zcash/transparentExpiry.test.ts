// cspell:ignore bestblock bestblockhash
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IProxyRequestItem } from '@onekeyhq/shared/types/proxy';

import { findExpiredTransparentSends } from './transparentExpiry';

import type { IZcashTransparentPendingTx } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';

const hash = '11'.repeat(32);
const tx: IZcashTransparentPendingTx = {
  txid: '22'.repeat(32),
  rawTx: 'synthetic-signed-only-in-journal',
  ownerId: 'owner',
  spentOutpoints: [
    { txid: '33'.repeat(32), vout: 0 },
    { txid: '44'.repeat(32), vout: 1 },
  ],
  expiryHeight: 100,
  createdAt: 1,
  broadcastState: 'unknown',
};

function fixture() {
  const chain = { chain: 'main', blocks: 111, bestblockhash: hash };
  let output: unknown = { bestblock: hash, confirmations: 20 };
  const request = jest.fn(async (body: IProxyRequestItem[]) => ({
    code: 0,
    data: {
      data: body.map((item) => ({
        success: true,
        data:
          item.params.method === 'getblockchaininfo' ? { ...chain } : output,
      })),
    },
  }));
  return {
    chain,
    request,
    setOutput: (value: unknown) => {
      output = value;
    },
  };
}

it('proves an expired send without account history using every signed input and a stable block', async () => {
  const { request } = fixture();
  await expect(
    findExpiredTransparentSends({ pending: [tx], request }),
  ).resolves.toEqual(new Set([tx.txid]));
  expect(
    request.mock.calls.map(([body]) => body.map((item) => item.params)),
  ).toEqual([
    [{ method: 'getblockchaininfo', params: [] }],
    tx.spentOutpoints.map((input) => ({
      method: 'gettxout',
      params: [input.txid, input.vout, true],
    })),
    [{ method: 'getblockchaininfo', params: [] }],
  ]);
  expect(JSON.stringify(request.mock.calls)).not.toContain(tx.rawTx);
  expect(JSON.stringify(request.mock.calls)).not.toContain(tx.ownerId);
});

it.each([0, -1, 1.5, Number.NaN, 500_000_000])(
  'never treats invalid or disabled expiry %s as expired',
  async (expiryHeight) => {
    const { request } = fixture();
    expect(
      await findExpiredTransparentSends({
        pending: [{ ...tx, expiryHeight }],
        request,
      }),
    ).toEqual(new Set());
    expect(request).not.toHaveBeenCalled();
  },
);

it.each([
  { spentOutpoints: [] },
  { spentOutpoints: [tx.spentOutpoints[0], tx.spentOutpoints[0]] },
  { spentOutpoints: [{ txid: 'bad', vout: 0 }] },
  { spentOutpoints: [{ txid: hash, vout: 4_294_967_296 }] },
])(
  'refuses incomplete or invalid signed input lists',
  async ({ spentOutpoints }) => {
    const { request } = fixture();
    expect(
      await findExpiredTransparentSends({
        pending: [{ ...tx, spentOutpoints }],
        request,
      }),
    ).toEqual(new Set());
    expect(request).not.toHaveBeenCalled();
  },
);

it.each([
  null,
  {},
  { bestblock: hash, confirmations: 0 },
  { bestblock: '55'.repeat(32), confirmations: 2 },
])(
  'keeps locks when an input is spent, unconfirmed or on another block',
  async (output) => {
    const { request, setOutput } = fixture();
    setOutput(output);
    expect(
      await findExpiredTransparentSends({ pending: [tx], request }),
    ).toEqual(new Set());
  },
);

it.each(['margin', 'network', 'height', 'hash'])(
  'rejects unsafe chain snapshots: %s',
  async (scenario) => {
    const { chain, request } = fixture();
    if (scenario === 'margin') chain.blocks = 110;
    if (scenario === 'network') chain.chain = 'test';
    request.mockImplementationOnce(async () => {
      const start = { ...chain };
      if (scenario === 'height') chain.blocks += 1;
      if (scenario === 'hash') chain.bestblockhash = '66'.repeat(32);
      return { code: 0, data: { data: [{ success: true, data: start }] } };
    });
    expect(
      await findExpiredTransparentSends({ pending: [tx], request }),
    ).toEqual(new Set());
  },
);

it.each([
  undefined,
  { code: 1, data: { data: [] } },
  { code: 0, data: { data: [] } },
  { code: 0, data: { data: [{ success: false, data: null }] } },
  {
    code: 0,
    data: { data: [{ success: true, error: 'RPC failed', data: null }] },
  },
])(
  'treats malformed or rejected proxy replies as no evidence',
  async (response) => {
    const request = jest.fn(async () => response);
    expect(
      await findExpiredTransparentSends({ pending: [tx], request }),
    ).toEqual(new Set());
  },
);

it('keeps locks after a network timeout', async () => {
  expect(
    await findExpiredTransparentSends({
      pending: [tx],
      request: async () => {
        throw new OneKeyLocalError('timeout');
      },
    }),
  ).toEqual(new Set());
});

it('rejects a truncated input response instead of proving a subset of inputs', async () => {
  const { request } = fixture();
  const implementation = request.getMockImplementation()!;
  request.mockImplementation(async (body) => {
    const response = await implementation(body);
    if (body.some((item) => item.params.method === 'gettxout'))
      response.data.data.pop();
    return response;
  });
  expect(await findExpiredTransparentSends({ pending: [tx], request })).toEqual(
    new Set(),
  );
});

it('never applies one send proof to another send with a spent input', async () => {
  const { request } = fixture();
  const second = {
    ...tx,
    txid: '77'.repeat(32),
    spentOutpoints: [{ txid: '88'.repeat(32), vout: 2 }],
  };
  request.mockImplementationOnce(async () => ({
    code: 0,
    data: {
      data: [
        {
          success: true,
          data: { chain: 'main', blocks: 111, bestblockhash: hash },
        },
      ],
    },
  }));
  request.mockImplementationOnce(async (body) => ({
    code: 0,
    data: {
      data: body.map((_, index) => ({
        success: true,
        data: index === 2 ? null : { bestblock: hash, confirmations: 2 },
      })),
    },
  }));
  expect(
    await findExpiredTransparentSends({ pending: [tx, second], request }),
  ).toEqual(new Set([tx.txid]));
});
