import type { IManualCloudSyncResult } from '@onekeyhq/kit-bg/src/services/ServicePrimeCloudSync/ServicePrimeCloudSync';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function getManualCloudSyncFeedback(result: IManualCloudSyncResult) {
  switch (result) {
    case 'completed':
      return {
        method: 'success',
        title: ETranslations.global_sync_successfully,
      } as const;
    case 'network-unavailable':
      return {
        method: 'error',
        title: ETranslations.global_network_error,
      } as const;
    case 'server-unavailable':
      return {
        method: 'error',
        title: ETranslations.global_server_error,
      } as const;
    case 'session-unavailable':
      return {
        method: 'error',
        title: ETranslations.syncing_paused__title,
      } as const;
    case 'hardware-key-unavailable':
      return {
        method: 'error',
        title: ETranslations.cloud_sync_hardware_key_missing__desc,
      } as const;
    case 'software-key-unavailable':
      return {
        method: 'error',
        title: ETranslations.cloud_sync_data_unreadable__msg,
      } as const;
    case 'sync-blocked':
      return {
        method: 'error',
        title: ETranslations.global_sync_error,
      } as const;
    case 'cancelled':
    case 'sync-disabled':
    case 'local-deferred':
    case 'incomplete':
      return undefined;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
