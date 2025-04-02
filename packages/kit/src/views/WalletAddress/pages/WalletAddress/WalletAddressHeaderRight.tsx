import { memo, useContext } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HeaderButtonGroup,
  Popover,
  Switch,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAllNetworksPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { WalletAddressContext } from './WalletAddressContext';

const Content = ({
  walletId,
  accountId,
  indexedAccountId,
}: {
  walletId: string;
  accountId?: string;
  indexedAccountId?: string;
}) => {
  const intl = useIntl();
  const { closePopover } = usePopoverContext();
  const [{ showEnabledNetworksOnlyInCopyAddressPanel }, setAllNetworksPersist] =
    useAllNetworksPersistAtom();

  const navigation = useAppNavigation();
  const { refreshLocalData, allNetworksStateInit } =
    useContext(WalletAddressContext);
  return (
    <YStack py="$2.5">
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.network_show_enabled_only,
        })}
      >
        <Switch
          value={showEnabledNetworksOnlyInCopyAddressPanel}
          onChange={(value) => {
            setAllNetworksPersist((v) => ({
              ...v,
              showEnabledNetworksOnlyInCopyAddressPanel: value,
            }));
          }}
        />
      </ListItem>
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.network_enable_more,
        })}
        onPress={async () => {
          await closePopover?.();
          navigation.pushModal(EModalRoutes.ChainSelectorModal, {
            screen: EChainSelectorPages.AllNetworksManager,
            params: {
              accountId,
              walletId,
              indexedAccountId,
              onNetworksChanged: async () => {
                setTimeout(() => {
                  allNetworksStateInit.current = false;
                  refreshLocalData();
                }, 1000);
              },
            },
          });
        }}
      >
        <ListItem.IconButton
          icon="ChevronRightSmallOutline"
          iconColor="$iconSubdued"
        />
      </ListItem>
    </YStack>
  );
};

function WalletAddressHeaderRight({
  walletId,
  accountId,
  indexedAccountId,
}: {
  walletId: string;
  accountId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();

  return (
    <HeaderButtonGroup>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_settings })}
        renderTrigger={
          <Button
            variant="tertiary"
            icon="SliderHorOutline"
            iconColor="$iconSubdued"
            size="medium"
          />
        }
        renderContent={
          <Content
            walletId={walletId}
            accountId={accountId}
            indexedAccountId={indexedAccountId}
          />
        }
      />
    </HeaderButtonGroup>
  );
}

export default memo(WalletAddressHeaderRight);
