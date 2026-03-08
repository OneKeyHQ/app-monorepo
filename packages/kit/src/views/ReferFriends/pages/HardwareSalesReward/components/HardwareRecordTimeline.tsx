import { useIntl } from 'react-intl';

import type { IColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate, formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

// Define the history item type locally to ensure proper type inference
interface IHistoryItem {
  type: string;
  eventLabel: string;
  timestamp: string;
  descriptionLabel: string;
}

interface IHardwareRecordTimelineProps {
  history: IHistoryItem[];
}

type IHistoryType =
  | 'RewardDistributed'
  | 'Refunded'
  | 'RewardConfirmed'
  | 'OrderPlaced';

interface IHistoryTypeConfig {
  iconName: IKeyOfIcons;
  iconColor: IColorTokens;
}

const historyTypeConfig: Record<IHistoryType, IHistoryTypeConfig> = {
  RewardDistributed: {
    iconName: 'CheckRadioSolid',
    iconColor: '$iconSuccess',
  },
  Refunded: {
    iconName: 'XCircleSolid',
    iconColor: '$iconCaution',
  },
  RewardConfirmed: {
    iconName: 'NoteSolid',
    iconColor: '$iconInfo',
  },
  OrderPlaced: {
    iconName: 'CirclePlaceholderOnSolid',
    iconColor: '$bgCautionStrong',
  },
};

const defaultConfig: IHistoryTypeConfig = {
  iconName: 'CirclePlaceholderOnSolid',
  iconColor: '$iconSubdued',
};

function getConfig(type: string): IHistoryTypeConfig {
  return historyTypeConfig[type as IHistoryType] ?? defaultConfig;
}

export function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  const dateStr = formatDate(date, {
    hideTimeForever: true,
  });
  const timeStr = formatTime(date, {
    hideSeconds: true,
    hideMilliseconds: true,
  });
  return `${dateStr} ${timeStr}`;
}

interface ITimelineItemProps {
  historyItem: IHistoryItem;
  isFirst: boolean;
  isLast: boolean;
}

function TimelineItem({ historyItem, isFirst, isLast }: ITimelineItemProps) {
  const config = getConfig(historyItem.type);
  const formattedDateTime = formatTimestamp(historyItem.timestamp);

  return (
    <XStack gap="$3">
      <YStack ai="center" w={24}>
        <Icon name={config.iconName} size="$6" color={config.iconColor} />
        {!isLast ? (
          <Stack
            flex={1}
            w={2}
            bg="$borderSubdued"
            borderRadius="$full"
            my="$2"
            minHeight={40}
          />
        ) : null}
      </YStack>
      <YStack flex={1} gap="$2" pb={isLast ? 0 : '$10'}>
        <SizableText size={isFirst ? '$bodyLgMedium' : '$bodyLg'} color="$text">
          {historyItem.eventLabel}
        </SizableText>
        {historyItem.descriptionLabel ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {historyItem.descriptionLabel}
          </SizableText>
        ) : null}
        {formattedDateTime ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {formattedDateTime}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

export function HardwareRecordTimeline({
  history,
}: IHardwareRecordTimelineProps) {
  const intl = useIntl();

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <YStack>
      <SizableText
        size="$headingSm"
        color="$textSubdued"
        px="$5"
        py="$2"
        pt="$3"
      >
        {intl.formatMessage({
          id: ETranslations.global_history,
        })}
      </SizableText>
      <YStack px="$5" pb="$4">
        {history.map((historyItem, index) => (
          <TimelineItem
            key={`${historyItem.type}-${historyItem.timestamp}-${index}`}
            historyItem={historyItem}
            isFirst={index === 0}
            isLast={index === history.length - 1}
          />
        ))}
      </YStack>
    </YStack>
  );
}
