import { useCallback } from 'react';

import {
  Avatar,
  Button,
  Dialog,
  Icon,
  ScrollView,
  Skeleton,
  Text,
  XStack,
} from '@onekeyhq/components';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { EAccountManagerStacksRoutes } from '../../views/AccountManagerStacks/types';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';
import { DeriveTypeSelectorTrigger } from './DeriveTypeSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

export function AccountSelectorTriggerHome({ num }: { num: number }) {
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet },
    activeAccountName,
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const navigateAccountManagerStacks = useCallback(() => {
    if (wallet?.id) {
      actions.current.updateSelectedAccount({
        num,
        builder: (v) => ({ ...v, focusedWallet: wallet?.id }),
      });
    }
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
    });
  }, [actions, navigation, num, wallet?.id]);

  return (
    <XStack
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
      onPress={navigateAccountManagerStacks}
      maxWidth="$40"
    >
      <Avatar size="$6" borderRadius="$1">
        <Avatar.Image src="https://placehold.co/120x120?text=A" />
        <Avatar.Fallback>
          <Skeleton w="$6" h="$6" />
        </Avatar.Fallback>
      </Avatar>
      <Text flex={1} variant="$bodyMdMedium" pl="$2" pr="$1" numberOfLines={1}>
        {activeAccountName}
      </Text>
      <Icon name="ChevronGrabberVerOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export function AccountSelectorTrigger({
  num,
  onlyAccountSelector,
}: {
  num: number;
  onlyAccountSelector?: boolean;
}) {
  const contextData = useAccountSelectorContextData();
  const { config } = contextData;
  const title = `${config?.sceneName || ''} 账户选择器 🔗  ${num}`;
  const showAccountSelector = useCallback(() => {
    Dialog.show({
      title,
      estimatedContentHeight: 490,
      renderContent: (
        <AccountSelectorProviderMirror config={checkIsDefined(config)}>
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
          <NetworkSelectorTrigger
            key={`NetworkSelectorTrigger-${num}-${config?.sceneName || ''}`}
            num={num}
          />
          <DeriveTypeSelectorTrigger
            key={`DeriveTypeSelectorTrigger-${num}-${config?.sceneName || ''}`}
            num={num}
          />
        </>
      ) : null}
    </>
  );
}
