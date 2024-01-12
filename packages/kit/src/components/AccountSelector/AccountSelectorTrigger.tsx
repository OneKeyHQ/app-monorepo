import { useCallback } from 'react';

import {
  Button,
  Dialog,
  Icon,
  Image,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import makeBlockieImageUri from '../../utils/makeBlockieImageUri';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';
import { DeriveTypeSelectorTrigger } from './DeriveTypeSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

export function AccountSelectorTriggerHome({ num }: { num: number }) {
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, indexedAccount, account },
    activeAccountName,
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { result: accountAvatar } = usePromiseResult(
    () =>
      makeBlockieImageUri(indexedAccount?.idHash ?? account?.address ?? '--'),
    [indexedAccount, account],
    { checkIsFocused: false },
  );

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
        })
      }
      maxWidth="$40"
    >
      <Image size="$6" borderRadius="$1">
        <Image.Source src={accountAvatar} />
        <Image.Fallback>
          <Skeleton w="$6" h="$6" />
        </Image.Fallback>
      </Image>

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

export function AccountSelectorTrigger({
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
