import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { MaterialTabBar, Tabs } from 'react-native-collapsible-tab-view';

import { useThemeValue } from '@onekeyhq/components';
import { Body2StrongProps } from '@onekeyhq/components/src/Typography';

import AccountInfo from './AccountInfo';
import AssetsList from './AssetsList';
import CollectiblesList from './Collectibles';
import HistoricalRecord from './HistoricalRecords';

import type { TextStyle } from 'react-native';

enum TabEnum {
  Tokens = 'Tokens',
  Collectibles = 'Collectibles',
  History = 'History',
}

const Home: FC = () => {
  const intl = useIntl();
  const [
    tabbarBgColor,
    activeLabelColor,
    labelColor,
    indicatorColor,
    borderDefault,
  ] = useThemeValue([
    'background-default',
    'text-default',
    'text-subdued',
    'action-primary-default',
    'border-subdued',
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
        shadowColor: 'transparent',
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: borderDefault,
      }}
      renderTabBar={(props) => (
        <MaterialTabBar
          {...props}
          activeColor={activeLabelColor}
          inactiveColor={labelColor}
          labelStyle={{
            ...(Body2StrongProps as TextStyle),
            textTransform: 'none',
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
      <Tabs.Tab
        name={TabEnum.Tokens}
        label={intl.formatMessage({ id: 'asset__tokens' })}
      >
        <AssetsList />
      </Tabs.Tab>
      <Tabs.Tab
        name={TabEnum.Collectibles}
        label={intl.formatMessage({ id: 'asset__collectibles' })}
      >
        <CollectiblesList />
      </Tabs.Tab>
      <Tabs.Tab
        name={TabEnum.History}
        label={intl.formatMessage({ id: 'transaction__history' })}
      >
        <HistoricalRecord isTab />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default Home;
