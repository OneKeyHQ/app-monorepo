import { useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { browserTypeHandler } from '@onekeyhq/kit/src/views/Discovery/utils/explorerUtils';
import { ActionItem } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useSupportToken } from '../../../FiatCrypto/hooks';

import type { IActionBaseProps } from './type';

export const ActionBase = ({
  networkId,
  tokenAddress,
  type,
  label,
  icon,
  accountId,
}: IActionBaseProps) => {
  const navigation = useAppNavigation();
  const [loading, setLoading] = useState(false);
  const { handleOpenWebSite } = useBrowserAction().current;
  const { result: isSupport } = useSupportToken({
    networkId,
    tokenAddress,
    type,
  });
  const handlePress = useCallback(async () => {
    setLoading(true);
    try {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress,
          accountId,
          type,
        });
      if (!url) {
        Toast.error({ title: 'Failed to get widget url' });
        return;
      }
      if (browserTypeHandler === 'MultiTabBrowser') {
        navigation.popStack();
      }
      handleOpenWebSite({
        webSite: { url, title: '' },
        navigation,
      });
      if (platformEnv.isNative) {
        navigation.switchTab(ETabRoutes.Discovery);
      }
    } finally {
      setLoading(false);
    }
  }, [navigation, handleOpenWebSite, networkId, tokenAddress, type, accountId]);
  return (
    <ActionItem
      loading={loading}
      label={label}
      icon={icon}
      disabled={!isSupport}
      onPress={handlePress}
    />
  );
};
