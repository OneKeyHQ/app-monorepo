import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

type IStrategyOption = {
  label: string;
  description: string;
  value: EUtxoSelectionStrategy;
};

const STRATEGY_OPTION_CONFIG: Array<{
  value: EUtxoSelectionStrategy;
  labelId: ETranslations;
  descriptionId: ETranslations;
}> = [
  {
    value: EUtxoSelectionStrategy.Default,
    labelId: ETranslations.wallet_strategy_minimize_fees,
    descriptionId: ETranslations.wallet_strategy_minimize_fees_desc,
  },
  {
    value: EUtxoSelectionStrategy.ForceSelected,
    labelId: ETranslations.wallet_strategy_merge_coins,
    descriptionId: ETranslations.wallet_strategy_merge_coins_desc,
  },
];

type ITriggerProps = {
  label: string;
  onPress?: () => void;
};

type ICoinControlStrategyPopoverProps = {
  value: EUtxoSelectionStrategy;
  onChange: (value: EUtxoSelectionStrategy) => void;
  onLearnMore?: () => void;
};

const Trigger = memo(({ label, onPress }: ITriggerProps) => (
  <XStack
    ai="center"
    cursor="pointer"
    px="$2"
    py="$1"
    mx="$-2"
    my="$-1"
    borderRadius="$2"
    hoverStyle={{ bg: '$bgHover' }}
    pressStyle={{ bg: '$bgActive' }}
    onPress={onPress}
  >
    <SizableText size="$bodyMd" fontWeight="500" color="$textSubdued">
      {label}
    </SizableText>
    <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
  </XStack>
));

Trigger.displayName = 'CoinControlStrategyTrigger';

const StrategyOption = memo(
  ({
    item,
    selected,
    onSelect,
  }: {
    item: IStrategyOption;
    selected: boolean;
    onSelect: (value: EUtxoSelectionStrategy) => void;
  }) => (
    <XStack
      key={item.value}
      px="$5"
      py="$2.5"
      gap="$3"
      minHeight={56}
      ai="center"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      borderRadius="$2"
      borderCurve="continuous"
      onPress={() => onSelect(item.value)}
    >
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyLgMedium" color="$text">
          {item.label}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {item.description}
        </SizableText>
      </YStack>
      <Stack w="$5" jc="center" ai="flex-end">
        {selected ? (
          <Icon name="CheckLargeOutline" size="$4" color="$iconActive" />
        ) : null}
      </Stack>
    </XStack>
  ),
);

StrategyOption.displayName = 'CoinControlStrategyOption';

const LearnMoreRow = memo(
  ({
    onPress,
    disabled,
    label,
  }: {
    onPress?: () => void;
    disabled?: boolean;
    label: string;
  }) => (
    <XStack
      px="$5"
      py="$2.5"
      ai="center"
      gap="$3"
      opacity={disabled ? 0.5 : 1}
      borderRadius="$2"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      hoverStyle={disabled ? undefined : { bg: '$bgHover' }}
      pressStyle={disabled ? undefined : { bg: '$bgActive' }}
      onPress={disabled ? undefined : onPress}
    >
      <XStack ai="center" gap="$2" flex={1}>
        <Stack
          w="$6"
          h="$6"
          borderRadius="$full"
          bg="$bgStrong"
          ai="center"
          jc="center"
        >
          <Icon name="QuestionmarkOutline" size="$4" color="$iconSubdued" />
        </Stack>
        <SizableText size="$bodyMd" fontWeight="500" color="$textSubdued">
          {label}
        </SizableText>
      </XStack>
      {!platformEnv.isNative ? (
        <Icon name="ArrowTopRightOutline" size="$4" color="$iconSubdued" />
      ) : null}
    </XStack>
  ),
);

LearnMoreRow.displayName = 'CoinControlStrategyLearnMoreRow';

const CoinControlStrategyPopover = ({
  value,
  onChange,
  onLearnMore,
}: ICoinControlStrategyPopoverProps) => {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const strategyOptions = useMemo<IStrategyOption[]>(
    () =>
      STRATEGY_OPTION_CONFIG.map((item) => ({
        value: item.value,
        label: intl.formatMessage({ id: item.labelId }),
        description: intl.formatMessage({ id: item.descriptionId }),
      })),
    [intl],
  );

  const selectedLabel = useMemo(() => {
    const option = strategyOptions.find((item) => item.value === value);
    return option?.label ?? strategyOptions[0]?.label ?? '';
  }, [strategyOptions, value]);

  const handleSelect = useCallback(
    (strategy: EUtxoSelectionStrategy) => {
      onChange(strategy);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleLearnMore = useCallback(() => {
    if (onLearnMore) {
      onLearnMore();
    }
  }, [onLearnMore]);

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.wallet_coin_selection_strategy,
      })}
      open={isOpen}
      onOpenChange={handleOpenChange}
      renderContent={
        <YStack py="$2" gap="$2">
          {platformEnv.isNative ? (
            <Stack px="$5">
              <Divider />
            </Stack>
          ) : null}
          <YStack gap="$0.5">
            {strategyOptions.map((item) => (
              <StrategyOption
                key={item.value}
                item={item}
                selected={item.value === value}
                onSelect={handleSelect}
              />
            ))}
          </YStack>
          <LearnMoreRow
            onPress={handleLearnMore}
            disabled={!onLearnMore}
            label={intl.formatMessage({ id: ETranslations.global_learn_more })}
          />
        </YStack>
      }
      renderTrigger={<Trigger label={selectedLabel} />}
      floatingPanelProps={{
        width: platformEnv.isNative ? '$72' : 353,
        borderRadius: '$6',
        p: 0,
      }}
    />
  );
};

CoinControlStrategyPopover.displayName = 'CoinControlStrategyPopover';

export default memo(CoinControlStrategyPopover);
