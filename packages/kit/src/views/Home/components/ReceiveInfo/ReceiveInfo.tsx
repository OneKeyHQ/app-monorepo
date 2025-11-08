import { memo, useCallback, useEffect } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useAccountOverviewActions,
  useWalletStatusAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import MainInfoBlock from '../NotBakcedUp/MainBlock';

function ReceiveInfo({
  recomputeLayout,
  closable,
}: {
  recomputeLayout?: () => void;
  closable?: boolean;
}) {
  const navigation = useAppNavigation();
  const themeVariant = useThemeVariant();
  const { updateWalletStatus } = useAccountOverviewActions().current;
  const [walletStatus] = useWalletStatusAtom();
  const intl = useIntl();

  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });

  const { run: refreshShouldShowReceiveInfo } = usePromiseResult(async () => {
    let shouldShowReceiveInfo = false;
    if (accountUtils.isWatchingWallet({ walletId: wallet?.id ?? '' })) {
      shouldShowReceiveInfo = false;
    } else {
      const resp = await backgroundApiProxy.serviceWalletStatus.getWalletStatus(
        {
          walletXfp: wallet?.xfp ?? '',
        },
      );

      if (resp && (resp?.manuallyCloseReceiveBlock || resp?.hasValue)) {
        shouldShowReceiveInfo = false;
      } else {
        shouldShowReceiveInfo = true;
      }
    }
    updateWalletStatus({
      showReceiveInfo: shouldShowReceiveInfo,
      receiveInfoInit: true,
    });
  }, [wallet?.id, wallet?.xfp, updateWalletStatus]);

  const handleAddMoney = useCallback(async () => {
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
    });
  }, [navigation]);

  const handleClose = useCallback(async () => {
    if (!closable) return;
    await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
      walletXfp: wallet?.xfp ?? '',
      status: {
        manuallyCloseReceiveBlock: true,
      },
    });
    await refreshShouldShowReceiveInfo();
  }, [closable, wallet?.xfp, refreshShouldShowReceiveInfo]);

  useEffect(() => {
    if (!isNil(walletStatus.showReceiveInfo) && recomputeLayout) {
      setTimeout(() => {
        recomputeLayout();
      }, 350);
    }
  }, [
    walletStatus.showReceiveInfo,
    walletStatus.receiveInfoInit,
    recomputeLayout,
  ]);

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.AccountValueUpdate,
      refreshShouldShowReceiveInfo,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountValueUpdate,
        refreshShouldShowReceiveInfo,
      );
    };
  }, [refreshShouldShowReceiveInfo]);

  if (!walletStatus.showReceiveInfo) {
    return null;
  }

  return (
    <MainInfoBlock
      title={intl.formatMessage({ id: ETranslations.global_add_money })}
      subtitle={intl.formatMessage({
        id: ETranslations.add_money_methods_desc,
      })}
      iconProps={{ name: 'ArrowBottomCircleOutline' }}
      iconContainerProps={{ bg: '$brand8' }}
      bgSource={
        themeVariant === 'dark'
          ? require('@onekeyhq/kit/assets/wallet-add-money-bg-dark.png')
          : require('@onekeyhq/kit/assets/wallet-add-money-bg.png')
      }
      closable={closable}
      onClose={handleClose}
      actions={
        <Button
          alignSelf="start"
          size="large"
          variant="primary"
          onPress={handleAddMoney}
          minWidth={120}
        >
          {intl.formatMessage({ id: ETranslations.global_add_money })}
        </Button>
      }
      containerProps={{
        minHeight: 288,
        bg: '$brand1',
        $gtMd: { flexBasis: 0, flexShrink: 1, flexGrow: 1 },
      }}
    />
  );
}

export default memo(ReceiveInfo);
