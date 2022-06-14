import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { BaseSkeleton, Box } from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

import SectionHeader, { ViewTypes } from '../Components/SectionHeader';

import NFTList from './NFTList';
import WalletList from './WalletList';

const LoadingView = () => (
  <Box borderRadius="12px" height="160px" overflow="hidden">
    <BaseSkeleton />
  </Box>
);

const Content = ({ viewType }: { viewType: ViewTypes }) => {
  const { loading } = useOverview();

  if (loading) {
    return <LoadingView />;
  }
  return (
    <Box>
      {viewType === 'L' ? (
        <WalletList datas={['1', '2', '3', '4', '5']} />
      ) : (
        <NFTList datas={['1', '2', '3', '4', '5']} />
      )}
    </Box>
  );
};

const NFTSection: FC = () => {
  const intl = useIntl();
  const [viewType, updateViewType] = useState<ViewTypes>('R');
  return (
    <Box mb="24px">
      <SectionHeader
        type={viewType}
        title={intl.formatMessage({ id: 'asset__collectibles' })}
        onViewChange={updateViewType}
      />
      <Content viewType={viewType} />
    </Box>
  );
};

export default NFTSection;
