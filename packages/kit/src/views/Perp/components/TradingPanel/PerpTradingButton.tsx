import { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  resetToRoute,
} from '@onekeyhq/components';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsCommonConfigPersistAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import { useEnableTradingWithDepositFallback } from '../../hooks/useEnableTradingWithDepositFallback';
import { usePerpsMarketDataFreshness } from '../../hooks/usePerpsMarketDataFreshness';
import { useShowDepositWithdrawModal } from '../../hooks/useShowDepositWithdrawModal';
import { useTradingPrice } from '../../hooks/useTradingPrice';
import { PerpTestIDs } from '../../testIDs';
import { shouldBlockPerpsTradingForMarketData } from '../../utils/perpsMarketDataFreshness';
import { PERP_TRADE_BUTTON_COLORS } from '../../utils/styleUtils';

const sharedButtonProps = {
  size: 'medium',
  borderRadius: '$full',
};

export function PerpTradingButton({
  loading,
  handleShowConfirm,
  formData,
  computedSize,
  isMinimumOrderNotMet,
  isSubmitting,
  isNoEnoughMargin,
}: {
  loading: boolean;
  handleShowConfirm: () => void;
  formData: ITradingFormData;
  computedSize: BigNumber;
  isMinimumOrderNotMet: boolean;
  isSubmitting: boolean;
  isNoEnoughMargin: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();
  const [tradingMode] = useTradingModeAtom();
  const { midPrice } = useTradingPrice();
  const marketDataFreshness = usePerpsMarketDataFreshness();
  const shouldBlockForMarketData =
    shouldBlockPerpsTradingForMarketData(marketDataFreshness);
  const themeVariant = useThemeVariant();
  const isSpot = tradingMode === 'spot';

  const handleConnectWallet = useCallback(async () => {
    if (platformEnv.isWebDappMode) {
      navigation.pushModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.ConnectWalletOptions,
      });
    } else {
      resetToRoute(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.GetStarted,
        },
      });
    }
  }, [navigation]);
  const isAccountLoading = useMemo<boolean>(() => {
    return (
      perpsAccountLoading.enableTradingLoading ||
      perpsAccountLoading.selectAccountLoading
    );
  }, [
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.selectAccountLoading,
  ]);
  const enableTrading = useEnableTradingWithDepositFallback();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  const handleDepositFromToast = useCallback(() => {
    void showDepositWithdrawModal('deposit');
  }, [showDepositWithdrawModal]);

  const showNoEnoughMarginToast = useCallback(() => {
    Toast.error({
      title: isSpot
        ? intl.formatMessage({
            id: ETranslations.dexmarket_insufficient_balance,
          })
        : intl.formatMessage({
            id: ETranslations.perp_insufficient_margin__title,
          }),
      actions: (
        <Button
          testID={PerpTestIDs.MarginToastDepositButton}
          size="small"
          variant="primary"
          onPress={handleDepositFromToast}
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </Button>
      ),
      actionsAlign: 'left',
      toastId: `perp-no-enough-margin-${isSpot ? 'spot' : 'perp'}`,
    });
  }, [handleDepositFromToast, intl, isSpot]);

  const buttonDisabled = useMemo(() => {
    return (
      !computedSize.gt(0) ||
      !perpsAccountStatus.canTrade ||
      isSubmitting ||
      isAccountLoading ||
      isMinimumOrderNotMet ||
      (perpsAccountStatus.canTrade &&
        (perpConfigCommon?.disablePerpActionPerp ||
          perpConfigCommon?.ipDisablePerp))
    );
  }, [
    computedSize,
    perpsAccountStatus.canTrade,
    isSubmitting,
    isAccountLoading,
    isMinimumOrderNotMet,
    perpConfigCommon?.disablePerpActionPerp,
    perpConfigCommon?.ipDisablePerp,
  ]);
  const buttonText = useMemo(() => {
    if (isSubmitting)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    if (isMinimumOrderNotMet)
      return intl.formatMessage(
        {
          id: ETranslations.perp_size_least,
        },
        {
          amount: '$10',
        },
      );
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_place_order,
    });
  }, [isSubmitting, isMinimumOrderNotMet, intl]);

  const isLong = useMemo(() => formData.side === 'long', [formData.side]);
  const buttonStyles = useMemo(() => {
    const colors = PERP_TRADE_BUTTON_COLORS;
    const getBgColor = () => {
      if (isAccountLoading) return undefined;

      return themeVariant === 'light'
        ? colors.light[isLong ? 'long' : 'short']
        : colors.dark[isLong ? 'long' : 'short'];
    };

    const getHoverBgColor = () => {
      if (isAccountLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longHover' : 'shortHover']
        : colors.dark[isLong ? 'longHover' : 'shortHover'];
    };

    const getPressBgColor = () => {
      if (isAccountLoading) return undefined;
      return themeVariant === 'light'
        ? colors.light[isLong ? 'longPress' : 'shortPress']
        : colors.dark[isLong ? 'longPress' : 'shortPress'];
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
      textColor: '$textOnColor',
    };
  }, [isAccountLoading, isLong, themeVariant]);

  const createAddressButtonRender = useCallback((props: IButtonProps) => {
    return (
      <Button
        testID="perp-create-address-btn"
        {...sharedButtonProps}
        {...props}
      />
    );
  }, []);

  const getTpslErrorMessage = useCallback(
    (type: 'TP' | 'SL', direction: 'higher' | 'lower') => ({
      title: `${type} price must be ${direction} than current price. To close position immediately, use the position table or order form.`,
    }),
    [],
  );

  const validateTpslPrices = useCallback(async () => {
    if (!formData.hasTpsl || !formData.price) return true;

    const entryPrice = new BigNumber(
      formData.type === 'limit' ? formData.price : midPrice || '0',
    );
    if (!entryPrice.isFinite() || entryPrice.isZero()) {
      // entry price is invalid
      return true;
    }
    const tpPrice = formData.tpTriggerPx
      ? new BigNumber(formData.tpTriggerPx)
      : null;
    const slPrice = formData.slTriggerPx
      ? new BigNumber(formData.slTriggerPx)
      : null;

    // Validate Take Profit
    if (tpPrice) {
      if (isLong && tpPrice.lte(entryPrice)) {
        Toast.error(getTpslErrorMessage('TP', 'higher'));
        return false;
      }
      if (!isLong && tpPrice.gte(entryPrice)) {
        Toast.error(getTpslErrorMessage('TP', 'lower'));
        return false;
      }
    }

    // Validate Stop Loss
    if (slPrice) {
      if (isLong && slPrice.gte(entryPrice)) {
        Toast.error(getTpslErrorMessage('SL', 'lower'));
        return false;
      }
      if (!isLong && slPrice.lte(entryPrice)) {
        Toast.error(getTpslErrorMessage('SL', 'higher'));
        return false;
      }
    }

    return true;
  }, [
    formData.hasTpsl,
    formData.price,
    formData.type,
    formData.tpTriggerPx,
    formData.slTriggerPx,
    midPrice,
    isLong,
    getTpslErrorMessage,
  ]);

  const orderConfirm = useCallback(async () => {
    if (shouldBlockForMarketData) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.perp_offline,
        }),
        message: intl.formatMessage({
          id: ETranslations.perps_offline_moblie,
        }),
      });
      return;
    }

    if (isNoEnoughMargin) {
      showNoEnoughMarginToast();
      return;
    }

    // Validate TPSL prices before proceeding
    if (!(await validateTpslPrices())) {
      return;
    }

    handleShowConfirm();
  }, [
    isNoEnoughMargin,
    intl,
    shouldBlockForMarketData,
    showNoEnoughMarginToast,
    validateTpslPrices,
    handleShowConfirm,
  ]);

  // Once an address is resolved, keep the CTA in a neutral disabled state
  // until live statusInfo arrives. Cached status is not used here because
  // perpsActiveAccountStatusAtom is part of the order permission path.
  const isWaitingForLiveStatus =
    !perpsAccountStatus.details && Boolean(perpsAccount?.accountAddress);
  if (
    loading ||
    perpsAccountLoading?.selectAccountLoading ||
    isWaitingForLiveStatus
  ) {
    return (
      <Button
        {...sharedButtonProps}
        disabled
        childrenAsText={false}
        testID="perp-order-confirm-btn"
      >
        <Spinner />
      </Button>
    );
  }

  if (!perpsAccount?.accountAddress || perpsAccountStatus.accountNotSupport) {
    const canCreateAddress = perpsAccountStatus.canCreateAddress;
    if (canCreateAddress) {
      const createAddressAccount = {
        ...selectedAccount,
        deriveType: perpsAccount.deriveType,
        indexedAccountId:
          perpsAccount.indexedAccountId || selectedAccount.indexedAccountId,
        // networkId: PERPS_NETWORK_ID,
        networkId: getNetworkIdsMap().onekeyall,
      };
      return (
        <AccountSelectorCreateAddressButton
          autoCreateAddress={false}
          num={0}
          account={createAddressAccount}
          buttonRender={createAddressButtonRender}
        />
      );
    }
    return (
      <Button
        {...sharedButtonProps}
        testID={PerpTestIDs.ConnectWalletButton}
        variant="primary"
        onPress={handleConnectWallet}
      >
        {intl.formatMessage({
          id: ETranslations.global_connect_wallet,
        })}
      </Button>
    );
  }

  if (shouldShowEnableTradingButton) {
    return (
      <YStack
        gap="$3"
        h={126}
        justifyContent="flex-end"
        flex={1}
        pointerEvents="box-none"
      >
        <XStack
          gap="$3"
          p="$3"
          borderRadius="$3"
          bg="$bgSubdued"
          pointerEvents="box-none"
        >
          <SizableText size="$bodySm" color="$text" pointerEvents="box-none">
            {intl.formatMessage({
              id: ETranslations.perp_enable_trading_desc,
            })}
          </SizableText>
        </XStack>
        <Button
          {...sharedButtonProps}
          testID={PerpTestIDs.EnableTradingButton}
          variant="primary"
          loading={isAccountLoading}
          onPress={async () => {
            await enableTrading();
          }}
          childrenAsText={false}
        >
          <SizableText size="$bodyMdMedium" color="$textInverse">
            {intl.formatMessage({
              id: ETranslations.perp_trade_button_enable_trading,
            })}
          </SizableText>
        </Button>
      </YStack>
    );
  }

  return (
    <Button
      {...sharedButtonProps}
      testID={PerpTestIDs.PlaceOrderButton}
      bg={buttonStyles.bg}
      hoverStyle={
        !buttonDisabled && !isSubmitting
          ? { bg: buttonStyles.hoverBg }
          : undefined
      }
      pressStyle={
        !buttonDisabled && !isSubmitting
          ? { bg: buttonStyles.pressBg }
          : undefined
      }
      loading={perpsAccountLoading?.enableTradingLoading || isSubmitting}
      onPress={orderConfirm}
      disabled={buttonDisabled}
      childrenAsText={false}
    >
      <SizableText color={buttonStyles.textColor} size="$bodyMdMedium">
        {buttonText}
      </SizableText>
    </Button>
  );
}
