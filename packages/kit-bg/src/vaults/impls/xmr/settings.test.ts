import { XMR_TARGET_BLOCK_SECONDS } from '@onekeyhq/shared/src/config/xmr';

import settings from './settings';

describe('xmr vault settings', () => {
  const localWallet = settings.localWallet;

  it('declares a local wallet at all', () => {
    expect(localWallet).toBeDefined();
  });

  /**
   * Monero has no public pool -- every output is private. This is the one
   * place the generic privacy-chain contract did not already fit, and the
   * contract was widened (publicLabel became optional) rather than faked
   * with a placeholder.
   *
   * If someone adds a publicLabel here, the receive page starts offering a
   * public/private switch whose public side cannot produce an address.
   */
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

  /**
   * `single` is what keeps the generic pool tabs off the token page. With
   * `pooled` the UI would render a one-tab switcher that does nothing.
   */
  // Otherwise max-send confirms balance-minus-fee, not the amount signed.
  it('keeps the confirm page on the amount the built transaction carries', () => {
    expect(settings.ignoreUpdateNativeAmount).toBe(true);
  });

  it('reports a single balance shape', () => {
    expect(localWallet?.balanceShape).toBe('single');
  });

  /**
   * No third-party indexer covers Monero the way blockbook covers
   * transparent Zcash. If this ever flips to 'server', history silently
   * becomes whatever a backend says it is -- for a privacy chain that is a
   * product decision, not a refactor.
   */
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

  /**
   * Scanning is opt-in because it costs the user real bandwidth and CPU.
   * 'always' would start a scan the moment an account exists.
   */
  it('requires an explicit per-account opt-in before scanning', () => {
    expect(localWallet?.activation).toBe('account-opt-in');
    expect(localWallet?.accountSetup.requiresBirthday).toBe(true);
  });

  /**
   * Trial decryption runs once per active viewing key per block, inline and
   * single-threaded. Monero costs 7.0x the scan bandwidth and 3.4x the trial
   * decryptions per on-chain transaction versus Zcash, and Zcash already
   * caps at five. Raising this needs a number from a real phone.
   */
  it('caps concurrently scanning accounts conservatively', () => {
    expect(localWallet?.maxEnabledAccounts).toBeDefined();
    expect(localWallet?.maxEnabledAccounts).toBeLessThanOrEqual(3);
    expect(localWallet?.maxEnabledAccounts).toBeGreaterThan(0);
  });

  /**
   * Block counts are not portable between chains. The tip-lag warning has to
   * be derived from Monero's own block time, not copied from Zcash's.
   */
  it('derives the tip lag warning from Monero block time', () => {
    expect(localWallet?.blockTimeSeconds).toBe(XMR_TARGET_BLOCK_SECONDS);
    const warningMinutes =
      ((localWallet?.tipLagWarningBlocks ?? 0) * XMR_TARGET_BLOCK_SECONDS) / 60;
    expect(warningMinutes).toBeGreaterThanOrEqual(30);
    expect(warningMinutes).toBeLessThanOrEqual(120);
  });

  /**
   * A watch-only Monero wallet cannot prove its outputs are still unspent
   * without key images. That gap has to be visible in the UI rather than
   * folded into one confident-looking number.
   */
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
