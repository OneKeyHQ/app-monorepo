import {
  IMPL_BCH,
  IMPL_BTC,
  IMPL_COSMOS,
  IMPL_DOGE,
  IMPL_EVM,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IVaultSettings,
  IVaultSettingsNetworkInfo,
} from './types';

function validateVaultSettings({
  settings,
  networkId,
}: {
  settings: IVaultSettings;
  networkId: string;
}) {
  if (process.env.NODE_ENV !== 'production') {
    if (!settings.accountDeriveInfo.default) {
      throw new Error(
        `no default accountDeriveInfo found in vault settings: ${networkId}`,
      );
    }
  }
}

export async function getVaultSettings({ networkId }: { networkId: string }) {
  if (!networkId) {
    throw new Error('networkId is not defined');
  }
  const impl = networkUtils.getNetworkImpl({ networkId });
  const settingsLoader: Record<
    string,
    () => Promise<{ default: IVaultSettings }>
  > = {
    [IMPL_EVM]: () => import('./impls/evm/settings'),
    [IMPL_BTC]: () => import('./impls/btc/settings'),
    [IMPL_TBTC]: () => import('./impls/tbtc/settings'),
    [IMPL_DOGE]: () => import('./impls/doge/settings'),
    [IMPL_BCH]: () => import('./impls/bch/settings'),
    [IMPL_COSMOS]: () => import('./impls/cosmos/settings'),
  };
  const loader = settingsLoader[impl];
  if (!loader) {
    throw new Error(`no settings found: impl=${impl}`);
  }
  const settings = (await settingsLoader[impl]()).default;
  validateVaultSettings({ settings, networkId });
  return settings;
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
    info = settings.accountDeriveInfo[deriveType as 'default'];
  }
  if (!info) {
    throw new Error(
      `no accountDeriveInfo found in vault settings: ${networkId} ${deriveType}`,
    );
  }
  return info;
}

export async function getVaultSettingsNetworkInfo({
  networkId,
}: {
  networkId: string;
}): Promise<IVaultSettingsNetworkInfo> {
  const settings = await getVaultSettings({ networkId });
  const defaultInfo = settings.networkInfo?.default ?? {};
  const info = settings.networkInfo?.[networkId] ?? {};
  return {
    ...defaultInfo,
    ...info,
  };
}
