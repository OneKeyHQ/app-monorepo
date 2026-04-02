import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type { SizableTextProps } from '@onekeyhq/components/src/shared/tamagui';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapLimitPartialFillSelectItem extends ISelectItem {
  value: boolean;
}

interface ISwapLimitPartialFillSelectProps {
  onSelectPartiallyFillValue: (value: ISwapLimitPartialFillSelectItem) => void;
  currentSelectPartiallyFillValue?: ISwapLimitPartialFillSelectItem;
  selectItems: ISwapLimitPartialFillSelectItem[];
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  titleProps?: SizableTextProps;
  valueProps?: SizableTextProps;
}
const SwapLimitPartialFillSelect = ({
  onSelectPartiallyFillValue,
  currentSelectPartiallyFillValue,
  selectItems,
  leftIcon,
  rightIcon,
  titleProps,
  valueProps,
}: ISwapLimitPartialFillSelectProps) => {
  const intl = useIntl();
  const renderTrigger = useCallback(
    () => (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
      >
        <SizableText size="$bodyMdMedium" {...valueProps}>
          {currentSelectPartiallyFillValue?.label
            ? currentSelectPartiallyFillValue?.label
            : intl.formatMessage({
                id: ETranslations.Limit_info_partial_fill_enable,
              })}
        </SizableText>
        {rightIcon || (
          <Icon
            size="$5"
            color="$iconSubdued"
            name="ChevronRightSmallOutline"
            mr="$-1"
          />
        )}
      </XStack>
    ),
    [currentSelectPartiallyFillValue?.label, intl, rightIcon, valueProps],
  );
  return (
    <XStack justifyContent="space-between" py="$1">
      <XStack gap="$1">
        {leftIcon || null}
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          userSelect="none"
          {...titleProps}
        >
          {intl.formatMessage({ id: ETranslations.Limit_info_partial_fill })}
        </SizableText>
      </XStack>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentSelectPartiallyFillValue?.value}
        onChange={(value) => {
          const selectedItem = selectItems.find((item) => item.value === value);
          if (selectedItem) {
            onSelectPartiallyFillValue(selectedItem);
          }
        }}
        title={intl.formatMessage({
          id: ETranslations.Limit_info_partial_fill,
        })}
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapLimitPartialFillSelect);
