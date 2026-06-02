import { memo, useCallback, useMemo, useState } from 'react';

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
  const titleSize = isMobile ? '$bodyMdMedium' : '$bodySmMedium';
  const contentSize = isMobile ? '$bodyMd' : '$bodySm';

  return (
    <YStack gap={isMobile ? '$3' : '$2'}>
      <SizableText size={titleSize}>Time In Force</SizableText>
      <SizableText size={contentSize}>
        GTC (Good Til Cancel): Order will rest until filled or canceled.
      </SizableText>
      <SizableText size={contentSize}>
        IOC (Immediate Or Cancel): Any portion that is not immediately filled
        will be canceled.
      </SizableText>
      <SizableText size={contentSize}>
        ALO (Add Liquidity Only): Order will exist only as a limit order on the
        book. Also known as post-only.
      </SizableText>
    </YStack>
  );
}

const TimeInForceSelector = memo<ITimeInForceSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false, isMobile = false, testID }) => {
    const [isOpen, setIsOpen] = useState(false);
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
      <XStack alignItems="center" pt="$0.5">
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
        title="Time In Force"
        placement="top-end"
        renderTrigger={labelTrigger}
        renderContent={
          <YStack px="$5" pt="$2" pb="$4">
            <TifHelpContent isMobile={isMobile} />
          </YStack>
        }
      />
    ) : (
      <Tooltip
        placement="top-end"
        renderTrigger={labelTrigger}
        renderContent={<TifHelpContent isMobile={isMobile} />}
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
        title="Time In Force"
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
                size={isMobile ? '$bodyMd' : '$bodyMdMedium'}
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
