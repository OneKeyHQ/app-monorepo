import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, Spinner, XStack } from '@onekeyhq/components';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAccountLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpUseChainAccount } from '../../hooks/usePerpUseChainAccount';

import type { WsWebData2 } from '@nktkas/hyperliquid';

export function PerpTradingButton({
  userWebData2,
  loading,
  canTrade,
  checkAndApproveWallet,
  handleShowConfirm,
  formData,
  isSubmitting,
  isNoEnoughMargin,
}: {
  userWebData2: WsWebData2 | undefined;
  loading: boolean;
  canTrade: boolean;
  checkAndApproveWallet: () => void;
  handleShowConfirm: () => void;
  formData: ITradingFormData;
  isSubmitting: boolean;
  isNoEnoughMargin: boolean;
}) {
  const intl = useIntl();
  const { userAddress } = usePerpUseChainAccount();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [perpsAccountLoading] = usePerpsAccountLoadingAtom();

  const buttonDisabled = useMemo(() => {
    return (
      !(Number(formData.size) > 0) ||
      !canTrade ||
      isSubmitting ||
      isNoEnoughMargin
    );
  }, [canTrade, isSubmitting, isNoEnoughMargin, formData.size]);

  const buttonText = useMemo(() => {
    if (isSubmitting) return 'Placing...';
    if (isNoEnoughMargin) return 'Not Enough Margin';
    return 'Place order';
  }, [isSubmitting, isNoEnoughMargin]);

  const buttonStyles = useMemo(() => {
    const isLong = formData.side === 'long';

    const getBgColor = () => {
      return isLong ? '$buttonSuccess' : '$buttonCritical';
    };

    const getHoverBgColor = () => {
      return isLong ? '$green7' : '$red7';
    };

    const getPressBgColor = () => {
      return isLong ? '$green9' : '$red9';
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
      textColor: buttonDisabled ? '$textDisabled' : '$textOnColor',
    };
  }, [formData.side, buttonDisabled]);

  const createAddressButtonRender = useCallback((props: IButtonProps) => {
    return <Button size="large" borderRadius="$3" {...props} />;
  }, []);

  if (loading || perpsAccountLoading || !userWebData2) {
    return (
      <Button size="large" borderRadius="$3" disabled>
        <Spinner />
      </Button>
    );
  }

  if (!canTrade || !userAddress) {
    if (!userAddress) {
      if (activeAccount.canCreateAddress) {
        return (
          <AccountSelectorCreateAddressButton
            autoCreateAddress={false}
            num={0}
            account={selectedAccount}
            buttonRender={createAddressButtonRender}
          />
        );
      }
      return (
        <XStack>
          <SizableText size="$bodyMd" color="$textCaution">
            {intl.formatMessage({
              id: ETranslations.global_network_not_matched,
            })}{' '}
            or Account not supported
          </SizableText>
        </XStack>
      );
    }
    return (
      <Button
        size="large"
        borderRadius="$3"
        onPress={() => {
          void checkAndApproveWallet();
        }}
      >
        <SizableText>Enable trading</SizableText>
      </Button>
    );
  }

  return (
    <Button
      bg={buttonStyles.bg}
      hoverStyle={{ bg: buttonStyles.hoverBg }}
      pressStyle={{ bg: buttonStyles.pressBg }}
      onPress={() => {
        if (!canTrade) {
          void checkAndApproveWallet();
        } else {
          handleShowConfirm();
        }
      }}
      disabled={buttonDisabled}
      size="medium"
      borderRadius="$3"
    >
      <SizableText
        color={buttonStyles.textColor}
        fontWeight="600"
        size="$bodyLgMedium"
      >
        {buttonText}
      </SizableText>
    </Button>
  );
}
