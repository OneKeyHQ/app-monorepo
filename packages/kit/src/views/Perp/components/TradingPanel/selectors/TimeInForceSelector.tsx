import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Heading,
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { TIF_OPTIONS } from '../../../utils/timeInForce';

interface ITimeInForceSelectorProps {
  value: ITIF;
  onChange: (value: ITIF) => void;
  disabled?: boolean;
  isMobile?: boolean;
  testID?: string;
}

function getTifDescriptionTranslationId(value: ITIF) {
  switch (value) {
    case 'Gtc':
      return ETranslations.perp_time_in_force_gtc__desc;
    case 'Ioc':
      return ETranslations.perp_time_in_force_ioc__desc;
    case 'Alo':
      return ETranslations.perp_time_in_force_alo__desc;
    default:
      return ETranslations.perp_time_in_force_gtc__desc;
  }
}

const TimeInForceSelector = memo<ITimeInForceSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false, isMobile = false, testID }) => {
    const intl = useIntl();
    const [isOpen, setIsOpen] = useState(false);
    const title = intl.formatMessage({
      id: ETranslations.perp_time_in_force__title,
    });
    const items = useMemo(
      () =>
        TIF_OPTIONS.map((option) => ({
          description: intl.formatMessage({
            id: getTifDescriptionTranslationId(option.value),
          }),
          label: option.label,
          value: option.value,
        })),
      [intl],
    );
    const selectedItem = useMemo(
      () => items.find((item) => item.value === value),
      [items, value],
    );

    const handleChange = useCallback(
      (nextValue: ITIF) => {
        if (disabled) {
          return;
        }
        onChange(nextValue);
        setIsOpen(false);
      },
      [disabled, onChange],
    );

    return (
      <Popover
        title={title}
        open={disabled ? false : isOpen}
        onOpenChange={(nextOpen) => {
          if (disabled) {
            return;
          }
          setIsOpen(nextOpen);
        }}
        placement="bottom-end"
        floatingPanelProps={{
          width: isMobile ? 260 : 360,
        }}
        renderTrigger={
          <Button
            testID={testID}
            size="small"
            variant="tertiary"
            childrenAsText={false}
            disabled={disabled}
            alignItems="center"
            justifyContent="flex-end"
            gap="$2"
            p="$0"
            m="$0"
            bg="transparent"
            cursor={disabled ? 'default' : 'pointer'}
            hoverStyle={{ bg: 'transparent' }}
            pressStyle={{ bg: 'transparent' }}
            onPress={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
          >
            <SizableText
              size={isMobile ? '$bodySm' : '$bodyMd'}
              color="$textSubdued"
            >
              TIF
            </SizableText>
            <XStack alignItems="center" gap="$1" opacity={disabled ? 0.5 : 1}>
              <SizableText
                size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                color="$text"
              >
                {selectedItem?.label ?? value.toUpperCase()}
              </SizableText>
              <Icon
                name={
                  isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
                }
                color="$iconSubdued"
                size="$4"
              />
            </XStack>
          </Button>
        }
        renderContent={({ closePopover }) => (
          <YStack px="$2" pb="$2">
            {isMobile ? null : (
              <SizableText px="$3" pt="$3" pb="$1" size="$bodyMdMedium">
                {title}
              </SizableText>
            )}
            {items.map((item) => (
              <YStack key={item.value}>
                <Button
                  testID={testID ? `${testID}-option-${item.value}` : undefined}
                  variant="tertiary"
                  childrenAsText={false}
                  justifyContent="flex-start"
                  alignItems="stretch"
                  px="$3"
                  py="$2"
                  m="$0"
                  h="auto"
                  minHeight={isMobile ? 64 : 72}
                  borderRadius="$2"
                  onPress={() => {
                    if (disabled) {
                      return;
                    }
                    handleChange(item.value);
                    void closePopover();
                  }}
                  pressStyle={{ opacity: 0.7 }}
                  hoverStyle={{ bg: '$bgHover' }}
                >
                  <XStack width="100%" alignItems="center" gap="$3">
                    <YStack flex={1} minWidth={0} alignItems="flex-start">
                      <Heading
                        size="$headingSm"
                        lineHeight={20}
                        color="$text"
                        textAlign="left"
                      >
                        {item.label}
                      </Heading>
                      <SizableText
                        mt="$0.5"
                        size={isMobile ? '$bodyXs' : '$bodySm'}
                        fontSize={isMobile ? 12 : undefined}
                        lineHeight={isMobile ? 18 : undefined}
                        color="$textSubdued"
                        flexShrink={1}
                        textAlign="left"
                      >
                        {item.description}
                      </SizableText>
                    </YStack>
                    <YStack
                      width={isMobile ? 28 : 20}
                      alignItems="center"
                      justifyContent="center"
                      alignSelf="stretch"
                      flexShrink={0}
                    >
                      {item.value === value ? (
                        <Icon
                          name="CheckRadioSolid"
                          size="$5"
                          color="$iconActive"
                        />
                      ) : null}
                    </YStack>
                  </XStack>
                </Button>
              </YStack>
            ))}
          </YStack>
        )}
      />
    );
  },
);

TimeInForceSelector.displayName = 'TimeInForceSelector';

export { TimeInForceSelector };
