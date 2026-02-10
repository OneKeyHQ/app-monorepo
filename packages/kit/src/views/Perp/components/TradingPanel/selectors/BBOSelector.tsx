import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import type { IBBOPriceMode } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IBBOSelectorProps {
  value: IBBOPriceMode;
  onChange: (mode: IBBOPriceMode) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const BBO_LEVEL = 1; // Currently only Level 1 (native BBO) is supported

export const BBOSelector = memo<IBBOSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false, isMobile = false }) => {
    const intl = useIntl();

    const bboOptions = useMemo(
      (): ISelectItem[] => [
        {
          label: intl.formatMessage({
            id: ETranslations.Perps_BBO_Counterparty,
          }),
          value: `counterparty-${BBO_LEVEL}`,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.Perps_BBO_Queue,
          }),
          value: `queue-${BBO_LEVEL}`,
        },
      ],
      [intl],
    );

    const parseBBOPriceMode = useCallback((val: string): IBBOPriceMode => {
      const parts = val.split('-');
      if (parts.length !== 2) {
        throw new OneKeyLocalError({
          message: `[BBOSelector] Invalid BBO mode format: ${val}`,
        });
      }
      const [type, levelStr] = parts;
      const level = parseInt(levelStr, 10);
      if (
        (type !== 'counterparty' && type !== 'queue') ||
        Number.isNaN(level) ||
        level <= 0
      ) {
        throw new OneKeyLocalError({
          message: `[BBOSelector] Invalid BBO mode: type=${type}, level=${level}`,
        });
      }
      return { type, level } as IBBOPriceMode;
    }, []);

    const serializeBBOPriceMode = useCallback(
      (mode: IBBOPriceMode): string | undefined => {
        if (!mode) return undefined;
        return `${mode.type}-${mode.level}`;
      },
      [],
    );

    const handleChange = useCallback(
      (val: string | undefined) => {
        if (!val) {
          onChange(null);
          return;
        }
        const mode = parseBBOPriceMode(val);
        onChange(mode);
      },
      [onChange, parseBBOPriceMode],
    );

    const currentValue = serializeBBOPriceMode(value);

    if (isMobile) {
      return (
        <YStack
          bg="$bgSubdued"
          borderRadius="$2"
          borderWidth="$px"
          borderColor="$transparent"
          px="$3"
          gap="$3"
        >
          <Select
            items={bboOptions}
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
            title={intl.formatMessage({
              id: ETranslations.Perps_BBO_select_title,
            })}
            renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
              <XStack
                onPress={onPress}
                disabled={disabledTrigger}
                h={36}
                alignItems="center"
                justifyContent="space-between"
                cursor="default"
              >
                <SizableText size="$bodyMd" color="$text">
                  {label}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  color="$iconSubdued"
                  size="$4"
                />
              </XStack>
            )}
            placement="bottom-end"
            floatingPanelProps={{
              width: 160,
            }}
          />
        </YStack>
      );
    }

    return (
      <Select
        items={bboOptions}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        title={intl.formatMessage({
          id: ETranslations.Perps_BBO_select_title,
        })}
        renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
          <YStack
            bg="$bgSubdued"
            borderRadius="$3"
            py="$1"
            pl="$1"
            borderWidth="$px"
            borderColor="$transparent"
            onPress={onPress}
            disabled={disabledTrigger}
            cursor="default"
            hoverStyle={{
              borderColor: '$border',
            }}
          >
            <XStack
              h={32}
              alignItems="center"
              justifyContent="space-between"
              px="$2"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_orderbook_price,
                })}
              </SizableText>
              <XStack alignItems="center" gap="$1" justifyContent="flex-end">
                <SizableText size="$bodyMdMedium" color="$text">
                  {label}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  color="$iconSubdued"
                  size="$4"
                />
              </XStack>
            </XStack>
          </YStack>
        )}
        placement="bottom-end"
        floatingPanelProps={{
          width: 160,
        }}
      />
    );
  },
);

BBOSelector.displayName = 'BBOSelector';
