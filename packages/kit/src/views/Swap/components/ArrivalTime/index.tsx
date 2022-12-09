import { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

type ArrivalTimeProps = {
  value?: number;
};

export const ArrivalTime: FC<ArrivalTimeProps> = ({ value }) => {
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
    <Typography.Caption color="text-subdued">&lt;{text}</Typography.Caption>
  );
};
