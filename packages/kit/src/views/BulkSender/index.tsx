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

import { ModelSelector } from './ModeSelector';

function BulkSender() {
  const intl = useIntl();
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();

  const { accountId, networkId, network } = useActiveWalletAccount();

  const isSupportedOneToMany = !!(
    network?.settings.supportBatchTransferOneToMany &&
    (network?.settings.nativeSupportBatchTransferOneToMany
      ? true
      : batchTransferContractAddress[networkId])
  );
  const isSupportedManyToMany =
    !!network?.settings.supportBatchTransferManyToMany;
  const isSupportedManyToOne =
    !!network?.settings.supportBatchTransferManyToOne;
  const isSupported = !!(
    network?.enabled &&
    (isSupportedOneToMany || isSupportedManyToMany || isSupportedManyToOne)
  );

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
  }, [navigation, headerRight]);

  if (!isSupported) return <NotSupported networkId={networkId} />;

  return (
    <ModelSelector
      isSupportedOneToMany={isSupportedOneToMany}
      isSupportedManyToOne={isSupportedManyToOne}
      isSupportedManyToMany={isSupportedManyToMany}
    />
  );
}

export default BulkSender;
