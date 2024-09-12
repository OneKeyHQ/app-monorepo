import { useCallback } from 'react';

import {
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
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import useActiveTabDAppInfo from '../../hooks/useActiveTabDAppInfo';
import { useDappAccountSwitch } from '../../hooks/useDappAccountSwitch';
import {
  type IHandleAccountChangedParams,
  useHandleDiscoveryAccountChanged,
} from '../../hooks/useHandleAccountChanged';

function SingleAccountAddressSelectorTrigger({
  origin,
  num,
  account,
  afterChangeAccount,
}: {
  origin: string;
  num: number;
  account: IConnectionAccountInfoWithNum;
  afterChangeAccount: () => void;
}) {
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const handleAccountChanged = useCallback(
    async (accountChangedParams: IHandleAccountChangedParams) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        accountChangedParams,
        storageType: account.storageType,
        afterUpdate: afterChangeAccount,
      });
    },
    [num, account, afterChangeAccount, handleAccountInfoChanged, origin],
  );

  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });
  return <AccountSelectorTriggerAddressSingle num={num} />;
}

function DAppConnectExtensionFloatingTrigger() {
  const { result, refreshConnectionInfo } = useActiveTabDAppInfo();
  const {
    shouldSwitchAccount,
    isSwitching,
    hideAccountSelectorTrigger,
    switchProcessText,
    onSwitchAccount,
    onCancelSwitchAccount,
  } = useDappAccountSwitch({ result, refreshConnectionInfo });

  const navigation = useAppNavigation();
  const handlePressFloatingButton = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.CurrentConnectionModal,
      params: {
        origin: result?.origin ?? '',
        faviconUrl: result?.faviconUrl ?? '',
      },
    });
  }, [result, navigation]);

  const onDisconnect = useCallback(async () => {
    if (result?.connectedAccountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin: result?.origin ?? '',
        storageType: result?.connectedAccountsInfo?.[0].storageType,
      });
      void refreshConnectionInfo();
    }
  }, [result?.origin, result?.connectedAccountsInfo, refreshConnectionInfo]);

  const renderAccountTrigger = useCallback(() => {
    if (result?.connectedAccountsInfo?.length === 1) {
      if (hideAccountSelectorTrigger) {
        return <Skeleton width={153} height="$5" />;
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
          <XStack minHeight="$5">
            <SingleAccountAddressSelectorTrigger
              origin={result?.origin ?? ''}
              num={result?.connectedAccountsInfo?.[0]?.num}
              account={result?.connectedAccountsInfo?.[0]}
              afterChangeAccount={() => {
                void refreshConnectionInfo();
              }}
            />
          </XStack>
        </AccountSelectorProviderMirror>
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
        {result?.networkIcons.slice(0, 2).map((icon, index) => (
          <Token
            key={icon}
            size="xs"
            tokenImageUri={icon}
            ml={index === 1 ? '$-2' : undefined}
            borderColor={index === 1 ? '$bgApp' : undefined}
            borderWidth={index === 1 ? 2 : undefined}
            borderStyle={index === 1 ? 'solid' : undefined}
            style={
              // @ts-expect-error
              index === 1 ? { boxSizing: 'content-box' } : undefined
            }
          />
        ))}
        <SizableText pl="$1" size="$bodySm" numberOfLines={1}>
          {result?.addressLabel}
        </SizableText>
        <Icon size="$4" color="$iconSubdued" name="ChevronRightSmallOutline" />
      </XStack>
    );
  }, [result, hideAccountSelectorTrigger, refreshConnectionInfo]);

  if (!result?.showFloatingPanel) {
    return null;
  }

  return (
    <>
      {shouldSwitchAccount ? (
        <Stack
          position="absolute"
          bottom="$16"
          right="0"
          left="0"
          h="$9"
          w="100%"
          bg="$bgApp"
          borderTopWidth="$px"
          borderBottomWidth="0"
          borderLeftWidth="0"
          borderRightWidth="0"
          borderColor="$borderInfoSubdued"
        >
          <XStack
            py="$2"
            px="$5"
            justifyContent="space-between"
            gap="$2"
            bg="$bgInfoSubdued"
          >
            <SizableText size="$bodyMdMedium">{switchProcessText}</SizableText>
            <XStack gap="$3">
              <IconButton
                icon="CornerDownRightOutline"
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
        </Stack>
      ) : null}
      <Stack
        position="absolute"
        bottom="0"
        right="0"
        left="0"
        h="$16"
        w="100%"
        py="$3"
        px="$5"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgApp"
        borderTopWidth="$px"
        borderBottomWidth="0"
        borderLeftWidth="0"
        borderRightWidth="0"
        borderColor={shouldSwitchAccount ? '$borderInfoSubdued' : '$border'}
        onPress={handlePressFloatingButton}
      >
        <XStack alignItems="center" gap="$3">
          <Stack position="relative">
            <Image size="$9" borderRadius="$2">
              <Image.Source
                src={result?.faviconUrl || result?.originFaviconUrl}
              />
              <Image.Fallback>
                <Icon size="$10" name="GlobusOutline" />
              </Image.Fallback>
              <Image.Loading>
                <Skeleton width="100%" height="100%" />
              </Image.Loading>
            </Image>
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
          <YStack maxWidth={276}>
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {result?.connectLabel}
            </SizableText>
            {renderAccountTrigger()}
          </YStack>
        </XStack>
        <IconButton
          icon="BrokenLinkOutline"
          size="medium"
          variant="tertiary"
          onPress={onDisconnect}
        />
      </Stack>
    </>
  );
}

export default function DAppConnectExtensionFloatingTriggerWithHomeProvider() {
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
