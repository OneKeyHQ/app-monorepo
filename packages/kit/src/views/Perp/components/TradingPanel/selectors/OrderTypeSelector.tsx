import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IOrderTypeSelectorProps {
  value: 'market' | 'limit';
  onChange: (value: 'market' | 'limit') => void;
  disabled?: boolean;
  isMobile?: boolean;
}

export const OrderTypeSelector = memo<IOrderTypeSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false, isMobile = false }) => {
    const intl = useIntl();
    const orderTypeOptions = useMemo(
      (): ISelectItem[] => [
        {
          label: intl.formatMessage({
            id: ETranslations.perp_trade_market,
          }),
          value: 'market',
        },
        {
          label: intl.formatMessage({
            id: ETranslations.perp_trade_limit,
          }),
          value: 'limit',
        },
      ],
      [intl],
    );
    return (
      <Select
        items={orderTypeOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        title={intl.formatMessage({
          id: ETranslations.perp_trade_order_type,
        })}
        renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
          <XStack
            cursor="pointer"
            onPress={onPress}
            disabled={disabledTrigger}
            height={isMobile ? 32 : 30}
            bg="$bgSubdued"
            borderRadius="$2"
            alignItems="center"
            justifyContent="space-between"
            px="$3"
            flex={1}
          >
            <SizableText size="$bodyMdMedium">{label}</SizableText>
            <Icon
              name="ChevronTriangleDownSmallOutline"
              color="$icon"
              size="$5"
            />
          </XStack>
        )}
        placement="bottom-start"
        floatingPanelProps={{
          width: 120,
        }}
      />
    );
  },
);

OrderTypeSelector.displayName = 'OrderTypeSelector';
