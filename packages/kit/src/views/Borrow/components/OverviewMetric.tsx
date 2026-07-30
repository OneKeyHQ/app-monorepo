import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

export type IOverviewMetricProps = {
  title: IEarnText;
  text?: IEarnText;
  action?: React.ReactNode;
  tooltip?: React.ReactNode;
  isLoading?: boolean;
  onPress?: () => void;
  testID?: string;
  valueLayout?: 'inline' | 'stacked';
  widthMode?: 'columns' | 'hug';
};

export function OverviewMetric({
  title,
  text,
  action,
  tooltip,
  isLoading,
  onPress,
  testID,
  valueLayout = 'inline',
  widthMode = 'columns',
}: IOverviewMetricProps) {
  const valueContent = isLoading ? (
    <Skeleton w={72} h="$6" borderRadius="$1" />
  ) : (
    <>
      {text ? (
        <EarnText
          text={text}
          size="$bodyLgMedium"
          color="$text"
          flexShrink={1}
          numberOfLines={1}
        />
      ) : null}
      {action}
    </>
  );

  return (
    <YStack
      testID={testID}
      p="$3"
      flexBasis={widthMode === 'hug' ? 'auto' : '50%'}
      $gtMd={{ flexBasis: 'auto', minWidth: 168 }}
      {...(onPress && {
        onPress,
        cursor: 'pointer',
        hoverStyle: { opacity: 0.7 },
        pressStyle: { opacity: 0.5 },
      })}
    >
      <XStack ai="center" gap="$1" mb="$1.5">
        <EarnText
          text={title}
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
        />
        {tooltip}
      </XStack>
      {valueLayout === 'stacked' ? (
        <YStack ai="flex-start" gap="$0.5">
          {valueContent}
        </YStack>
      ) : (
        <XStack ai="center" gap="$1">
          {valueContent}
        </XStack>
      )}
    </YStack>
  );
}
