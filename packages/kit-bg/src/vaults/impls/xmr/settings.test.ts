import { XMR_TARGET_BLOCK_SECONDS } from '@onekeyhq/shared/src/config/xmr';

import settings from './settings';

describe('xmr vault settings', () => {
  const localWallet = settings.localWallet;

  it('declares a local wallet at all', () => {
    expect(localWallet).toBeDefined();
  });

  // A publicLabel would make Receive offer a public side with no address.
  it('exposes no public pool and therefore no public receive form', () => {
    expect(localWallet?.pools).toHaveLength(1);
    expect(localWallet?.pools[0].kind).toBe('private');
    expect(localWallet?.pools[0].source).toBe('localScan');
    expect(localWallet?.pools.some((pool) => pool.kind === 'public')).toBe(
      false,
    );
    expect(localWallet?.addressForms.publicLabel).toBeUndefined();
    expect(localWallet?.addressForms.privateLabel).toBeTruthy();
  });

  // As in mainstream Monero wallets, the address is only offered on Receive.
  it('shows no address on the token page', () => {
    expect(localWallet?.hideAddressOnTokenDetails).toBe(true);
  });

  // Otherwise max-send confirms balance-minus-fee, not the amount signed.
  it('keeps the confirm page on the amount the built transaction carries', () => {
    expect(settings.ignoreUpdateNativeAmount).toBe(true);
  });

  it('reports a single balance shape', () => {
    expect(localWallet?.balanceShape).toBe('single');
  });

  // No indexer covers Monero; the runtime is the only history source.
  it('treats the runtime as the only source of history', () => {
    expect(localWallet?.historySource).toBe('vault-authoritative');
  });

  // Withholding the address from the backend only holds with no backend pool.
  it('reads no pool from the backend', () => {
    expect(localWallet?.withholdAddressFromBackend).toBe(true);
    expect(localWallet?.pools.some((pool) => pool.source === 'backend')).toBe(
      false,
    );
  });

  it('requires an explicit per-account opt-in before scanning', () => {
    expect(localWallet?.activation).toBe('account-opt-in');
    expect(localWallet?.accountSetup.requiresBirthday).toBe(true);
  });

  // Scan cost scales per active viewing key; raise only with real-phone data.
  it('caps concurrently scanning accounts conservatively', () => {
    expect(localWallet?.maxEnabledAccounts).toBeDefined();
    expect(localWallet?.maxEnabledAccounts).toBeLessThanOrEqual(3);
    expect(localWallet?.maxEnabledAccounts).toBeGreaterThan(0);
  });

  it('derives the tip lag warning from Monero block time', () => {
    expect(localWallet?.blockTimeSeconds).toBe(XMR_TARGET_BLOCK_SECONDS);
    const warningMinutes =
      ((localWallet?.tipLagWarningBlocks ?? 0) * XMR_TARGET_BLOCK_SECONDS) / 60;
    expect(warningMinutes).toBeGreaterThanOrEqual(30);
    expect(warningMinutes).toBeLessThanOrEqual(120);
  });

  it('keeps a frozen-balance channel for the unverifiable portion', () => {
    expect(settings.hasFrozenBalance).toBe(true);
  });

  it('does not offer flows Monero cannot support yet', () => {
    expect(settings.hardwareAccountEnabled).toBe(false);
    expect(settings.watchingAccountEnabled).toBe(false);
    expect(settings.dappInteractionEnabled).toBe(false);
    expect(settings.supportExportedSecretKeys).toEqual([]);
  });
});
