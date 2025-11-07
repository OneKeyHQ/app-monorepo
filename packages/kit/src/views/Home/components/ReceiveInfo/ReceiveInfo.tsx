import { memo, useCallback, useEffect } from 'react';

import { Button, IconButton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function ReceiveInfo({
  recomputeLayout,
  closable,
}: {
  recomputeLayout: () => void;
  closable?: boolean;
}) {
  const navigation = useAppNavigation();

  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });

  const { result: shouldShowReceiveInfo, run: refreshShouldShowReceiveInfo } =
    usePromiseResult(async () => {
      if (accountUtils.isWatchingWallet({ walletId: wallet?.id ?? '' })) {
        return false;
      }

      const walletStatus =
        await backgroundApiProxy.serviceWalletStatus.getWalletStatus({
          walletXfp: wallet?.xfp ?? '',
        });

      if (walletStatus?.manuallyCloseReceiveBlock || !walletStatus?.hasValue) {
        return false;
      }
      return true;
    }, [wallet?.xfp, wallet?.id]);

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
        manuallyCloseReferralCodeBlock: true,
      },
    });
    await refreshShouldShowReceiveInfo();
    setTimeout(() => {
      recomputeLayout();
    }, 1000);
  }, [closable, recomputeLayout, wallet?.xfp, refreshShouldShowReceiveInfo]);

  useEffect(() => {
    if (shouldShowReceiveInfo) {
      recomputeLayout();
    }
  }, [shouldShowReceiveInfo, recomputeLayout]);

  if (!shouldShowReceiveInfo) {
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
