import { isNil } from 'lodash';

import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IVaultSettings,
} from './types';

export async function getVaultSettings({ networkId }: { networkId: string }) {
  const impl = networkUtils.getNetworkImpl({ networkId });
  const settingsLoader: Record<
    string,
    () => Promise<{ default: IVaultSettings }>
  > = {
    [IMPL_EVM]: () => import('./impls/evm/settings'),
  };
  const settings = (await settingsLoader[impl]()).default;
  return settings;
}

export async function getVaultSettingsDefaultPurpose({
  networkId,
}: {
  networkId: string;
}) {
  const settings = await getVaultSettings({ networkId });
  const firstPurpose = settings.purposes[0];
  if (isNil(firstPurpose)) {
    throw new Error(`no purpose found in vault settings: ${networkId}`);
  }
  return firstPurpose;
}

export async function getVaultSettingsAccountDeriveInfo({
  // template,
  networkId,
  deriveType,
}: {
  // template?: string;
  networkId: string;
  deriveType: IAccountDeriveTypes;
}): Promise<IAccountDeriveInfo> {
  const settings = await getVaultSettings({ networkId });
  let info: IAccountDeriveInfo | undefined;

  // **** query by template
  // if (template) {
  //   info = Object.values(settings.accountDeriveInfo).find(
  //     (item) => item.template === template,
  //   );
  // }

  // **** query by deriveType ( use default if not found)
  // eslint-disable-next-line no-param-reassign
  deriveType = deriveType || 'default';
  if (!info) {
    info = settings.accountDeriveInfo[deriveType];
  }
  if (!info) {
    throw new Error(
      `no accountDeriveInfo found in vault settings: ${networkId} ${deriveType}`,
    );
  }
  return info;
}
