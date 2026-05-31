import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WebAccountPanelListItem } from './atoms/WebAccountPanelListItem';

const OTHERS_WALLET_ID = '$$others';

export interface IWebAccountPanelAccountListProps {
  onRequestClose: () => void;
}

export function WebAccountPanelAccountList({
  onRequestClose,
}: IWebAccountPanelAccountListProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const actions = useAccountSelectorActions();

  const focusedWallet = selectedAccount?.focusedWallet;
  const networkId = selectedAccount?.networkId;
  const deriveType = selectedAccount?.deriveType;

  // Mirror the data the "Connected wallet" account-selector modal renders, so
  // the user can switch connected accounts inline (no separate modal needed).
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!focusedWallet || !deriveType) {
        return undefined;
      }
      return backgroundApiProxy.serviceAccountSelector.buildAccountSelectorAccountsListData(
        {
          focusedWallet,
          selectedNetworkId: networkId,
          othersNetworkId: networkId,
          // Web dapp forces all-networks; without a linked (EVM) network the
          // builder leaves indexed rows' associateAccount unset, so they render
          // a blank address. PERPS_NETWORK_ID resolves the real EVM address,
          // matching the pre-PR AccountSelectorTriggerHome (linkNetworkId).
          linkedNetworkId: PERPS_NETWORK_ID,
          deriveType,
        },
      );
    },
    [focusedWallet, networkId, deriveType],
    { watchLoading: true },
  );

  const handleSelect = useCallback(
    async (item: IDBAccount | IDBIndexedAccount, isOthers: boolean) => {
      if (isOthers) {
        await actions.current.confirmAccountSelect({
          num: 0,
          indexedAccount: undefined,
          othersWalletAccount: item as IDBAccount,
          autoChangeToAccountMatchedNetworkId: networkId,
        });
      } else {
        await actions.current.confirmAccountSelect({
          num: 0,
          indexedAccount: item as IDBIndexedAccount,
          othersWalletAccount: undefined,
        });
      }
      onRequestClose();
    },
    [actions, networkId, onRequestClose],
  );

  // "Add external wallet" must open the connect-options flow (Continue with
  // Google/Apple or an installed extension wallet), not the account selector.
  // Close the panel once the modal is pushed so it doesn't linger behind it.
  const handleAddExternal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletOptions,
    });
    onRequestClose();
  }, [navigation, onRequestClose]);

  const sections = result?.sectionData ?? [];

  return (
    <YStack py="$5" w="100%">
      {isLoading && sections.length === 0 ? (
        <Stack py="$4" ai="center" jc="center" w="100%">
          <Spinner size="small" />
        </Stack>
      ) : (
        sections.flatMap((section) => {
          const isOthers =
            section.walletId === OTHERS_WALLET_ID ||
            accountUtils.isOthersWallet({ walletId: section.walletId });
          return section.data.map((item) => {
            const dbAccount = isOthers ? (item as IDBAccount) : undefined;
            const indexedAccount = isOthers
              ? undefined
              : (item as IDBIndexedAccount);
            const fullAddress = isOthers
              ? dbAccount?.address
              : indexedAccount?.associateAccount?.address;
            const address = fullAddress
              ? accountUtils.shortenAddress({
                  address: fullAddress,
                  leadingLength: 4,
                  trailingLength: 4,
                })
              : '';
            const isSelected = isOthers
              ? selectedAccount?.othersWalletAccountId === item.id
              : selectedAccount?.indexedAccountId === item.id;
            return (
              <WebAccountPanelListItem
                key={item.id}
                onPress={() => handleSelect(item, isOthers)}
                testID={`web-account-panel-account-${item.id}`}
                renderLeft={
                  <XStack ai="center" gap="$2" w="100%">
                    <AccountAvatar
                      size="$5"
                      borderRadius="$full"
                      dbAccount={dbAccount}
                      indexedAccount={indexedAccount}
                    />
                    <SizableText
                      size="$bodyMdMedium"
                      color="$text"
                      numberOfLines={1}
                      flexShrink={1}
                    >
                      {address}
                    </SizableText>
                  </XStack>
                }
                renderRight={
                  isSelected ? (
                    <Icon
                      name="CheckRadioSolid"
                      size="$5.5"
                      color="$iconActive"
                    />
                  ) : undefined
                }
              />
            );
          });
        })
      )}
      <Stack pt="$3" px="$5" w="100%">
        <Button
          size="small"
          variant="secondary"
          icon="PlusLargeOutline"
          onPress={handleAddExternal}
          testID="web-account-panel-add-external"
        >
          {intl.formatMessage({
            id: ETranslations.settings_add_external_wallet,
          })}
        </Button>
      </Stack>
    </YStack>
  );
}
