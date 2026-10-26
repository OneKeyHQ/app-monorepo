// cspell:ignore bestblock bestblockhash
import { chunk } from 'lodash';
import { z } from 'zod';

import type { IProxyRequestItem } from '@onekeyhq/shared/types/proxy';

import type { IZcashTransparentPendingTx } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';

export const ZCASH_TRANSPARENT_DROP_MARGIN_BLOCKS = 10;

export function isZcashTransparentExpiryHeight(height: number): boolean {
  // Zero disables expiry; consensus reserves heights >= 500,000,000.
  return Number.isSafeInteger(height) && height > 0 && height < 500_000_000;
}

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/i);
const chainSchema = z.object({
  chain: z.literal('main'),
  blocks: z.number().int().nonnegative().safe(),
  bestblockhash: hashSchema,
});
const unspentSchema = z.object({
  bestblock: hashSchema,
  confirmations: z.number().int().positive().safe(),
});
const proxySchema = z.object({
  code: z.literal(0),
  data: z.object({
    data: z.array(
      z.object({
        success: z.literal(true),
        data: z.unknown(),
        error: z.union([z.null(), z.literal('')]).optional(),
      }),
    ),
  }),
});

// All inputs still unspent on B proves this send was not mined on B. Together
// with expiry + margin, this works even when the account has no recent history.
// Only the existing OneKey RPC proxy is queried, never another lightwalletd.
export async function findExpiredTransparentSends({
  pending,
  request,
}: {
  pending: IZcashTransparentPendingTx[];
  request: (body: IProxyRequestItem[]) => Promise<unknown>;
}): Promise<Set<string>> {
  const candidates = pending.filter(
    (tx) =>
      isZcashTransparentExpiryHeight(tx.expiryHeight) &&
      hashSchema.safeParse(tx.txid).success &&
      tx.spentOutpoints.length > 0 &&
      tx.spentOutpoints.every(
        (input) =>
          hashSchema.safeParse(input.txid).success &&
          Number.isSafeInteger(input.vout) &&
          input.vout >= 0 &&
          input.vout <= 4_294_967_295,
      ) &&
      new Set(
        tx.spentOutpoints.map(
          (input) => `${input.txid.toLowerCase()}:${input.vout}`,
        ),
      ).size === tx.spentOutpoints.length,
  );
  if (!candidates.length) return new Set();
  try {
    const rpc = async (body: IProxyRequestItem[]) => {
      const response = proxySchema.parse(await request(body));
      if (response.data.data.length !== body.length) return [];
      return response.data.data.map((item) => item.data);
    };
    const chainRequest = [
      { route: 'rpc', params: { method: 'getblockchaininfo', params: [] } },
    ];
    const start = chainSchema.parse((await rpc(chainRequest))[0]);
    const expired = candidates.filter(
      (tx) =>
        start.blocks > tx.expiryHeight + ZCASH_TRANSPARENT_DROP_MARGIN_BLOCKS,
    );
    if (!expired.length) return new Set();
    const inputs = [
      ...new Map(
        expired.flatMap((tx) =>
          tx.spentOutpoints.map(
            (input) =>
              [`${input.txid.toLowerCase()}:${input.vout}`, input] as const,
          ),
        ),
      ),
    ];
    const unspent = new Set<string>();
    for (const batch of chunk(inputs, 20)) {
      // eslint-disable-next-line no-await-in-loop
      const results = await rpc(
        batch.map(([, input]) => ({
          route: 'rpc',
          params: {
            method: 'gettxout',
            params: [input.txid, input.vout, true],
          },
        })),
      );
      if (results.length !== batch.length) return new Set();
      results.forEach((result, index) => {
        const output = unspentSchema.safeParse(result);
        if (
          output.success &&
          output.data.bestblock.toLowerCase() ===
            start.bestblockhash.toLowerCase()
        ) {
          unspent.add(batch[index][0]);
        }
      });
    }
    const end = chainSchema.parse((await rpc(chainRequest))[0]);
    if (
      end.blocks !== start.blocks ||
      end.bestblockhash.toLowerCase() !== start.bestblockhash.toLowerCase()
    ) {
      return new Set();
    }
    return new Set(
      expired
        .filter((tx) =>
          tx.spentOutpoints.every((input) =>
            unspent.has(`${input.txid.toLowerCase()}:${input.vout}`),
          ),
        )
        .map((tx) => tx.txid.toLowerCase()),
    );
  } catch {
    // Unsupported RPCs, network errors and inconsistent responses prove nothing.
    return new Set();
  }
}
