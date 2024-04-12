import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IConnectionAccountInfoWithNum,
  IConnectionItemWithStorageType,
  IConnectionStorageType,
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
  return (
    <YStack space="$5" p="$5">
      <XStack alignItems="center" justifyContent="space-between" space="$3">
        <XStack flex={1} alignItems="center" space="$3">
          <Image w="$10" h="$10" source={{ uri: item.imageURL }} />
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
          focusStyle={{
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
        <YStack space="$2">
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
            />
          ))}
        </YStack>
      </AccountSelectorProviderMirror>
    </YStack>
  );
}

export default ConnectionListItem;
