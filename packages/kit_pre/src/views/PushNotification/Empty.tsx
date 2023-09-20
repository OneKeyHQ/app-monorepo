import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Center, Empty, Spinner } from '@onekeyhq/components';

type ListEmptyComponentProps = {
  desc?: string;
  isLoading: boolean;
  symbol?: string;
};

export const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  symbol,
  desc,
}) => {
  const intl = useIntl();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  const tokenSubTitle = symbol
    ? intl.formatMessage(
        {
          id: 'title__no_alert_desc',
        },
        { 0: symbol },
      )
    : '';
  return (
    <Center w="full" h="full">
      <Empty
        emoji="🔔"
        title={intl.formatMessage({
          id: 'title__no_alert',
        })}
        subTitle={desc || tokenSubTitle}
      />
    </Center>
  );
};
