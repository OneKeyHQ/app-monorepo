import { ButtonFrame, Skeleton, XStack, YStack } from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

const flexBasisByWidthMode = {
  columns: '50%',
  equal: 0,
  hug: 'auto',
} as const;

export type IOverviewMetricProps = {
  title: IEarnText;
  text?: IEarnText;
  action?: React.ReactNode;
  tooltip?: React.ReactNode;
  isLoading?: boolean;
  onPress?: () => void;
  testID?: string;
  valueLayout?: 'inline' | 'stacked';
  widthMode?: 'columns' | 'equal' | 'hug';
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
    <>
      <Skeleton w="100%" maxWidth={72} h="$6" borderRadius="$1" />
      {valueLayout === 'stacked' ? (
        <Skeleton w={56} h="$5" borderRadius="$1" />
      ) : null}
    </>
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
  const MetricFrame = onPress ? ButtonFrame : YStack;

  return (
    <MetricFrame
      testID={testID}
      p="$3"
      flexBasis={flexBasisByWidthMode[widthMode]}
      flexGrow={widthMode === 'equal' ? 1 : 0}
      minWidth={widthMode === 'equal' ? 0 : undefined}
      $gtMd={{ flexBasis: 'auto', flexGrow: 0, minWidth: 168 }}
      {...(onPress && {
        onPress,
        accessibilityLabel: title.text,
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        borderRadius: '$0',
        borderWidth: '$0',
        bg: '$transparent',
        focusable: true,
        cursor: 'pointer',
        hoverStyle: { opacity: 0.7 },
        pressStyle: { opacity: 0.5 },
        focusVisibleStyle: {
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
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
        <YStack ai="flex-start" gap="$0.5" minHeight={46}>
          {valueContent}
        </YStack>
      ) : (
        <XStack ai="center" gap="$1" minHeight="$6" width="100%">
          {valueContent}
        </XStack>
      )}
    </MetricFrame>
  );
}
