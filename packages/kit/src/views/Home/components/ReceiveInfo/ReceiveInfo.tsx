import { memo, useCallback, useEffect } from 'react';

import { isNil } from 'lodash';

import { Button, IconButton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountOverviewActions,
  useWalletStatusAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function ReceiveInfo({
  recomputeLayout,
  closable,
}: {
  recomputeLayout?: () => void;
  closable?: boolean;
}) {
  const navigation = useAppNavigation();

  const { updateWalletStatus } = useAccountOverviewActions().current;
  const [walletStatus] = useWalletStatusAtom();

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
    <Stack
      flex={1}
      height={360}
      alignItems="center"
      justifyContent="center"
      alignContent="center"
    >
      <Button onPress={handleAddMoney}>Add Money</Button>
      {closable ? (
        <IconButton
          variant="tertiary"
          position="absolute"
          top="$2"
          right="$2"
          icon="CrossedSmallOutline"
          size="small"
          onPress={handleClose}
          iconProps={{
            color: '$iconSubdued',
          }}
        />
      ) : null}
    </Stack>
  );
}

export default memo(ReceiveInfo);
