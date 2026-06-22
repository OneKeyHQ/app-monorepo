import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  XStack,
  useInPageDialog,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IOrderTypeDialogOption,
  showOrderTypeDialog,
} from '../modals/OrderTypeDialog';

interface IMobileOrderTypeSelectorProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: IOrderTypeDialogOption[];
  value: string;
}

function MobileOrderTypeSelector({
  disabled = false,
  options,
  value,
  onChange,
}: IMobileOrderTypeSelectorProps) {
  const intl = useIntl();
  const dialog = useInPageDialog();

  const selectedOption = options.find((option) => option.value === value);

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    showOrderTypeDialog({
      title: intl.formatMessage({
        id: ETranslations.perp_trade_order_type,
      }),
      options,
      selectedValue: value,
      onSelect: onChange,
      dialog,
    });
  }, [dialog, disabled, intl, onChange, options, value]);

  return (
    <XStack
      testID="perp-mobile-selected-order-type-select"
      onPress={handlePress}
      disabled={disabled}
      height={32}
      bg="$bgSubdued"
      borderRadius="$2"
      alignItems="center"
      justifyContent="space-between"
      px="$3"
      flex={1}
      cursor="pointer"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
    >
      <SizableText size="$bodyMdMedium">
        {selectedOption?.label ?? ''}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4" />
    </XStack>
  );
}

MobileOrderTypeSelector.displayName = 'MobileOrderTypeSelector';

export { MobileOrderTypeSelector };
