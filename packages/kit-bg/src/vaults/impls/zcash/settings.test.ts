/* cspell:ignore xprvs */
/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import {
  ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
  ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS,
} from '@onekeyhq/shared/src/config/zcash';
import { PRIVACY_CHAIN_PUBLIC_POOL_ID } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';

import { getVaultSettings } from '../../settings';

import settings from './settings';
import Vault from './Vault';

describe('zcash vault settings invariants', () => {
  it('loads settings from the indexed network ID', async () => {
    await expect(getVaultSettings({ networkId: 'zec--0' })).resolves.toBe(
      settings,
    );
  });

  it('enables only account types whose full flow works', () => {
    expect(settings.importedAccountEnabled).toBe(true);
    expect(settings.watchingAccountEnabled).toBe(true);
    // KeyringHardware: device UA/UFVK at setup, device-signed PCZT at send
    expect(settings.hardwareAccountEnabled).toBe(true);
    expect(settings.qrAccountEnabled).toBe(false);
    expect(settings.externalAccountEnabled).toBe(false);
    expect(settings.supportedThirdPartyVendors).toBeUndefined();
  });

  it('only offers a custom node while both custom-RPC hooks exist', () => {
    expect(settings.customRpcEnabled).toBe(true);
    expect(typeof Vault.prototype.getCustomRpcEndpointStatus).toBe('function');
    expect(typeof Vault.prototype.broadcastTransactionFromCustomRpc).toBe(
      'function',
    );
  });

  it('disables BTC-inherited features without a zcash implementation', () => {
    expect(settings.coinControlEnabled).toBe(false);
    expect(settings.nativeBatchTransferEnabled).toBe(false);
    expect(settings.publicKeyExportEnabled).toBe(false);
    expect(settings.supportExportedSecretKeys).toEqual([]);
  });

  it('turns the swap entry off', () => {
    expect(settings.disabledSwapAction).toBe(true);
  });

  it('matches the PCZT send-path contract', () => {
    expect(settings.editFeeEnabled).toBe(false);
    expect(settings.withoutBroadcastTxId).toBe(false);
    expect(settings.localWallet).toEqual(
      expect.objectContaining({
        activation: 'account-opt-in',
        balanceShape: 'pooled',
        tipLagWarningBlocks: 48,
        accountSetup: {
          requiresBirthday: true,
          earliestBirthday: {
            height: ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
            timestamp: ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS,
          },
        },
      }),
    );
    const pools = settings.localWallet?.pools ?? [];
    expect(pools.filter((pool) => pool.kind === 'public')).toHaveLength(1);
    expect(pools.filter((pool) => pool.isDefaultPrivate)).toHaveLength(1);
    expect(new Set(pools.map((pool) => pool.id)).size).toBe(pools.length);
    expect(settings.onChainHistoryDisabled).toBeFalsy();
  });

  it('declares one backend pool and local-scan shielded pools', () => {
    const localWallet = settings.localWallet;
    const pools = localWallet?.pools ?? [];
    expect(
      pools.map(({ key, kind, source }) => ({ key, kind, source })),
    ).toEqual([
      { key: 'transparent', kind: 'public', source: 'backend' },
      { key: 'ironwood', kind: 'private', source: 'localScan' },
      { key: 'orchard', kind: 'private', source: 'localScan' },
    ]);
    const backendPools = pools.filter((pool) => pool.source === 'backend');
    expect(backendPools.map((pool) => pool.id)).toEqual([
      PRIVACY_CHAIN_PUBLIC_POOL_ID,
    ]);
    expect(localWallet?.withholdAddressFromBackend).toBeFalsy();
  });
});
