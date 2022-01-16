import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import {
  MaterialTabBar,
  Tabs,
} from '@onekeyhq/components/src/CollapsibleTabView';
import { Body2StrongProps } from '@onekeyhq/components/src/Typography';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

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
      headerHeight={useIsVerticalLayout() ? 212 : 190}
      containerStyle={{
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        width: '100%',
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
          }}
          indicatorStyle={{ backgroundColor: indicatorColor }}
          style={{
            backgroundColor: tabbarBgColor,
          }}
          contentContainerStyle={{ maxWidth: MAX_PAGE_CONTAINER_WIDTH }}
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
