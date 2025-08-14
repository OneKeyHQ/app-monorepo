import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  Popover,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapApproveAllowanceSelectProps {
  onSelectAllowanceValue: (value: string) => void;
  onSelectOpenChange?: (open: boolean) => void;
  currentSelectAllowanceValue?: ISelectItem;
  selectItems: ISelectItem[];
  isLoading?: boolean;
}
const SwapApproveAllowanceSelect = ({
  onSelectAllowanceValue,
  currentSelectAllowanceValue,
  selectItems,
  onSelectOpenChange,
  isLoading,
}: ISwapApproveAllowanceSelectProps) => {
  const intl = useIntl();
  const renderTrigger = useCallback(() => {
    if (isLoading)
      return (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      );

    return (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
      >
        <SizableText size="$bodyMdMedium">
          {currentSelectAllowanceValue?.label}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    );
  }, [currentSelectAllowanceValue?.label, isLoading]);
  return (
    <XStack justifyContent="space-between">
      <XStack alignItems="center" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_amount,
          })}
        </SizableText>
        <Popover
          title={intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_amount,
          })}
          renderTrigger={
            <Icon
              name="InfoCircleOutline"
              size="$3.5"
              cursor="pointer"
              color="$iconSubdued"
            />
          }
          renderContent={
            <SizableText
              p="$4"
              $gtMd={{
                size: '$bodyMd',
              }}
            >
              {intl.formatMessage({
                id: ETranslations.swap_page_swap_steps_1_approve_dialog,
              })}
            </SizableText>
          }
        />
      </XStack>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentSelectAllowanceValue?.value}
        onChange={(value) => {
          onSelectAllowanceValue(value as string);
        }}
        onOpenChange={onSelectOpenChange}
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_amount,
        })}
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapApproveAllowanceSelect);
