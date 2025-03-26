import { useCallback, useMemo, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ActionItem } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useSupportToken } from '../../../FiatCrypto/hooks';

import type { IActionBaseProps } from './type';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export const ActionBase = ({
  networkId,
  tokenAddress,
  type,
  label,
  icon,
  accountId,
  walletType,
  disabled,
  hiddenIfDisabled,
  ...rest
}: IActionBaseProps) => {
  const [loading, setLoading] = useState(false);
  const { result: isSupported } = useSupportToken(
    networkId,
    tokenAddress,
    type,
  );

  const isDisabled = useMemo(() => {
    if (walletType === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSupported) {
      return true;
    }

    return false;
  }, [isSupported, walletType]);

  const handlePress = useCallback(async () => {
    setLoading(true);

    if (type === 'buy') {
      defaultLogger.wallet.walletActions.actionBuy({
        walletType: walletType ?? '',
        networkId: networkId ?? '',
        source: 'tokenDetails',
      });
    } else if (type === 'sell') {
      defaultLogger.wallet.walletActions.actionSell({
        walletType: walletType ?? '',
        networkId: networkId ?? '',
        source: 'tokenDetails',
      });
    }

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
  }, [type, walletType, networkId, tokenAddress, accountId]);
  if (hiddenIfDisabled && isDisabled) {
    return null;
  }
  return (
    <ActionItem
      loading={loading}
      label={label}
      icon={icon}
      disabled={disabled || isDisabled}
      onPress={handlePress}
      {...rest}
    />
  );
};
