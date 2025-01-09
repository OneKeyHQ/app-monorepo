import { useCallback } from 'react';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { IMPL_ALGO } from '@onekeyhq/shared/src/engine/engineConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EAlignPrimaryAccountMode,
  type IConnectionAccountInfo,
  type IConnectionAccountInfoWithNum,
  type IConnectionItemWithStorageType,
  type IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import { DAppAccountListItem } from '../DAppAccountList';

import type { IHandleAccountChangedParams } from '../../hooks/useHandleAccountChanged';

function ConnectionListItem({
  item,
  handleDisconnect,
  handleAccountChanged,
}: {
  item: IConnectionItemWithStorageType;
  handleDisconnect: (
    origin: string,
    storageType: IConnectionStorageType,
  ) => Promise<void>;
  handleAccountChanged: (params: {
    handleAccountChangedParams: IHandleAccountChangedParams;
    num: number;
    origin: string;
    prevAccountInfo: IConnectionAccountInfoWithNum;
  }) => void;
}) {
  const [settings] = useSettingsPersistAtom();
  // Switching accounts in Algo is not supported because no dApps listen for the walletconnect updateSession event
  const getReadonly = useCallback(
    (connectionInfo: IConnectionAccountInfo) => {
      // If the primary account is always used, the dApp connection will not switch on connection list
      const isAlwaysUsePrimaryMode =
        settings.alignPrimaryAccountMode ===
        EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount;
      const isWalletConnect = item.storageType === 'walletConnect';
      const isAlgoNetwork = connectionInfo.networkImpl === IMPL_ALGO;
      const SINGLE_CONNECTION = 1;

      // Algo network WalletConnect connection is always read-only
      if (isWalletConnect && isAlgoNetwork) {
        return true;
      }

      // In always use primary account mode
      if (isAlwaysUsePrimaryMode) {
        // Allow switching when there are multiple connections
        return Object.keys(item.connectionMap).length <= SINGLE_CONNECTION;
      }

      return false;
    },
    [settings.alignPrimaryAccountMode, item.storageType, item.connectionMap],
  );
  return (
    <YStack gap="$5" p="$5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack flex={1} alignItems="center" gap="$3">
          <Image size="$10" borderRadius="$full">
            <Image.Source src={item.imageURL} />
            <Image.Fallback>
              <Icon size="$10" name="GlobusOutline" />
            </Image.Fallback>
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          </Image>
          <SizableText
            size="$bodyLgMedium"
            color="$text"
            numberOfLines={3}
            style={{
              wordBreak: 'break-all',
            }}
          >
            {new URL(item.origin).hostname}
          </SizableText>
        </XStack>
        <XStack
          p="$1.5"
          m="-$1.5"
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
          onPress={() => {
            void handleDisconnect(item.origin, item.storageType);
          }}
        >
          <Icon name="BrokenLinkOutline" color="$iconSubdued" size="$6" />
        </XStack>
      </XStack>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.discover,
          sceneUrl: item.origin,
        }}
        enabledNum={Object.keys(item.connectionMap).map((num) => Number(num))}
        availableNetworksMap={item.availableNetworksMap}
      >
        <YStack gap="$2">
          {Object.keys(item.connectionMap).map((num) => (
            <DAppAccountListItem
              key={num}
              num={Number(num)}
              handleAccountChanged={(handleAccountChangedParams) => {
                handleAccountChanged({
                  handleAccountChangedParams,
                  num: Number(num),
                  origin: item.origin,
                  prevAccountInfo: {
                    ...item.connectionMap[Number(num)],
                    num: Number(num),
                    storageType: item.storageType,
                  },
                });
              }}
              readonly={getReadonly(item.connectionMap[Number(num)])}
            />
          ))}
        </YStack>
      </AccountSelectorProviderMirror>
    </YStack>
  );
}

export default ConnectionListItem;
