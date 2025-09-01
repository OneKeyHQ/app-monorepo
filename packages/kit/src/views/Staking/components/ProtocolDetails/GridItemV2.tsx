import { Alert, XStack, YStack } from '@onekeyhq/components';
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
  actionIcon,
  tooltip,
  type = 'default',
}: {
  title: IEarnText;
  description?: IEarnText;
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
      />
    );
  }
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
        <EarnText text={description} size="$bodyLgMedium" />
        <EarnActionIcon title={title.text} actionIcon={actionIcon} />
      </XStack>
    </YStack>
  );
}
