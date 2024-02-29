import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IConnectionItemWithStorageType,
  IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import { AccountListItem } from '../DAppAccountList';

function ConnectionListItem({
  item,
  handleDisconnect,
}: {
  item: IConnectionItemWithStorageType;
  handleDisconnect: (
    origin: string,
    storageType: IConnectionStorageType,
  ) => Promise<void>;
}) {
  return (
    <YStack space="$5" p="$5">
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" space="$3">
          <Image w="$10" h="$10" source={{ uri: item.imageURL }} />
          <SizableText size="$bodyLgMedium" color="$grayA1">
            {item.origin}
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
      >
        <YStack space="$2">
          {Object.keys(item.connectionMap).map((num) => (
            <AccountListItem key={num} num={Number(num)} readonly />
          ))}
        </YStack>
      </AccountSelectorProviderMirror>
    </YStack>
  );
}

export default ConnectionListItem;
