import { Alert, SizableText, XStack, YStack } from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type {
  IEarnActionIcon,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { EarnTooltip } from '../../pages/ProtocolDetailsV2/EarnTooltip';

import { EarnActionIcon } from './EarnActionIcon';

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
        title={title.text}
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
        title={title.text}
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
        <SizableText
          size={title?.size || '$bodyMd'}
          color={title.color || '$textSubdued'}
        >
          {title.text}
        </SizableText>
        <EarnTooltip title={title.text} tooltip={tooltip} />
      </XStack>
      <XStack gap="$1" alignItems="center">
        {description ? (
          <FormatHyperlinkText
            size={description?.size || '$bodyLgMedium'}
            color={description.color}
          >
            {description.text}
          </FormatHyperlinkText>
        ) : null}
        <EarnActionIcon title={title.text} actionIcon={actionIcon} />
      </XStack>
    </YStack>
  );
}
