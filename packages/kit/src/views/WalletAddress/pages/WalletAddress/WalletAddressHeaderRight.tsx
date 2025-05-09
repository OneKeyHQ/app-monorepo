import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderButtonGroup,
  IconButton,
  Popover,
  Switch,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAllNetworksPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';

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
  return (
    <YStack py="$2.5">
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.network_show_enabled_only,
        })}
        titleProps={{
          $gtMd: {
            size: '$bodyMdMedium',
          },
        }}
      >
        <Switch
          size="small"
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
        titleProps={{
          $gtMd: {
            size: '$bodyMdMedium',
          },
        }}
        onPress={async () => {
          await closePopover?.();
          navigation.pushModal(EModalRoutes.ChainSelectorModal, {
            screen: EChainSelectorPages.AllNetworksManager,
            params: {
              accountId,
              walletId,
              indexedAccountId,
              onNetworksChanged: async () => {
                appEventBus.emit(
                  EAppEventBusNames.EnabledNetworksChanged,
                  undefined,
                );
              },
            },
          });
        }}
      >
        <ListItem.DrillIn color="$iconSubdued" />
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
          <IconButton variant="tertiary" icon="SliderHorOutline" />
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
