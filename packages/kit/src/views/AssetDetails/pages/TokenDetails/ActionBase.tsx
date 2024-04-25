import { useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ActionItem } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
  const [loading, setLoading] = useState(false);
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
      openUrlExternal(url);
    } finally {
      setLoading(false);
    }
  }, [networkId, tokenAddress, type, accountId]);
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
