import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { pick } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Center,
  CheckBox,
  HStack,
  IconButton,
  Modal,
  Searchbar,
  SectionList,
  Spinner,
  ToastManager,
  Token,
  Typography,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../hooks';
import {
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { setHideAllNetworksSelectNetworkTips } from '../../../store/reducers/settings';
import { showAllNetworksHelp } from '../../Overlay/AllNetworksHelp';
import { allNetworksSelectAccount } from '../hooks';
import { NetworkListEmpty, strIncludes } from '../Listing/NetworkListEmpty';

import type { NetworkWithAccounts } from '../types';
import type { ListRenderItem } from 'react-native';

type Section = {
  title: LocaleIds;
  data: NetworkWithAccounts[];
};

const ItemSeparatorComponent = () => <Box h="6" />;

const NetworkItem: FC<{
  accounts: Account[];
  logoURI: string;
  name: string;
  isChecked: boolean;
  networkId: string;
  onChange: (params: {
    networkId: string;
    value: boolean;
    accounts: Account[];
  }) => void;
}> = ({ accounts, name, logoURI, isChecked, onChange, networkId }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { wallet } = useActiveWalletAccount();

  const desc = useMemo(() => {
    if (accounts?.length === 1)
      return shortenAddress(accounts[0]?.address ?? '');

    return intl.formatMessage(
      { id: 'form__str_addresses' },
      {
        0: accounts.length,
      },
    );
  }, [accounts, intl]);

  const handleChangeMap = useCallback(
    (value: boolean) =>
      onChange({
        networkId,
        value,
        accounts,
      }),
    [accounts, onChange, networkId],
  );

  const copyAddress = useCallback(
    ({ account, network }: { account: Account; network: Network }) => {
      if (!account) {
        return;
      }
      const { address, displayAddress, template } = account;
      if (wallet?.type === 'hw') {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.ReceiveToken,
            params: {
              address,
              displayAddress,
              wallet,
              network,
              account,
              template,
            },
          },
        });
      } else {
        if (!displayAddress && !address) return;
        copyToClipboard(displayAddress ?? address ?? '');
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__address_copied' }),
        });
      }
    },
    [intl, wallet, navigation],
  );

  const onCopyAddress = useCallback(() => {
    allNetworksSelectAccount({
      networkId,
      accounts,
    }).then((res) => {
      if (res) {
        copyAddress(res);
      }
    });
  }, [copyAddress, networkId, accounts]);

  return (
    <HStack>
      <Token
        flex="1"
        token={{
          logoURI,
          name,
          symbol: desc,
        }}
        showInfo
      />
      <Center mr="3">
        <IconButton
          name="Square2StackOutline"
          iconSize={20}
          type="plain"
          onPress={onCopyAddress}
        />
      </Center>
      <Center>
        <CheckBox isChecked={isChecked} onChange={handleChangeMap} />
      </Center>
    </HStack>
  );
};

const SelectNetworkTips = () => {
  const intl = useIntl();
  const hideAllNetworksSelectNetworkTips =
    useAppSelector((s) => s.settings.hideAllNetworksSelectNetworkTips) ?? false;

  return hideAllNetworksSelectNetworkTips ? null : (
    <Box mt="6">
      <Alert
        title={intl.formatMessage({
          id: 'msg__tips_optimize_load_times_by_choosing_fewer_chains',
        })}
        dismiss
        alertType="info"
        customIconName="InformationCircleMini"
        onDismiss={() => {
          backgroundApiProxy.dispatch(
            setHideAllNetworksSelectNetworkTips(true),
          );
        }}
      />
    </Box>
  );
};

const SectionHeader: FC<{
  title: LocaleIds;
  length: number;
  search: string;
}> = ({ title, search, length }) => {
  const intl = useIntl();

  if (!length) {
    return null;
  }
  return (
    <Box pb="3" pt={6} bg="background-default">
      {search ? null : (
        <Typography.Subheading>
          {intl.formatMessage(
            { id: title },
            {
              0: length ?? 0,
            },
          )}
        </Typography.Subheading>
      )}
    </Box>
  );
};

export const AllNetworksAccountsDetail: FC = () => {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const { accountId } = useActiveWalletAccount();
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<NetworkWithAccounts[]>();

  const close = useModalClose();

  useEffect(() => {
    backgroundApiProxy.serviceAllNetwork
      .getSelectableNetworkAccounts({
        accountId,
      })
      .then((res) => {
        setNetworks(res);
      })
      .finally(() => {
        setTimeout(() => {
          setLoading(false);
        }, 500);
      });
  }, [accountId]);

  const filteredNetworks = useMemo(() => {
    if (!networks) {
      return [];
    }
    if (!search) {
      return networks;
    }
    return networks.filter((d) => {
      for (const v of Object.values(
        pick(d, 'name', 'shortName', 'id', 'symbol'),
      )) {
        if (strIncludes(String(v), search)) {
          return true;
        }
      }
      return false;
    });
  }, [networks, search]);

  const sections: Section[] = useMemo(() => {
    if (!networks) return [];
    const selected = [];
    const available = [];
    for (const n of filteredNetworks) {
      if (n.selected) {
        selected.push(n);
      } else {
        available.push(n);
      }
    }
    return [
      {
        title: 'form__selected_str_uppercase',
        data: selected,
      },
      {
        title: 'form__not__selected_str_uppercase',
        data: available,
      },
    ];
  }, [networks, filteredNetworks]);

  const handleChangeMap = useCallback(
    ({ networkId }: { networkId: string }) => {
      setNetworks(
        (ns) =>
          ns?.map((n) =>
            n.id === networkId ? { ...n, selected: !n.selected } : n,
          ) ?? [],
      );
    },
    [],
  );

  const renderItem: ListRenderItem<NetworkWithAccounts> = useCallback(
    ({ item }) => (
      <NetworkItem
        name={item.name}
        logoURI={item.logoURI}
        accounts={item.accounts}
        isChecked={item.selected}
        networkId={item.id}
        onChange={handleChangeMap}
      />
    ),
    [handleChangeMap],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <SectionHeader
        title={section.title}
        length={section.data.length}
        search={search}
      />
    ),
    [search],
  );

  const onConfirm = useCallback(() => {
    backgroundApiProxy.serviceAllNetwork.updateAllNetworksAccountsMap({
      accountId,
      selectedNetworkAccounts: networks?.filter((n) => n.selected) ?? [],
    });
    close();
  }, [accountId, close, networks]);

  const clearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const keyExtractor = useCallback((item: NetworkWithAccounts) => item.id, []);

  const listHeader = useMemo(() => {
    if (filteredNetworks?.length) {
      return <SelectNetworkTips />;
    }
    return <NetworkListEmpty />;
  }, [filteredNetworks?.length]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__select_networks' })}
      height="560px"
      rightContent={
        <IconButton
          type="plain"
          size="lg"
          circle
          name="QuestionMarkCircleOutline"
          onPress={showAllNetworksHelp}
        />
      }
      hideSecondaryAction
      onPrimaryActionPress={onConfirm}
      primaryActionTranslationId="action__done"
    >
      {loading ? (
        <Spinner size="lg" />
      ) : (
        <>
          <Searchbar
            w="full"
            value={search}
            onChangeText={setSearch}
            placeholder={intl.formatMessage({ id: 'content__search' })}
            onClear={clearSearch}
          />
          <SectionList
            stickySectionHeadersEnabled={false}
            sections={sections}
            contentContainerStyle={{ flexGrow: 1 }}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ItemSeparatorComponent={ItemSeparatorComponent}
            ListHeaderComponent={listHeader}
          />
        </>
      )}
    </Modal>
  );
};
