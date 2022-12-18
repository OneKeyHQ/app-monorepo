import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Button, Center, Empty } from '@onekeyhq/components';

interface ErrorViewProps {
  onRefresh: () => void;
}
const ErrorView: FC<ErrorViewProps> = ({ onRefresh }) => {
  const intl = useIntl();
  return (
    <Center w="full" h="full" bg="background-default">
      <Empty
        emoji="🌐"
        title={intl.formatMessage({ id: 'title__no_connection' })}
        subTitle={intl.formatMessage({ id: 'title__no_connection_desc' })}
        mb={3}
      />
      <Button
        mt={6}
        size="lg"
        type="primary"
        leftIconName="ArrowPathOutline"
        onPress={onRefresh}
      >
        {intl.formatMessage({ id: 'action__refresh' })}
      </Button>
    </Center>
  );
};
export default ErrorView;
