import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { HeaderBackButton as NavigationHeaderBackButton } from '@react-navigation/elements';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Empty,
  HStack,
  ScrollView,
  Text,
  VStack,
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { useNativeToken } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount } from '../../hooks';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { useConnectAndCreateExternalAccount } from '../ExternalAccount/useConnectAndCreateExternalAccount';

import { TokenOutbox } from './TokenOutbox';
import { BulkSenderTabEnum } from './types';

const styles = StyleSheet.create({
  tabLabel: {
    textTransform: 'capitalize',
  },
});

function BulkSender() {
  const intl = useIntl();
  const goBack = useNavigationBack();
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);

  const { accountId, networkId } = useActiveWalletAccount();

  const nativeToken = useNativeToken(networkId, accountId);

  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount({
      networkId,
    });

  const walletConnectButton = useMemo(() => {
    if (!platformEnv.isWeb || accountId) {
      return null;
    }
    return (
      <Button onPress={connectAndCreateExternalAccount} mr={6}>
        {intl.formatMessage({ id: 'action__connect_wallet' })}
      </Button>
    );
  }, [intl, connectAndCreateExternalAccount, accountId]);

  const headerLeft = useCallback(
    ({ tintColor }) => (
      <HStack alignItems="center">
        <NavigationHeaderBackButton
          tintColor={tintColor}
          onPress={goBack}
          canGoBack
        />
        {!isVertical && (
          <Text typography="Heading" color="text-default">
            Bulk Send
          </Text>
        )}
      </HStack>
    ),
    [goBack, isVertical],
  );

  const headerRight = useCallback(() => {
    if (!accountId) {
      return walletConnectButton;
    }
    return (
      <Box pr="6">
        <NetworkAccountSelectorTrigger type={isVertical ? 'plain' : 'basic'} />
      </Box>
    );
  }, [accountId, isVertical, walletConnectButton]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerLeft,
      headerRight,
    });
  }, [navigation, headerLeft, headerRight]);

  return (
    <ScrollView>
      <Center>
        <Box maxW="768px" w="100%">
          <Tabs.Container
            initialTabName={BulkSenderTabEnum.NativeToken}
            width={isVertical ? screenWidth : screenWidth - 224}
            pagerProps={{ scrollEnabled: false }}
            containerStyle={{
              width: '100%',
              marginHorizontal: 'auto',
              backgroundColor: tabbarBgColor,
              alignSelf: 'center',
              flex: 1,
            }}
            headerHeight={isVertical ? 20 : 30}
            headerContainerStyle={{
              shadowOffset: { width: 0, height: 0 },
              shadowColor: 'transparent',
              elevation: 0,
              borderBottomWidth: 1,
              borderBottomColor: borderDefault,
            }}
          >
            <Tabs.Tab
              name={BulkSenderTabEnum.NativeToken}
              label={nativeToken?.symbol}
            >
              <TokenOutbox
                accountId={accountId}
                networkId={networkId}
                isNative
              />
            </Tabs.Tab>
            <Tabs.Tab
              name={BulkSenderTabEnum.Token}
              // @ts-ignore
              label={
                <span style={styles.tabLabel}>
                  {intl.formatMessage({ id: 'form__token' })}
                </span>
              }
            >
              <TokenOutbox accountId={accountId} networkId={networkId} />
            </Tabs.Tab>
          </Tabs.Container>
        </Box>
      </Center>
    </ScrollView>
  );
}

export default BulkSender;
