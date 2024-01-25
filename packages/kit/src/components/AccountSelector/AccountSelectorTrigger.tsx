import { useCallback } from 'react';

import {
  Button,
  Dialog,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/components/src/actions/AccountAvatar';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';
import { DeriveTypeSelectorTrigger } from './DeriveTypeSelectorTrigger';
import { useAccountSelectorTrigger } from './hooks/useAccountSelectorTrigger';
import { NetworkSelectorTriggerLegacy } from './NetworkSelectorTrigger';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorTriggerHome({
  num,
  sceneName,
  sceneUrl,
}: { num: number } & IAccountSelectorContextData) {
  // TODO: useAccountSelectorTrigger hooks
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account },
    activeAccountName,
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  return (
    <XStack
      role="button"
      alignItems="center"
      p="$1.5"
      mx="$-1.5"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={() =>
        actions.current.showAccountSelector({
          activeWallet: wallet,
          num,
          navigation,
          sceneName,
          sceneUrl,
        })
      }
      maxWidth="$40"
    >
      <AccountAvatar size="$6" borderRadius="$1" account={account} />

      <SizableText
        flex={1}
        size="$bodyMdMedium"
        pl="$2"
        pr="$1"
        numberOfLines={1}
      >
        {activeAccountName}
      </SizableText>
      <Icon name="ChevronGrabberVerOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export function AccountSelectorTriggerLegacy({
  num,
  onlyAccountSelector,
}: {
  num: number;
  onlyAccountSelector?: boolean;
}) {
  const contextData = useAccountSelectorContextData();
  const {
    selectedAccount: { networkId },
  } = useSelectedAccount({ num });

  const { config } = contextData;
  const title = `${config?.sceneName || ''} 账户选择器 🔗  ${num}`;
  const showAccountSelector = useCallback(() => {
    Dialog.show({
      title,
      estimatedContentHeight: 490,
      renderContent: (
        <AccountSelectorProviderMirror
          enabledNum={[num]}
          config={checkIsDefined(config)}
        >
          <ScrollView h="$100">
            <AccountSelectorDialog num={num} />
          </ScrollView>
        </AccountSelectorProviderMirror>
      ),
      showFooter: false,
    });
  }, [config, num, title]);
  return (
    <>
      <Button onPress={showAccountSelector}>{title}</Button>

      {!onlyAccountSelector ? (
        <>
          <NetworkSelectorTriggerLegacy
            key={`NetworkSelectorTrigger-${networkId || ''}-${num}-${
              config?.sceneName || ''
            }`}
            num={num}
          />
          <DeriveTypeSelectorTrigger
            key={`DeriveTypeSelectorTrigger-${networkId || ''}-${num}-${
              config?.sceneName || ''
            }`}
            num={num}
          />
        </>
      ) : null}
    </>
  );
}

export function AccountSelectorTriggerDappConnection({ num }: { num: number }) {
  const {
    activeAccount: { account },
    activeAccountName,
    showAccountSelector,
  } = useAccountSelectorTrigger({ num });

  const addressText = account?.address
    ? accountUtils.shortenAddress({
        address: account?.address || '',
      })
    : 'No Address';

  const media = useMedia();
  return (
    <XStack
      flex={1}
      py="$2"
      px="$3"
      space="$2"
      bg="$bgApp"
      borderTopRightRadius="$3"
      borderBottomRightRadius="$3"
      alignItems="center"
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
      $platform-native={{
        hitSlop: {
          top: 8,
          bottom: 8,
          left: 8,
        },
      }}
      onPress={showAccountSelector}
    >
      {account?.address ? (
        <AccountAvatar size="$6" borderRadius="$1" account={account} />
      ) : null}
      {media.md ? (
        <YStack flex={1}>
          <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
            {activeAccountName}
          </SizableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1} color="$text">
            {addressText}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
          {activeAccountName}
        </SizableText>
      )}
      {media.md ? null : (
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          numberOfLines={1}
          color="$text"
        >
          {addressText}
        </SizableText>
      )}
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}
