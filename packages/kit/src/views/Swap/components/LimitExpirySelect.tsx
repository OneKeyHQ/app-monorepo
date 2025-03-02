import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapLimitExpirySelectItem extends ISelectItem {
  value: string;
}

interface ISwapLimitExpirySelectProps {
  onSelectExpiryValue: (value: ISwapLimitExpirySelectItem) => void;
  currentSelectExpiryValue?: ISwapLimitExpirySelectItem;
  selectItems: ISwapLimitExpirySelectItem[];
}
const SwapLimitExpirySelect = ({
  onSelectExpiryValue,
  currentSelectExpiryValue,
  selectItems,
}: ISwapLimitExpirySelectProps) => {
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
          {currentSelectExpiryValue?.label
            ? currentSelectExpiryValue.label
            : `7 ${intl.formatMessage({
                id: ETranslations.Limit_expire_days,
              })}`}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    ),
    [currentSelectExpiryValue?.label, intl],
  );
  return (
    <XStack justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
        {intl.formatMessage({ id: ETranslations.Limit_info_order_expires })}
      </SizableText>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentSelectExpiryValue?.value}
        onChange={(value) => {
          const selectedItem = selectItems.find((item) => item.value === value);
          if (selectedItem) {
            onSelectExpiryValue(selectedItem);
          }
        }}
        title={intl.formatMessage({
          id: ETranslations.Limit_info_order_expires,
        })}
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapLimitExpirySelect);
