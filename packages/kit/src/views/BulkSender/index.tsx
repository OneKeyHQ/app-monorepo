import { useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  IconButton,
  ScrollView,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';

import IdentityAssertion from '../../components/IdentityAssertion';
import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount } from '../../hooks';
import { navigationShortcuts } from '../../routes/navigationShortcuts';
import { HomeRoutes } from '../../routes/routesEnum';

import { ManyToN } from './ManyToN';
import { ModelSelector } from './ModeSelector';
import { NotSupported } from './NotSupported';
import { OneToMany } from './OneToMany';

import type { HomeRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MessageDescriptor } from 'react-intl';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.BulkSender>;
type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

function BulkSender() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isVertical = useIsVerticalLayout();
  const route = useRoute<RouteProps>();

  const routeParams = route.params;
  const mode = routeParams?.mode;

  const { accountId, networkId, network, accountAddress, walletId } =
    useActiveWalletAccount();

  let selectedMode = mode;

  const isSupported = !!(
    network?.enabled &&
    network.settings?.supportBatchTransfer &&
    network.settings.supportBatchTransfer.length > 0
  );

  if (
    network?.enabled &&
    network.settings?.supportBatchTransfer &&
    network.settings.supportBatchTransfer.length === 1
  ) {
    [selectedMode] = network.settings.supportBatchTransfer;
  }

  const renderBulkSenderPanel = useCallback(() => {
    if (selectedMode === BulkTypeEnum.OneToMany) {
      return (
        <OneToMany
          accountId={accountId}
          networkId={networkId}
          accountAddress={accountAddress}
        />
      );
    }
    if (selectedMode === BulkTypeEnum.ManyToOne) {
      return (
        <ManyToN
          accountId={accountId}
          networkId={networkId}
          walletId={walletId}
          accountAddress={accountAddress}
          bulkType={BulkTypeEnum.ManyToOne}
        />
      );
    }
    if (selectedMode === BulkTypeEnum.ManyToMany) {
      return (
        <ManyToN
          accountId={accountId}
          networkId={networkId}
          walletId={walletId}
          accountAddress={accountAddress}
          bulkType={BulkTypeEnum.ManyToMany}
        />
      );
    }
  }, [accountAddress, accountId, networkId, selectedMode, walletId]);

  const title = useMemo(() => {
    let desc: MessageDescriptor['id'];
    if (mode === BulkTypeEnum.OneToMany) {
      desc = 'form__one_to_many';
    } else if (mode === BulkTypeEnum.ManyToOne) {
      desc = 'form__many_to_one';
    } else if (mode === BulkTypeEnum.ManyToMany) {
      desc = 'form__many_to_many';
    }

    if (desc)
      return `${intl.formatMessage({
        id: 'title__bulksender',
      })} - ${intl.formatMessage({ id: desc })}`;

    return intl.formatMessage({ id: 'title__bulksender' });
  }, [intl, mode]);

  const headerLeft = useCallback(
    () => (
      <HStack alignItems="center">
        <Box ml="-6px" mr="8px">
          <IconButton
            type="plain"
            size="lg"
            name={isVertical ? 'ArrowLeftOutline' : 'ArrowSmallLeftOutline'}
            onPress={() => {
              if (mode) {
                navigation.navigate(HomeRoutes.BulkSender);
              } else if (navigation?.canGoBack()) {
                navigation?.goBack();
              } else {
                navigationShortcuts.navigateToHome();
              }
            }}
            circle
          />
        </Box>
        {!isVertical && (
          <Text typography="Heading" color="text-default">
            {title}
          </Text>
        )}
      </HStack>
    ),
    [isVertical, mode, navigation, title],
  );

  const headerRight = useCallback(
    () => (
      <Box pr="6">
        <NetworkAccountSelectorTrigger type={isVertical ? 'basic' : 'plain'} />
      </Box>
    ),
    [isVertical],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: isVertical ? title : undefined,
      // eslint-disable-next-line react/no-unstable-nested-components
      header: () => (
        <NavHeader headerRight={headerRight} headerLeft={headerLeft} />
      ),
    });
  }, [headerLeft, headerRight, intl, isVertical, navigation, title]);

  if (!isSupported) return <NotSupported networkId={networkId} />;

  if (selectedMode) {
    return (
      <Center width="full" height="full">
        <IdentityAssertion>
          <ScrollView
            contentContainerStyle={{
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box
              width={isVertical ? 'full' : '768px'}
              paddingY={5}
              paddingX={isVertical ? 4 : 0}
            >
              {renderBulkSenderPanel()}
            </Box>
          </ScrollView>
        </IdentityAssertion>
      </Center>
    );
  }

  return <ModelSelector networkId={networkId} />;
}

export default BulkSender;
