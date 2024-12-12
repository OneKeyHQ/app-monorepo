import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { SwapPercentageInputStage } from '@onekeyhq/shared/types/swap/types';

import ActionBuy from '../../../AssetDetails/pages/TokenDetails/ActionBuy';

const SwapInputActions = ({
  showPercentageInput,
  showActionBuy,
  onSelectStage,
  fromToken,
  accountInfo,
}: {
  showPercentageInput: boolean;
  showActionBuy: boolean;
  onSelectStage?: (stage: number) => void;
  fromToken?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
}) => {
  const intl = useIntl();
  return (
    <AnimatePresence>
      <XStack
        animation="quick"
        enterStyle={{
          opacity: 0,
          x: 8,
        }}
        exitStyle={{
          opacity: 0,
          x: 4,
        }}
        gap="$1"
      >
        {showActionBuy ? (
          <ActionBuy
            hiddenIfDisabled
            showButtonStyle
            height="$5"
            px="$1.5"
            py="$0"
            bg="$bgSubdued"
            size="small"
            label={
              <XStack
                alignItems="center"
                gap="$1"
                pt={platformEnv.isNativeIOS ? '$1' : '$0'}
              >
                <Icon name="CreditCardCvvOutline" size="$4" />
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_buy })}
                </SizableText>
              </XStack>
            }
            networkId={fromToken?.networkId ?? ''}
            accountId={accountInfo?.account?.id ?? ''}
            walletType={accountInfo?.wallet?.type ?? ''}
            tokenAddress={fromToken?.contractAddress ?? ''}
          />
        ) : null}
        {showPercentageInput ? (
          <>
            {SwapPercentageInputStage.map((stage) => (
              <Button
                height="$5"
                key={`swap-percentage-input-stage-${stage}`}
                size="small"
                onPress={() => {
                  onSelectStage?.(stage);
                }}
                bg="$bgSubdued"
                px="$1.5"
                py="$0"
              >
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {stage}%
                </SizableText>
              </Button>
            ))}
          </>
        ) : null}
      </XStack>
    </AnimatePresence>
  );
};

export default SwapInputActions;
