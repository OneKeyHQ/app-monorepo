import { Alert, Icon, XStack, YStack } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActionIcon,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from './EarnActionIcon';
import { EarnText } from './EarnText';
import { EarnTooltip } from './EarnTooltip';

export function GridItem({
  title,
  description,
  descriptionComponent,
  actionIcon,
  tooltip,
  type = 'default',
}: {
  title: IEarnText;
  description?: IEarnText;
  descriptionComponent?: React.ReactNode;
  tooltip?: IEarnTooltip;
  actionIcon?: IEarnActionIcon;
  type?: 'default' | 'info' | 'alert';
}) {
  if (type === 'info') {
    return (
      <Alert
        m="$3"
        flex={1}
        renderTitle={() => {
          return <EarnText text={title} size="$bodyMdMedium" />;
        }}
        description={description?.text}
        descriptionComponent={descriptionComponent}
      />
    );
  }

  if (type === 'alert') {
    return (
      <Alert
        type="critical"
        m="$3"
        flex={1}
        renderTitle={() => {
          return <EarnText text={title} size="$bodyMdMedium" />;
        }}
        description={description?.text}
        descriptionComponent={descriptionComponent}
      />
    );
  }
  const isLinkAction = actionIcon?.type === 'link';

  return (
    <YStack
      p="$3"
      flexBasis="50%"
      $gtMd={{
        flexBasis: '33.33%',
      }}
    >
      <XStack gap="$1" mb="$1">
        <EarnText text={title} size="$bodyMd" color="$textSubdued" />
        <EarnTooltip title={title.text} tooltip={tooltip} />
      </XStack>
      <XStack gap="$1" alignItems="center">
        {isLinkAction ? (
          <XStack
            gap="$1"
            alignItems="center"
            cursor="pointer"
            onPress={() => openUrlExternal(actionIcon?.data?.link)}
          >
            <EarnText text={description} size="$bodyLgMedium" />
            {descriptionComponent ?? null}
            <Icon name="OpenOutline" size="$4.5" color="$iconSubdued" />
          </XStack>
        ) : (
          <>
            <EarnText text={description} size="$bodyLgMedium" />
            {descriptionComponent ?? null}
            <EarnActionIcon title={title.text} actionIcon={actionIcon} />
          </>
        )}
      </XStack>
    </YStack>
  );
}
