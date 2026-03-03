import { useIntl } from 'react-intl';

import {
  ActionList,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import { useBulkSendReviewContext } from './Context';

// eslint-disable-next-line @typescript-eslint/naming-convention
type Props = {
  feeLevel: string;
  isMultiTxs?: boolean;
  onFeeChange?: (index: number) => void;
  editFeeEnabled?: boolean;
};

function BulkSendReviewCostCard({
  feeLevel,
  isMultiTxs,
  onFeeChange,
  editFeeEnabled,
}: Props) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const { feeState } = useBulkSendReviewContext();
  const {
    feeStatus,
    totalFeeNative: networkFee,
    totalFeeFiat: networkFeeFiat,
    nativeSymbol,
    isInitialized,
    feeSelectorItems,
    selectedFee,
  } = feeState;

  // Only show loading skeleton when not initialized
  // After initialization, keep showing the current fee data during polling
  const isLoading = feeStatus === ESendFeeStatus.Loading && !isInitialized;
  const isError = feeStatus === ESendFeeStatus.Error;

  return (
    <YStack px="$5">
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
                {!isMultiTxs && (feeLevel || isError)
                  ? (() => {
                      const canEditFee =
                        !isError &&
                        editFeeEnabled &&
                        feeSelectorItems &&
                        feeSelectorItems.length > 0 &&
                        onFeeChange;

                      const triggerContent = (
                        <XStack gap="$1" alignItems="center" cursor="pointer">
                          <SizableText size="$bodyMd" color="$textSubdued">
                            {isError ? '-' : feeLevel}
                          </SizableText>
                          {canEditFee ? (
                            <Icon
                              name="ChevronGrabberVerOutline"
                              size="$4"
                              color="$iconSubdued"
                            />
                          ) : null}
                        </XStack>
                      );

                      if (canEditFee) {
                        const items: IActionListItemProps[] =
                          feeSelectorItems.map((item, index) => ({
                            label: item.label,
                            extra:
                              selectedFee.presetIndex === index ? (
                                <Icon name="CheckLargeSolid" size="$5" />
                              ) : undefined,
                            onPress: () => {
                              onFeeChange(index);
                            },
                          }));

                        return (
                          <ActionList
                            title=""
                            items={items}
                            renderTrigger={triggerContent}
                          />
                        );
                      }

                      return triggerContent;
                    })()
                  : null}
              </>
            )}
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export default BulkSendReviewCostCard;
