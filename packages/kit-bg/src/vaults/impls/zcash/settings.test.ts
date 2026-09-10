/* cspell:ignore xprvs */

import { getVaultSettings } from '../../settings';

import settings from './settings';

// Zcash spreads `{...settingsBtc}`, and every inherited `true` flag is a UI
// entry point promising a code path. This freezes the convention review that
// caught 6 BTC-only paths leaking through: an account type / feature stays
// enabled ONLY when its full zcash flow works ("用不了就不搞"). If you enable
// one of these, implement and verify the whole flow first, then update this
// test in the same diff.
describe('zcash vault settings invariants', () => {
  it('loads settings from the indexed network ID', async () => {
    await expect(getVaultSettings({ networkId: 'zec--0' })).resolves.toBe(
      settings,
    );
  });

  it('enables only account types whose full flow works', () => {
    // Account-level xprvs sign t-to-t without a privacy runtime.
    expect(settings.importedAccountEnabled).toBe(true);
    // Transparent address/xpub watching remains read-only.
    expect(settings.watchingAccountEnabled).toBe(true);
    // KeyringHardware: device UA/UFVK at setup, device-signed PCZT at send
    expect(settings.hardwareAccountEnabled).toBe(true);
    expect(settings.qrAccountEnabled).toBe(false);
    expect(settings.externalAccountEnabled).toBe(false);
    expect(settings.supportedThirdPartyVendors).toBeUndefined();
  });

  it('disables BTC-inherited features without a zcash implementation', () => {
    // getCustomRpcEndpointStatus / broadcastTransactionFromCustomRpc absent
    expect(settings.customRpcEnabled).toBe(false);
    // note selection happens inside the wasm wallet; the BTC coin-control
    // screen would call a blockbook backend that does not index zcash
    expect(settings.coinControlEnabled).toBe(false);
    // bulk send would fall into BTC's coin-selection path, bypassing PCZT
    expect(settings.nativeBatchTransferEnabled).toBe(false);
    // A transparent BTC-style xprv/xpub cannot recover shielded funds.
    expect(settings.publicKeyExportEnabled).toBe(false);
    expect(settings.supportExportedSecretKeys).toEqual([]);
  });

  it('matches the PCZT send-path contract', () => {
    // ZIP-317 protocol fee; nothing user-editable
    expect(settings.editFeeEnabled).toBe(false);
    // A fully authorized PCZT must provide the txid used for pending-state
    // reconciliation and definite-rejection rollback.
    expect(settings.withoutBroadcastTxId).toBe(false);
    expect(settings.localWallet).toEqual(
      expect.objectContaining({
        activation: 'account-opt-in',
        balanceShape: 'pooled',
        historySource: 'vault-authoritative',
        tipLagWarningBlocks: 48,
        accountSetup: { requiresBirthday: true },
      }),
    );
    // Generic UI reads pool tabs, the send picker and history filters from
    // this list; exactly one public pool and one default private pool.
    const pools = settings.localWallet?.pools ?? [];
    expect(pools.filter((pool) => pool.kind === 'public')).toHaveLength(1);
    expect(pools.filter((pool) => pool.isDefaultPrivate)).toHaveLength(1);
    expect(new Set(pools.map((pool) => pool.id)).size).toBe(pools.length);
    // The vault composition hook owns local + backend history; this flag must
    // not come back and shadow it.
    expect(settings.onChainHistoryDisabled).toBeFalsy();
  });
});
