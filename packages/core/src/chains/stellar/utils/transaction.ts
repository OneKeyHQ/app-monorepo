import BigNumber from 'bignumber.js';

import sdkStellar, { StellarSdk } from '../sdkStellar';

/**
 * Extract transaction hash from encoded transaction
 * This is what needs to be signed by hardware devices
 */
export function extractTransactionHash(
  encodedTx: string,
  networkPassphrase: string,
): Buffer {
  // Parse as Transaction to get hash
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    networkPassphrase,
  );
  return tx.hash();
}

export function isSorobanTransaction(tx: StellarSdk.Transaction): boolean {
  if (tx.operations.length !== 1) {
    return false;
  }

  switch (tx.operations[0].type) {
    case 'invokeHostFunction':
    case 'extendFootprintTtl':
    case 'restoreFootprint':
      return true;

    default:
      return false;
  }
}

/**
 * Combines the given raw transaction alongside the simulation results.
 * If the given transaction already has authorization entries in a host
 * function invocation (see {@link Operation.invokeHostFunction}), **the
 * simulation entries are ignored**.
 *
 * If the given transaction already has authorization entries in a host function
 * invocation (see {@link Operation.invokeHostFunction}), **the simulation
 * entries are ignored**.
 *
 * @param {Transaction|FeeBumpTransaction} raw the initial transaction, w/o simulation applied
 * @param {Api.SimulateTransactionResponse|Api.RawSimulateTransactionResponse} simulation the Soroban RPC simulation result (see {@link module:rpc.Server#simulateTransaction})
 * @returns {TransactionBuilder} a new, cloned transaction with the proper auth and resource (fee, footprint) simulation data applied
 *
 * @memberof module:rpc
 * @see {@link module:rpc.Server#simulateTransaction}
 * @see {@link module:rpc.Server#prepareTransaction}
 */
export function assembleTransaction(
  raw: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction,
  simulation: {
    minResourceFee: string;
    transactionData: string;
    auth: StellarSdk.xdr.SorobanAuthorizationEntry[];
  },
): StellarSdk.TransactionBuilder {
  if ('innerTransaction' in raw) {
    // TODO: Handle feebump transactions
    return assembleTransaction(raw.innerTransaction, simulation);
  }

  if (!isSorobanTransaction(raw)) {
    throw new TypeError(
      'unsupported transaction: must contain exactly one ' +
        'invokeHostFunction, extendFootprintTtl, or restoreFootprint ' +
        'operation',
    );
  }

  const classicFeeNum = new BigNumber(raw.fee || '0');
  const minResourceFeeNum = new BigNumber(simulation.minResourceFee || '0');
  const txnBuilder = StellarSdk.TransactionBuilder.cloneFrom(raw, {
    // automatically update the tx fee that will be set on the resulting tx to
    // the sum of 'classic' fee provided from incoming tx.fee and minResourceFee
    // provided by simulation.
    //
    // 'classic' tx fees are measured as the product of tx.fee * 'number of
    // operations', In soroban contract tx, there can only be single operation
    // in the tx, so can make simplification of total classic fees for the
    // soroban transaction will be equal to incoming tx.fee + minResourceFee.
    fee: classicFeeNum.plus(minResourceFeeNum).toFixed(0, BigNumber.ROUND_UP),
    // apply the pre-built Soroban Tx Data from simulation onto the Tx
    sorobanData: simulation.transactionData,
    networkPassphrase: raw.networkPassphrase,
  });

  if (raw.operations[0].type === 'invokeHostFunction') {
    // In this case, we don't want to clone the operation, so we drop it.
    txnBuilder.clearOperations();

    const invokeOp: StellarSdk.Operation.InvokeHostFunction = raw.operations[0];
    const existingAuth = invokeOp.auth ?? [];
    txnBuilder.addOperation(
      StellarSdk.Operation.invokeHostFunction({
        source: invokeOp.source,
        func: invokeOp.func,
        // if auth entries are already present, we consider this "advanced
        // usage" and disregard ALL auth entries from the simulation
        //
        // the intuition is "if auth exists, this tx has probably been
        // simulated before"
        auth: existingAuth.length > 0 ? existingAuth : simulation.auth,
      }),
    );
  }

  return txnBuilder;
}
