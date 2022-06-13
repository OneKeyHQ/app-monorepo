
import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import SectionHeader, { ViewTypes } from '../Components/SectionHeader';

import CryptosList from './CryptosList';
import WalletList from './WalletList';

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
      {/* <CryptosList datas={['1', '2', '3', '4', '5']} /> */}

      {viewType === 'L' ? (
        <WalletList datas={['1', '2', '3', '4', '5']} />
      ) : (
        <CryptosList datas={['1', '2', '3', '4', '5']} />
      )}
    </Box>
  );
};

export default CryptoSection;
