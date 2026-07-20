import type { IHomeFacts } from '../facts/homeFacts';
import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

export function projectHomeBackupShell(
  facts: IHomeFacts,
): IHomeShellSemanticModel | undefined {
  if (!facts.wallet.ready || facts.wallet.backupStatus === 'unknown') {
    return { kind: 'loading' };
  }
  if (facts.wallet.backupStatus === 'required') {
    return { kind: 'backupRequired', commandId: 'backupWallet' };
  }
  if (!facts.wallet.hasNetworkAccount) {
    return { kind: 'missingNetworkAccount' };
  }
  return undefined;
}
