import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

type Props = {
  feeStatus: ESendFeeStatus;
  networkFee: string;
  networkFeeFiat: string;
  nativeSymbol: string;
  feeLevel: string;
  onFeeLevelPress?: () => void;
  isMultiTxs?: boolean;
  isInitialized?: boolean;
};

function BulkSendReviewCostCard({
  feeStatus,
  networkFee,
  networkFeeFiat,
  nativeSymbol,
  feeLevel,
  onFeeLevelPress,
  isMultiTxs,
  isInitialized,
}: Props) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  // Only show loading skeleton when not initialized
  // After initialization, keep showing the current fee data during polling
  const isLoading = feeStatus === ESendFeeStatus.Loading && !isInitialized;
  const isError = feeStatus === ESendFeeStatus.Error;

  return (
    <YStack px="$5" py="$3">
      <YStack bg="$bgSubdued" borderRadius="$3" py="$2">
        {/* Network Fee Row */}
        <XStack gap="$2" px="$4" py="$2" alignItems="flex-start">
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.swap_history_detail_network_fee,
            })}
          </SizableText>
          <YStack alignItems="flex-end">
            {isLoading ? (
              <Skeleton.BodyMd />
            ) : (
              <>
                <XStack gap="$1" alignItems="baseline">
                  {isError ? (
                    <SizableText size="$bodyMdMedium">-</SizableText>
                  ) : (
                    <>
                      <NumberSizeableText
                        size="$bodyMdMedium"
                        formatter="balance"
                        formatterOptions={{ tokenSymbol: nativeSymbol }}
                      >
                        {networkFee}
                      </NumberSizeableText>
                      <SizableText size="$bodyMdMedium">
                        (
                        <NumberSizeableText
                          size="$bodyMdMedium"
                          formatter="value"
                          formatterOptions={{
                            currency: settings.currencyInfo.symbol,
                            showPlusMinusSigns: false,
                          }}
                        >
                          {networkFeeFiat}
                        </NumberSizeableText>
                        )
                      </SizableText>
                    </>
                  )}
                </XStack>
                {/* Fee Level - Only show for single tx */}
                {!isMultiTxs && (feeLevel || isError) ? (
                  <XStack
                    gap="$1"
                    alignItems="center"
                    onPress={isError ? undefined : onFeeLevelPress}
                    cursor={!isError && onFeeLevelPress ? 'pointer' : undefined}
                  >
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {isError ? '-' : feeLevel}
                    </SizableText>
                    {!isError && onFeeLevelPress ? (
                      <Icon
                        name="ChevronGrabberVerOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    ) : null}
                  </XStack>
                ) : null}
              </>
            )}
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export default BulkSendReviewCostCard;
