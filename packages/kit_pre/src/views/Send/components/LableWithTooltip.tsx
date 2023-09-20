/* eslint-disable react/no-unstable-nested-components */
import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  Pressable,
  RichTooltip,
  Text,
} from '@onekeyhq/components';
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
    <HStack alignItems="center" space={1}>
      <Text typography="Body2Strong" {...labelProps}>
        {labelBefore}
        {intl.formatMessage({ id: labelId })}
        {labelAfter}
      </Text>
      <RichTooltip
        trigger={({ ...props }) => (
          <Pressable {...props}>
            <Icon name="InformationCircleMini" size={16} color="icon-subdued" />
          </Pressable>
        )}
        bodyProps={{
          children: <Text>{intl.formatMessage({ id: tooltipId })}</Text>,
        }}
      />
    </HStack>
  );
}

export { LabelWithTooltip };
