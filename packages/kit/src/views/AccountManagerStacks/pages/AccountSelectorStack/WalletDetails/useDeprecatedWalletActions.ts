import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IUiResourceResult } from '@onekeyhq/kit/src/hooks/uiResource';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { deprecatedWalletWarningResource } from '@onekeyhq/kit/src/utils/deprecatedWalletWarningResource';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import {
  getTitleAndDescription,
  showWalletRemoveDialog,
} from '../../../components/WalletEdit/WalletRemoveDialog';

import type { IReplacementWallet } from './useDeprecatedWalletWarning';

export function useDeprecatedWalletActions({
  num,
  wallet,
  warning,
  interactive,
  epoch,
  reloadWarning,
}: {
  num: number;
  wallet: IDBWallet | undefined;
  warning: IUiResourceResult<IReplacementWallet | null> | undefined;
  interactive: boolean;
  epoch: number;
  reloadWarning: () => Promise<void>;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { config } = useAccountSelectorContextData();
  const toPickYourDevicePage = useNavigateToPickYourDevicePage();
  const replacementWallet =
    warning?.status === 'ready' ? warning.data : undefined;
  const isMounted = useIsMounted();
  const interactionRef = useRef({
    generation: 0,
    interactive,
    walletId: wallet?.id,
    replacementId: replacementWallet?.id,
    epoch,
  });
  const previousInteraction = interactionRef.current;
  const interactionChanged =
    previousInteraction.interactive !== interactive ||
    previousInteraction.walletId !== wallet?.id ||
    previousInteraction.epoch !== epoch ||
    previousInteraction.replacementId !== replacementWallet?.id;
  interactionRef.current = {
    generation: previousInteraction.generation + (interactionChanged ? 1 : 0),
    interactive,
    walletId: wallet?.id,
    replacementId: replacementWallet?.id,
    epoch,
  };
  const handlingRef = useRef(false);
  const handlePrimaryPress = useCallback(async () => {
    if (
      !wallet ||
      !interactive ||
      !deprecatedWalletWarningResource.isCurrent(epoch) ||
      warning?.status !== 'ready' ||
      handlingRef.current
    )
      return;
    if (!replacementWallet) {
      void toPickYourDevicePage();
      return;
    }
    handlingRef.current = true;
    const interactionGeneration = interactionRef.current.generation;
    try {
      const [source, target] = await Promise.all([
        backgroundApiProxy.serviceAccountSelector.getFocusedWalletInfo({
          focusedWallet: wallet?.id,
        }),
        backgroundApiProxy.serviceAccountSelector.getFocusedWalletInfo({
          focusedWallet: replacementWallet.id,
        }),
      ]);
      if (
        !isMounted.current ||
        interactionRef.current.generation !== interactionGeneration ||
        !interactionRef.current.interactive ||
        interactionRef.current.walletId !== wallet?.id ||
        interactionRef.current.epoch !== epoch ||
        interactionRef.current.replacementId !== replacementWallet.id ||
        !deprecatedWalletWarningResource.isCurrent(epoch)
      )
        return;
      if (
        !source?.wallet.deprecated ||
        !target ||
        target.wallet.deprecated ||
        target.wallet.isMocked ||
        accountUtils.isHwHiddenWallet({ wallet: target.wallet }) ||
        accountUtils.isQrWallet({ walletId: wallet?.id }) !==
          accountUtils.isQrWallet({ walletId: target.wallet?.id }) ||
        !deviceUtils.isSamePhysicalDevice(source?.device, target.device)
      ) {
        await reloadWarning();
        return;
      }
      await actions.current.updateSelectedAccountFocusedWallet({
        num,
        focusedWallet: replacementWallet.id,
      });
    } finally {
      handlingRef.current = false;
    }
  }, [
    actions,
    interactive,
    isMounted,
    epoch,
    num,
    reloadWarning,
    replacementWallet,
    toPickYourDevicePage,
    wallet,
    warning?.status,
  ]);

  const handleRemovePress = useCallback(() => {
    if (
      !wallet ||
      !interactive ||
      !deprecatedWalletWarningResource.isCurrent(epoch)
    )
      return;
    const { title, description, isHwOrQr } = getTitleAndDescription({
      wallet,
      intl,
    });
    showWalletRemoveDialog({
      nativeSheet: true,
      config,
      title,
      description,
      showCheckBox: !isHwOrQr,
      defaultChecked: false,
      wallet,
    });
  }, [config, interactive, intl, epoch, wallet]);

  return {
    onPrimaryPress: handlePrimaryPress,
    onRemovePress: handleRemovePress,
  };
}
