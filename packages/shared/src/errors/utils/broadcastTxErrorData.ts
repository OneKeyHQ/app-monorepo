export const BROADCAST_TX_CONTEXT_DATA_FIELD = '$$broadcastTxContext';

export type IBroadcastTxContext = {
  networkId: string;
  txId: string;
};

export function getBroadcastTxContextFromData(
  data: unknown,
  networkId?: string,
): IBroadcastTxContext | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return undefined;
  const context = (data as Record<string, unknown>)[
    BROADCAST_TX_CONTEXT_DATA_FIELD
  ];
  if (!context || typeof context !== 'object' || Array.isArray(context))
    return undefined;
  const candidate = context as Partial<IBroadcastTxContext>;
  if (
    typeof candidate.networkId !== 'string' ||
    !/^evm--\d+$/.test(candidate.networkId) ||
    (networkId !== undefined && candidate.networkId !== networkId) ||
    typeof candidate.txId !== 'string' ||
    !/^0x[\da-f]{64}$/i.test(candidate.txId)
  )
    return undefined;
  return { networkId: candidate.networkId, txId: candidate.txId };
}
