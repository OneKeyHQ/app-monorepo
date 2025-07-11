import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  HeightTransition,
  Icon,
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerAddressSingle } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { SyncDappAccountToHomeProvider } from '@onekeyhq/kit/src/views/Discovery/components/SyncDappAccountToHomeProvider';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useActiveTabDAppInfo from '../../hooks/useActiveTabDAppInfo';
import { useDappAccountSwitch } from '../../hooks/useDappAccountSwitch';

import type { IExtensionActiveTabDAppInfo } from '../../hooks/useActiveTabDAppInfo';

function SingleAccountAddressSelectorTrigger({
  num,
  onPress,
}: {
  num: number;
  onPress: () => void;
}) {
  return <AccountSelectorTriggerAddressSingle num={num} onPress={onPress} />;
}

function SingleAccountAddressSelectorTriggerWithProvider({
  result,
  onPress,
}: {
  result: IExtensionActiveTabDAppInfo | null;
  onPress: () => void;
}) {
  if (result?.connectedAccountsInfo?.length !== 1) {
    return null;
  }
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: result?.origin ?? '',
      }}
      enabledNum={result?.connectedAccountsInfo?.map(
        (connectAccount) => connectAccount.num,
      )}
      availableNetworksMap={result?.connectedAccountsInfo?.reduce(
        (acc, connectAccount) => {
          if (Array.isArray(connectAccount.availableNetworkIds)) {
            acc[connectAccount.num] = {
              networkIds: connectAccount.availableNetworkIds,
            };
          }
          return acc;
        },
        {} as Record<number, { networkIds: string[] }>,
      )}
    >
      <SingleAccountAddressSelectorTrigger
        num={result?.connectedAccountsInfo?.[0]?.num}
        onPress={onPress}
      />
    </AccountSelectorProviderMirror>
  );
}

function SingleAccountAddressSelectorTriggerWrapper({
  children,
  hideAccountSelectorTrigger,
}: {
  children: React.ReactNode;
  hideAccountSelectorTrigger?: boolean;
}) {
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const onSwitchNetwork = (event: { state: 'switching' | 'completed' }) => {
      setIsSwitching(event.state === 'switching');
    };
    appEventBus.on(EAppEventBusNames.OnSwitchDAppNetwork, onSwitchNetwork);
    return () => {
      appEventBus.off(EAppEventBusNames.OnSwitchDAppNetwork, onSwitchNetwork);
    };
  }, []);

  if (isSwitching || hideAccountSelectorTrigger) {
    return (
      <Stack py="$1" w="$16">
        <Skeleton height="$3" />
      </Stack>
    );
  }

  return children;
}

function DAppConnectExtensionFloatingTrigger() {
  const { result, refreshConnectionInfo } = useActiveTabDAppInfo();

  const memoizedResult = useMemo(() => result, [result]);

  const {
    shouldSwitchAccount,
    isSwitching,
    onSwitchAccount,
    hideAccountSelectorTrigger,
    switchProcessText,
    onCancelSwitchAccount,
  } = useDappAccountSwitch({ result: memoizedResult, refreshConnectionInfo });

  const navigation = useAppNavigation();
  const handlePressFloatingButton = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.CurrentConnectionModal,
    });
  }, [navigation]);

  const onDisconnect = useCallback(async () => {
    if (memoizedResult?.connectedAccountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin: memoizedResult?.origin ?? '',
        storageType: memoizedResult?.connectedAccountsInfo?.[0].storageType,
        entry: 'ExtFloatingTrigger',
      });
      void refreshConnectionInfo();
    }
  }, [
    memoizedResult?.origin,
    memoizedResult?.connectedAccountsInfo,
    refreshConnectionInfo,
  ]);

  const renderAccountTrigger = useCallback(() => {
    if (memoizedResult?.connectedAccountsInfo?.length === 1) {
      return (
        <SingleAccountAddressSelectorTriggerWrapper
          hideAccountSelectorTrigger={hideAccountSelectorTrigger}
        >
          <SingleAccountAddressSelectorTriggerWithProvider
            result={memoizedResult}
            onPress={handlePressFloatingButton}
          />
        </SingleAccountAddressSelectorTriggerWrapper>
      );
    }
    return (
      <XStack
        alignItems="center"
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        }}
        onPress={() => {}}
      >
        {memoizedResult?.networkIcons.slice(0, 2).map((icon, index) => (
          <Token
            key={icon}
            size="xs"
            tokenImageUri={icon}
            ml={index === 1 ? '$-2' : undefined}
            borderColor={index === 1 ? '$bgApp' : undefined}
            borderWidth={index === 1 ? 2 : undefined}
            borderStyle={index === 1 ? 'solid' : undefined}
            style={index === 1 ? { boxSizing: 'content-box' } : undefined}
          />
        ))}
        <SizableText pl="$1" size="$bodySm" numberOfLines={1}>
          {memoizedResult?.addressLabel}
        </SizableText>
        <Icon size="$4" color="$iconSubdued" name="ChevronRightSmallOutline" />
      </XStack>
    );
  }, [memoizedResult, hideAccountSelectorTrigger, handlePressFloatingButton]);

  const renderSyncDappAccountToHomeProvider = useMemo(() => {
    return (
      <SyncDappAccountToHomeProvider
        origin={memoizedResult?.origin ?? ''}
        dAppAccountInfos={memoizedResult?.connectedAccountsInfo ?? null}
      />
    );
  }, [memoizedResult?.connectedAccountsInfo, memoizedResult?.origin]);

  if (!memoizedResult?.showFloatingPanel) {
    return null;
  }

  return (
    <YStack
      position="absolute"
      bottom="0"
      right="0"
      left="0"
      bg="$bgApp"
      borderTopWidth="$px"
      borderColor="$borderSubdued"
    >
      {renderSyncDappAccountToHomeProvider}
      <HeightTransition>
        {shouldSwitchAccount ? (
          <XStack
            py="$2"
            mx={22}
            borderBottomWidth="$px"
            borderBottomColor="$neutral3"
            justifyContent="space-between"
            gap="$2"
          >
            <SizableText size="$bodyMdMedium">{switchProcessText}</SizableText>
            <XStack gap="$3">
              <IconButton
                icon="CheckLargeOutline"
                size="small"
                variant="tertiary"
                onPress={onSwitchAccount}
                loading={isSwitching}
              />
              <IconButton
                icon="CrossedLargeOutline"
                size="small"
                variant="tertiary"
                onPress={onCancelSwitchAccount}
              />
            </XStack>
          </XStack>
        ) : null}
      </HeightTransition>
      <XStack
        group
        alignItems="center"
        gap="$3"
        py="$3"
        px="$5"
        onPress={handlePressFloatingButton}
        userSelect="none"
      >
        <Stack
          animation="quick"
          $group-hover={{
            scale: 1.1,
          }}
        >
          <Image
            size="$9"
            borderRadius="$2"
            borderColor="$border"
            borderWidth="$px"
            source={{
              uri:
                memoizedResult?.faviconUrl || memoizedResult?.originFaviconUrl,
            }}
            fallback={
              <Image.Fallback>
                <Icon size="$9" name="GlobusOutline" />
              </Image.Fallback>
            }
          />
          <Stack
            position="absolute"
            bottom={-2}
            right={-2}
            justifyContent="center"
            alignItems="center"
            w="$3"
            h="$3"
            borderRadius="$full"
            bg="$bg"
            zIndex="$1"
          >
            <Stack w="$2" h="$2" bg="$iconSuccess" borderRadius="$full" />
          </Stack>
        </Stack>
        <YStack flex={1} alignItems="flex-start">
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {memoizedResult?.connectLabel}
          </SizableText>
          {renderAccountTrigger()}
        </YStack>
        <IconButton
          icon="BrokenLinkOutline"
          size="medium"
          variant="tertiary"
          onPress={onDisconnect}
        />
      </XStack>
    </YStack>
  );
}

export default function DAppConnectExtensionFloatingTriggerWithHomeProvider() {
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    return (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
      >
        <DAppConnectExtensionFloatingTrigger />
      </AccountSelectorProviderMirror>
    );
  }

  return null;
}
