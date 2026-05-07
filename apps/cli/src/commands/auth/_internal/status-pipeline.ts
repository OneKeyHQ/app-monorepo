import { VaultClient } from '../../../infra/vault';

import type { IVaultPlaintext } from '../../../infra/vault';

export type IStatusPipelineResult = {
  ok: true;
  data: {
    activeWalletId: string;
    activeKeyId: string;
    displayAddress: string;
    sourceLabel: string;
  };
};

export class StatusPipelineError extends Error {
  constructor(readonly code: 'NOT_AUTHENTICATED') {
    super(code);
    this.name = 'StatusPipelineError';
  }
}

export type IStatusPipelineDependencies = {
  vaultClient?: Pick<VaultClient, 'readOnly'>;
};

function maskKeyId(keyId: string): string {
  return keyId.slice(0, 8);
}

function maskAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function buildStatusFromVault(vault: IVaultPlaintext): IStatusPipelineResult {
  const { activeWalletId, activeKeyId } = vault.metadata;
  if (!activeWalletId || !activeKeyId) {
    throw new StatusPipelineError('NOT_AUTHENTICATED');
  }

  const label = vault.sessionLabels[activeKeyId];
  if (!label) {
    throw new StatusPipelineError('NOT_AUTHENTICATED');
  }

  return {
    ok: true,
    data: {
      activeWalletId,
      activeKeyId: maskKeyId(activeKeyId),
      displayAddress: maskAddress(label.displayAddress),
      sourceLabel: label.sourceLabel,
    },
  };
}

export async function executeStatusPipeline(
  dependencies: IStatusPipelineDependencies = {},
): Promise<IStatusPipelineResult> {
  const vaultClient = dependencies.vaultClient ?? new VaultClient();
  return vaultClient.readOnly((vault) => buildStatusFromVault(vault));
}
