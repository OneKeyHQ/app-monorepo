// Single source of truth for the runtime's method names; `methods.test.ts` checks it stays in step with `IXmrRuntimeApi`.
export const XMR_RUNTIME_METHODS = [
  // lifecycle
  'init',
  'dependencyVersions',
  'openWallet',
  'closeWallet',
  'setNodeUrl',
  'chainTip',

  // pure derivation -- no database, no node
  'deriveAccount',
  'deriveSubaddress',
  'spendScalar',
  'validateAddress',

  // identities
  'addAccount',
  'listAccounts',
  'removeAccount',
  'deleteWallet',
  'registerSubaddress',

  // scanning
  'updateChainTip',
  'syncStep',
  'syncPeek',
  'rewindTo',

  // reading
  'balance',
  'history',
  'transactionDetails',
  'diagDatabase',

  // spending
  'importKeyImages',
  'prepareTransaction',
  'signTransaction',
  'verifyTransaction',
  'verifySignedTransaction',
  'broadcastTransaction',
] as const;

export type IXmrRuntimeMethod = (typeof XMR_RUNTIME_METHODS)[number];

// Which args the wasm declares as `u64`, by position: `bigint` can't cross the extension/mobile JSON bridge, so the API carries these as decimal strings.
export const XMR_RUNTIME_U64_ARGS: Partial<
  Record<IXmrRuntimeMethod, readonly number[]>
> = {
  addAccount: [3],
  registerSubaddress: [0],
  updateChainTip: [0, 1],
  syncStep: [0, 1],
  syncPeek: [0],
  rewindTo: [0, 1, 2],
  balance: [0, 1],
  history: [0],
  transactionDetails: [0],
  importKeyImages: [0],
  prepareTransaction: [0, 3],
  broadcastTransaction: [0, 2],
};

const DECIMAL_U64 = /^(0|[1-9][0-9]*)$/;

/** Turn the decimal-string arguments the app passes into the `bigint` wasm wants. */
export function coerceXmrU64Args(
  method: IXmrRuntimeMethod,
  args: readonly unknown[],
): unknown[] {
  const positions = XMR_RUNTIME_U64_ARGS[method];
  if (!positions) return [...args];
  return args.map((arg, index) => {
    if (!positions.includes(index)) return arg;
    // Optional `u64` (`balance`'s chain tip) stays absent when absent.
    if (arg === undefined || arg === null) return arg;
    if (typeof arg !== 'string' || !DECIMAL_U64.test(arg)) {
      throw new TypeError(
        `xmr: ${method} argument ${index} must be a decimal u64 string, got ${String(arg)}`,
      );
    }
    return BigInt(arg);
  });
}
