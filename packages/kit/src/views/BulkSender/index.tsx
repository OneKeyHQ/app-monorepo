import { useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { HeaderBackButton as NavigationHeaderBackButton } from '@react-navigation/elements';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Text,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { useNativeToken } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount } from '../../hooks';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { useConnectAndCreateExternalAccount } from '../ExternalAccount/useConnectAndCreateExternalAccount';

import { NotSupported } from './NotSupported';
import { TokenOutbox } from './TokenOutbox';
import { BulkSenderTypeEnum } from './types';

const emptyHeader = () => <Text />;
function BulkSender() {
  const intl = useIntl();
  const goBack = useNavigationBack();
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const [tabbarBgColor] = useThemeValue(['background-default']);

  const { accountId, networkId, accountAddress, network } =
    useActiveWalletAccount();

  const isSupported =
    network?.enabled &&
    network?.settings.supportBatchTransfer &&
    (network?.settings.nativeSupportBatchTransfer
      ? true
      : batchTransferContractAddress[networkId]);

  const nativeToken = useNativeToken(networkId);

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
        <NetworkAccountSelectorTrigger type={isVertical ? 'basic' : 'plain'} />
      </Box>
    );
  }, [accountId, isVertical, walletConnectButton]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight,
    });
  }, [navigation, headerLeft, headerRight]);

  if (!isSupported) return <NotSupported networkId={networkId} />;

  return (
    <Tabs.Container
      headerContainerStyle={{
        width: '100%',
        maxWidth: 768,
      }}
      containerStyle={{
        width: '100%',
        maxWidth: 768,
        marginHorizontal: 'auto',
        backgroundColor: tabbarBgColor,
        alignSelf: 'center',
        flex: 1,
      }}
      renderHeader={emptyHeader}
      headerHeight={isVertical ? 0 : 30}
      // scrollEnabled={false}
      disableRefresh
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
  );
}

export default BulkSender;
