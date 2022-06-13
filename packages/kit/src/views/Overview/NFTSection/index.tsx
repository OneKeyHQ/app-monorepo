import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import SectionHeader from '../Components/SectionHeader';

const NFTSection: FC = () => {
  const intl = useIntl();

  return (
    <Box height={320}>
      <SectionHeader
        title={intl.formatMessage({ id: 'asset__collectibles' })}
        onViewChange={() => {}}
      />
    </Box>
  );
};

export default NFTSection;
