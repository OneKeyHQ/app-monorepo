import { useCallback } from 'react';

import {
  Button,
  Dialog,
  Icon,
  ScrollView,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { AccountAvatar } from '../AccountAvatar';

import { AccountSelectorDialog } from './AccountSelectorDialog';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';
import { DeriveTypeSelectorTrigger } from './DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerLegacy } from './NetworkSelectorTrigger';

export function AccountSelectorTriggerHome({ num }: { num: number }) {
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
          sceneName: EAccountSelectorSceneName.home,
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
