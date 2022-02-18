import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import {
  MaterialTabBar,
  Tabs,
} from '@onekeyhq/components/src/CollapsibleTabView';
import { Body2StrongProps } from '@onekeyhq/components/src/Typography';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import AccountInfo, {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from './AccountInfo';
import AssetsList from './AssetsList';
// import CollectiblesList from './Collectibles';
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
  const isVerticalLayout = useIsVerticalLayout();
  const { account, network } = useActiveWalletAccount();

  if (!account) {
    return (
      <Box flex="1" justifyContent="center">
        <Empty
          icon="WalletOutline"
          title={intl.formatMessage({ id: 'empty__no_wallet_title' })}
          subTitle={intl.formatMessage({ id: 'empty__no_wallet_desc' })}
        />
        <AccountSelector
          renderTrigger={({ handleToggleVisible }) => (
            <Button
              leftIconName="PlusOutline"
              type="primary"
              onPress={handleToggleVisible}
              size="lg"
            >
              {intl.formatMessage({ id: 'action__create_wallet' })}
            </Button>
          )}
        />
      </Box>
    );
  }

  return (
    <Tabs.Container
      renderHeader={AccountInfo}
      headerHeight={
        isVerticalLayout
          ? FIXED_VERTICAL_HEADER_HEIGHT
          : FIXED_HORIZONTAL_HEDER_HEIGHT
      }
      containerStyle={{
        maxWidth: MAX_PAGE_CONTAINER_WIDTH + 32,
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
      {/* <Tabs.Tab
        name={TabEnum.Collectibles}
        label={intl.formatMessage({ id: 'asset__collectibles' })}
      >
        <CollectiblesList />
      </Tabs.Tab> */}
      <Tabs.Tab
        name={TabEnum.History}
        label={intl.formatMessage({ id: 'transaction__history' })}
      >
        <HistoricalRecord
          accountId={account?.id}
          networkId={network?.network?.id}
          isTab
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default Home;
