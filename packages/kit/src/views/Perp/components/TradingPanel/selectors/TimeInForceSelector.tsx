import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Icon,
  Popover,
  Select,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { TIF_OPTIONS, isTifValue } from '../../../utils/timeInForce';

interface ITimeInForceSelectorProps {
  value: ITIF;
  onChange: (value: ITIF) => void;
  disabled?: boolean;
  isMobile?: boolean;
  testID?: string;
}

function TifHelpContent({ isMobile }: { isMobile: boolean }) {
  const intl = useIntl();
  const titleSize = isMobile ? '$bodyMdMedium' : '$bodySmMedium';
  const contentSize = isMobile ? '$bodyMd' : '$bodySm';

  return (
    <YStack width="100%" gap={isMobile ? '$3' : '$2'}>
      <SizableText size={titleSize}>
        {intl.formatMessage({ id: ETranslations.perp_time_in_force__title })}
      </SizableText>
      <SizableText size={contentSize}>
        {intl.formatMessage({
          id: ETranslations.perp_time_in_force_gtc__desc,
        })}
      </SizableText>
      <SizableText size={contentSize}>
        {intl.formatMessage({
          id: ETranslations.perp_time_in_force_ioc__desc,
        })}
      </SizableText>
      <SizableText size={contentSize}>
        {intl.formatMessage({
          id: ETranslations.perp_time_in_force_alo__desc,
        })}
      </SizableText>
    </YStack>
  );
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
      (): ISelectItem[] =>
        TIF_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      [],
    );

    const handleChange = useCallback(
      (nextValue: string | number | boolean | undefined) => {
        if (typeof nextValue !== 'string') {
          return;
        }
        if (isTifValue(nextValue)) {
          onChange(nextValue);
        }
      },
      [onChange],
    );

    const labelTrigger = (
      <XStack alignItems="center">
        <DashText
          size={isMobile ? '$bodySm' : '$bodyMd'}
          color="$textSubdued"
          dashColor="$textDisabled"
          dashSpacing={0}
          dashThickness={0.5}
          cursor={isMobile ? 'default' : 'help'}
        >
          TIF
        </DashText>
      </XStack>
    );

    const helpTrigger = isMobile ? (
      <Popover
        title={title}
        placement="bottom-end"
        renderTrigger={labelTrigger}
        renderContent={
          <YStack width="100%" px="$5" pt="$2" pb="$4">
            <TifHelpContent isMobile={isMobile} />
          </YStack>
        }
      />
    ) : (
      <Tooltip
        placement="bottom-end"
        contentProps={{
          width: 320,
          maxWidth: 320,
        }}
        renderTrigger={labelTrigger}
        renderContent={
          <YStack width="100%">
            <TifHelpContent isMobile={isMobile} />
          </YStack>
        }
      />
    );

    return (
      <Select
        testID={testID}
        items={items}
        value={value}
        onChange={handleChange}
        onOpenChange={setIsOpen}
        disabled={disabled}
        title={title}
        placement="bottom-end"
        floatingPanelProps={{
          width: 88,
        }}
        renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
          <XStack alignItems="center" justifyContent="flex-end" gap="$2">
            {helpTrigger}
            <XStack
              alignItems="center"
              gap="$1"
              onPress={onPress}
              disabled={disabledTrigger}
              cursor={disabledTrigger ? 'default' : 'pointer'}
              opacity={disabledTrigger ? 0.5 : 1}
              hoverStyle={
                disabledTrigger
                  ? undefined
                  : {
                      opacity: 0.8,
                    }
              }
              pressStyle={
                disabledTrigger
                  ? undefined
                  : {
                      opacity: 0.7,
                    }
              }
            >
              <SizableText
                size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                color="$text"
              >
                {label}
              </SizableText>
              <Icon
                name={
                  isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
                }
                color="$iconSubdued"
                size="$4"
              />
            </XStack>
          </XStack>
        )}
      />
    );
  },
);

TimeInForceSelector.displayName = 'TimeInForceSelector';

export { TimeInForceSelector };
