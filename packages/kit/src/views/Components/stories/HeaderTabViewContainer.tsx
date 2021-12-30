/* eslint-disable arrow-body-style */
import React from 'react';

import { HeaderTabViewContainer, SceneMap } from '@onekeyhq/components';

import AccountInfo from '../../Wallet/AccountInfo';
import AssetsList from '../../Wallet/AccountList';
import Collectibles from '../../Wallet/Collectibles';
import HistoricalRecord from '../../Wallet/HistoricalRecords';

const HeaderTabViewContainerStory = () => {
  return (
    <HeaderTabViewContainer
      renderScrollHeader={AccountInfo}
      routes={[
        {
          key: 'tokens',
          title: 'Tokens',
        },
        {
          key: 'collectibles',
          title: 'Collectibles',
        },
        {
          key: 'history',
          title: 'History',
        },
      ]}
      renderScene={SceneMap({
        tokens: AssetsList,
        collectibles: Collectibles,
        history: HistoricalRecord,
      })}
    />
  );
};

export default HeaderTabViewContainerStory;
