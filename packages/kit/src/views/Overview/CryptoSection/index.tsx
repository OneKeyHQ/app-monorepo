import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Skeleton } from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

import SectionHeader, { ViewTypes } from '../Components/SectionHeader';

import CryptosList from './CryptosList';
import WalletList from './WalletList';

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

const Content = ({ viewType }: { viewType: ViewTypes }) => {
  const { loading } = useOverview();
  if (loading) {
    return <LoadingView />;
  }
  return (
    <Box mb="24px">
      {viewType === 'L' ? (
        <WalletList datas={['1', '2', '3', '4', '5']} />
      ) : (
        <CryptosList datas={['1', '2', '3', '4', '5']} />
      )}
    </Box>
  );
};

const CryptoSection: FC = () => {
  const intl = useIntl();
  const [viewType, updateViewType] = useState<ViewTypes>('L');
  return (
    <Box mb="24px">
      <SectionHeader
        title={intl.formatMessage({ id: 'title__cryptos' })}
        onViewChange={updateViewType}
        filter={() => {}}
      />
      <Content viewType={viewType} />
    </Box>
  );
};

export default CryptoSection;
