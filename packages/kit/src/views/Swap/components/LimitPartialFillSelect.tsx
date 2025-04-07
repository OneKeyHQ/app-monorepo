import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapLimitPartialFillSelectItem extends ISelectItem {
  value: boolean;
}

interface ISwapLimitPartialFillSelectProps {
  onSelectPartiallyFillValue: (value: ISwapLimitPartialFillSelectItem) => void;
  currentSelectPartiallyFillValue?: ISwapLimitPartialFillSelectItem;
  selectItems: ISwapLimitPartialFillSelectItem[];
}
const SwapLimitPartialFillSelect = ({
  onSelectPartiallyFillValue,
  currentSelectPartiallyFillValue,
  selectItems,
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
        <SizableText size="$bodyMdMedium">
          {currentSelectPartiallyFillValue?.label
            ? currentSelectPartiallyFillValue?.label
            : intl.formatMessage({
                id: ETranslations.Limit_info_partial_fill_enable,
              })}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    ),
    [currentSelectPartiallyFillValue?.label, intl],
  );
  return (
    <XStack justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
        {intl.formatMessage({ id: ETranslations.Limit_info_partial_fill })}
      </SizableText>
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
