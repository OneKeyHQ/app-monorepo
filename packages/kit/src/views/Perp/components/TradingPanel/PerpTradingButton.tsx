import { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, Spinner, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  perpsActiveAssetCtxAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsCommonConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PERP_TRADE_BUTTON_COLORS } from '../../utils/styleUtils';

import { showDepositWithdrawModal } from './modals/DepositWithdrawModal';

const sharedButtonProps = {
  size: 'medium',
  borderRadius: '$3',
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
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const themeVariant = useThemeVariant();
  const isAccountLoading = useMemo<boolean>(() => {
    return (
      perpsAccountLoading.enableTradingLoading ||
      perpsAccountLoading.selectAccountLoading
    );
  }, [
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.selectAccountLoading,
  ]);

  const enableTrading = useCallback(async () => {
    const status = await backgroundApiProxy.serviceHyperliquid.enableTrading();
    if (
      status?.details?.activatedOk === false &&
      perpsAccount.accountAddress &&
      perpsAccount.accountId
    ) {
      await showDepositWithdrawModal({
        withdrawable: '0',
        actionType: 'deposit',
      });
    }
  }, [perpsAccount.accountAddress, perpsAccount.accountId]);

  const buttonDisabled = useMemo(() => {
    return (
      !computedSize.gt(0) ||
      !perpsAccountStatus.canTrade ||
      isSubmitting ||
      isNoEnoughMargin ||
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
    isNoEnoughMargin,
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
    if (isNoEnoughMargin)
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_no_enough_margin,
      });
    if (isMinimumOrderNotMet) return 'Order must be at least $10'; // TODO: I18n
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_place_order,
    });
  }, [isSubmitting, isNoEnoughMargin, isMinimumOrderNotMet, intl]);

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
    return <Button {...sharedButtonProps} {...props} />;
  }, []);

  const getTpslErrorMessage = useCallback(
    (type: 'TP' | 'SL', direction: 'higher' | 'lower') => ({
      title: `${type} price must be ${direction} than current price. To close position immediately, use the position table or order form.`,
    }),
    [],
  );

  const validateTpslPrices = useCallback(async () => {
    if (!formData.hasTpsl || !formData.price) return true;

    const activeAssetCtx = await perpsActiveAssetCtxAtom.get();
    const entryPrice = new BigNumber(
      formData.type === 'limit'
        ? formData.price
        : activeAssetCtx?.ctx?.markPrice || '0',
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
    isLong,
    getTpslErrorMessage,
  ]);

  const orderConfirm = useCallback(async () => {
    // Validate TPSL prices before proceeding
    if (!(await validateTpslPrices())) {
      return;
    }

    handleShowConfirm();
  }, [validateTpslPrices, handleShowConfirm]);

  if (loading || perpsAccountLoading?.selectAccountLoading) {
    return (
      <Button {...sharedButtonProps} disabled>
        <Spinner />
      </Button>
    );
  }

  if (!perpsAccount?.accountAddress) {
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
      <Button {...sharedButtonProps} disabled>
        {intl.formatMessage({
          id: ETranslations.perp_trade_button_account_unsupported,
        })}
      </Button>
    );
  }

  if (
    isAccountLoading ||
    !perpsAccountStatus.canTrade ||
    !perpsAccount?.accountAddress
  ) {
    return (
      <Button
        size="medium"
        borderRadius="$3"
        variant="primary"
        loading={isAccountLoading}
        onPress={async () => {
          await enableTrading();
        }}
        childrenAsText
      >
        <SizableText size="$bodyMdMedium" color="$textInverse">
          {intl.formatMessage({
            id: ETranslations.perp_trade_button_enable_trading,
          })}
        </SizableText>
      </Button>
    );
  }

  return (
    <Button
      {...sharedButtonProps}
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
    >
      <SizableText color={buttonStyles.textColor} size="$bodyMdMedium">
        {buttonText}
      </SizableText>
    </Button>
  );
}
