import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';

type ArrivalTimeProps = {
  value?: number;
  typography?: ComponentProps<typeof Text>['typography'];
  color?: ComponentProps<typeof Text>['color'];
};

export const ArrivalTime: FC<ArrivalTimeProps> = ({
  value,
  typography = 'Caption',
  color = 'text-subdued',
}) => {
  const intl = useIntl();
  const text = useMemo(() => {
    if (!value) {
      return intl.formatMessage(
        { id: 'content__str_mins' },
        { 'content__str_mins': 1 },
      );
    }
    if (value < 60) {
      return intl.formatMessage(
        { id: 'content__str_seconds' },
        { 'content__str_seconds': value },
      );
    }
    const minutes = Math.ceil(value / 60);
    return intl.formatMessage(
      { id: 'content__str_mins' },
      { 'content__str_mins': minutes },
    );
  }, [value, intl]);
  return (
    <Text typography={typography} color={color}>
      &lt;{text}
    </Text>
  );
};
