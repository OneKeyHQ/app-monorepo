import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Icon,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { SwapPercentageInputStage } from '@onekeyhq/shared/types/swap/types';

import ActionBuy from '../../../AssetDetails/pages/TokenDetails/ActionBuy';
import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';

const SwapInputActions = ({
  showPercentageInput,
  showActionBuy,
  onSelectStage,
  stagePopoverContent,
  fromToken,
  accountInfo,
}: {
  showPercentageInput: boolean;
  showActionBuy: boolean;
  stagePopoverContent?: React.ReactNode;
  onSelectStage?: (stage: number) => void;
  fromToken?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
}) => {
  const intl = useIntl();
  const { gtSm } = useMedia();
  const needSwapPercentageInputStage = useMemo(
    () => (gtSm ? SwapPercentageInputStage : SwapPercentageInputStage.slice(1)),
    [gtSm],
  );
  return (
    <XStack gap="$0.5">
      <AnimatePresence>
        {showActionBuy ? (
          <XStack
            animation="quick"
            enterStyle={{
              opacity: 0,
            }}
            exitStyle={{
              opacity: 0,
            }}
          >
            <ActionBuy
              hiddenIfDisabled
              showButtonStyle
              height="$5"
              px="$1.5"
              py="$0"
              pt={platformEnv.isNativeIOS ? '$1' : '$0'}
              bg="$bgSubdued"
              size="small"
              childrenAsText={false}
              label={
                <XStack ai="center" jc="center" gap="$1">
                  <Icon
                    name="CreditCardCvvOutline"
                    size="$4"
                    mt={platformEnv.isNative ? 2 : undefined}
                  />
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {intl.formatMessage({ id: ETranslations.global_buy })}
                  </SizableText>
                </XStack>
              }
              networkId={fromToken?.networkId ?? ''}
              accountId={accountInfo?.account?.id ?? ''}
              walletId={accountInfo?.wallet?.id ?? ''}
              walletType={accountInfo?.wallet?.type ?? ''}
              tokenAddress={fromToken?.contractAddress ?? ''}
              tokenSymbol={fromToken?.symbol ?? ''}
              source="swap"
            />
          </XStack>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {!platformEnv.isNative && showPercentageInput ? (
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
            gap="$0.5"
          >
            <>
              {needSwapPercentageInputStage.map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  onSelectStage={onSelectStage}
                  popoverContent={
                    stage === 100 ? stagePopoverContent : undefined
                  }
                />
              ))}
            </>
          </XStack>
        ) : null}
      </AnimatePresence>
    </XStack>
  );
};

export default SwapInputActions;
