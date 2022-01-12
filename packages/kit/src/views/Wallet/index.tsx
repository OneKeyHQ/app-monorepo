import React from 'react';

import { useIntl } from 'react-intl';
import { MaterialTabBar, Tabs } from 'react-native-collapsible-tab-view';

import { useThemeValue } from '@onekeyhq/components';
import { Body2StrongProps } from '@onekeyhq/components/src/Typography';

import AccountInfo from './AccountInfo';
import AssetsList from './AssetsList';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Collectibles from './Collectibles';
import HistoricalRecord from './HistoricalRecords';

import type { TextStyle } from 'react-native';

const Home: React.FC = () => {
  const intl = useIntl();
  const [tabbarBgColor, activeLabelColor, labelColor, indicatorColor] =
    useThemeValue([
      'background-default',
      'text-default',
      'text-subdued',
      'action-primary-default',
    ]);
  return (
    <Tabs.Container
      renderHeader={AccountInfo}
      headerHeight={190}
      containerStyle={{
        maxWidth: 768,
        marginHorizontal: 'auto',
      }}
      headerContainerStyle={{
        shadowOffset: { width: 0, height: 0 },
      }}
      renderTabBar={(props) => (
        <MaterialTabBar
          {...props}
          activeColor={activeLabelColor}
          inactiveColor={labelColor}
          labelStyle={{
            ...(Body2StrongProps as TextStyle),
            textTransform: 'capitalize',
          }}
          indicatorStyle={{ backgroundColor: indicatorColor }}
          style={{
            backgroundColor: tabbarBgColor,
          }}
          contentContainerStyle={{ maxWidth: 768 }}
          tabStyle={{ backgroundColor: tabbarBgColor }}
        />
      )}
    >
      <Tabs.Tab name={intl.formatMessage({ id: 'asset__tokens' })}>
        <AssetsList />
      </Tabs.Tab>
      <Tabs.Tab name={intl.formatMessage({ id: 'asset__collectibles' })}>
        <Collectibles />
      </Tabs.Tab>
      <Tabs.Tab name={intl.formatMessage({ id: 'transaction__history' })}>
        <HistoricalRecord isTab />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default Home;
