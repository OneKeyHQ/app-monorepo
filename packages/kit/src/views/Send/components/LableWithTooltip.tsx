import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { HStack, Icon, Pressable, Text, Tooltip } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';

function LabelWithTooltip({
  labelId,
  tooltipId,
  labelBefore,
  labelAfter,
  labelProps,
}: {
  labelId: LocaleIds;
  tooltipId: LocaleIds;
  labelBefore?: string;
  labelAfter?: string;
  labelProps?: ComponentProps<typeof Text>;
}) {
  const intl = useIntl();
  return (
    <HStack alignItems="center" space={1} flex={1}>
      <Text typography="Body2Strong" {...labelProps}>
        {labelBefore}
        {intl.formatMessage({ id: labelId })}
        {labelAfter}
      </Text>
      <Tooltip
        hasArrow
        maxW="260px"
        placement="top left"
        label={intl.formatMessage({
          id: tooltipId,
        })}
      >
        <Pressable>
          <Icon name="QuestionMarkCircleMini" size={16} color="icon-subdued" />
        </Pressable>
      </Tooltip>
    </HStack>
  );
}

export { LabelWithTooltip };
