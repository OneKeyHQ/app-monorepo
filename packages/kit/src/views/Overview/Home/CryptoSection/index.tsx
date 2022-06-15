import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Skeleton, Text } from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

import CryptosList from './CryptosList';

const LoadingView = () => {
  const array = [0, 1, 2, 3];
  return (
    <Box bgColor="surface-default" borderRadius="12px">
      {array.map((i) => (
        <Box key={`CryptoLoading${i}`} height="76px">
          <Box
            flex={1}
            flexDirection="row"
            alignItems="center"
            paddingLeft="16px"
          >
            <Skeleton shape="Avatar" size={32} />
            <Box ml="12px">
              <Skeleton shape="Body1" />
              <Skeleton shape="Body2" />
            </Box>
          </Box>
          {i < 3 && <Divider />}
        </Box>
      ))}
    </Box>
  );
};

const Content = () => {
  const { loading } = useOverview();
  if (loading) {
    return <LoadingView />;
  }
  return (
    <Box mb="24px">
      <CryptosList datas={['1', '2', '3', '4', '5']} />
    </Box>
  );
};

const CryptoSection: FC = () => {
  const intl = useIntl();
  return (
    <Box mb="24px">
      <Box mb="12px">
        <Text typography="Heading">
          {intl.formatMessage({ id: 'title__cryptos' })}
        </Text>
      </Box>
      <Content />
    </Box>
  );
};

export default CryptoSection;
