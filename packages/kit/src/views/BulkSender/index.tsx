import { useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { HeaderBackButton as NavigationHeaderBackButton } from '@react-navigation/elements';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  ScrollView,
  Text,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { useNativeToken } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount } from '../../hooks';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { useConnectAndCreateExternalAccount } from '../ExternalAccount/useConnectAndCreateExternalAccount';

import { TokenOutbox } from './TokenOutbox';
import { BulkSenderTypeEnum } from './types';

function BulkSender() {
  const intl = useIntl();
  const goBack = useNavigationBack();
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const [tabbarBgColor] = useThemeValue(['background-default']);

  const { accountId, networkId, accountAddress } = useActiveWalletAccount();

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
            initialTabName={BulkSenderTypeEnum.NativeToken}
            containerStyle={{
              width: '100%',
              marginHorizontal: 'auto',
              backgroundColor: tabbarBgColor,
              alignSelf: 'center',
              flex: 1,
            }}
            headerHeight={isVertical ? 0 : 30}
            scrollEnabled={false}
          >
            <Tabs.Tab
              name={BulkSenderTypeEnum.NativeToken}
              label={nativeToken?.symbol ?? ''}
            >
              <TokenOutbox
                accountId={accountId}
                networkId={networkId}
                accountAddress={accountAddress}
                type={BulkSenderTypeEnum.NativeToken}
              />
            </Tabs.Tab>
            <Tabs.Tab
              name={BulkSenderTypeEnum.Token}
              label={intl.formatMessage({ id: 'form__token' })}
            >
              <TokenOutbox
                accountId={accountId}
                networkId={networkId}
                accountAddress={accountAddress}
                type={BulkSenderTypeEnum.Token}
              />
            </Tabs.Tab>
          </Tabs.Container>
        </Box>
      </Center>
    </ScrollView>
  );
}

export default BulkSender;
