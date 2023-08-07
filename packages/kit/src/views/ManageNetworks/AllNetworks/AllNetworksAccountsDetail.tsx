import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { omit, pick } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  CheckBox,
  HStack,
  IconButton,
  Modal,
  Searchbar,
  SectionList,
  Token,
  Typography,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { setAllNetworksAccountsMap } from '../../../store/reducers/overview';
import { showAllNetworksHelp } from '../../Overlay/AllNetworksHelp';
import { strIncludes } from '../Listing/NetworkListEmpty';

import type { ListRenderItem } from 'react-native';

type Section = {
  title: LocaleIds;
  data: Network[];
};

const ItemSeparatorComponent = () => <Box h="6" />;

const NetworkItem: FC<{
  accounts: Account[];
  logoURI: string;
  name: string;
  isChecked: boolean;
  onChange: (value: boolean, accounts: Account[]) => void;
}> = ({ accounts, name, logoURI, isChecked, onChange }) => {
  const intl = useIntl();

  const desc = (() => {
    if (accounts.length === 0)
      return intl.formatMessage({ id: 'empty__no_account_title' });
    if (accounts?.length === 1)
      return shortenAddress(accounts[0]?.address ?? '');
    return intl.formatMessage(
      { id: 'form__str_addresses' },
      {
        0: accounts.length,
      },
    );
  })();

  const handleChangeMap = useCallback(
    (value: boolean) => {
      if (accounts?.length) {
        return onChange(value, accounts);
      }
    },
    [accounts, onChange],
  );

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
      <CheckBox isChecked={isChecked} onChange={handleChangeMap} />
    </HStack>
  );
};

export const AllNetworksAccountsDetail: FC = () => {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const { accountId } = useActiveWalletAccount();
  const [map, setMap] = useState<Record<string, Account[]>>({});
  const [result, setResult] = useState<{
    networks: Network[];
    selectedNetorkAccountsMap: Record<string, Account[]>;
    notSelectedNetworkAccountsMap: Record<string, Account[]>;
  }>();

  const close = useModalClose();

  useEffect(() => {
    backgroundApiProxy.serviceAllNetwork
      .getSelectableNetworkAccounts({
        accountId,
      })
      .then((res) => {
        if (res && res.selectedNetorkAccountsMap) {
          setMap(res.selectedNetorkAccountsMap);
        }
        setResult(res);
      })
      .catch((e) => {
        console.log(e);
      });
  }, [accountId]);

  const getAccountsByNetworkId = useCallback(
    (networkId: string) =>
      ({
        ...result?.selectedNetorkAccountsMap,
        ...result?.notSelectedNetworkAccountsMap,
      }[networkId] ?? []),
    [result],
  );

  const sections: Section[] = useMemo(() => {
    if (!result) return [];
    const selected = [];
    const available = [];
    for (const n of result.networks.filter((d) => {
      if (!getAccountsByNetworkId(d.id)?.length) {
        return false;
      }
      for (const v of Object.values(
        pick(d, 'name', 'shortName', 'id', 'symbol'),
      )) {
        if (strIncludes(String(v), search)) {
          return true;
        }
      }
      return false;
    })) {
      if (map[n.id]) {
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
  }, [result, map, search, getAccountsByNetworkId]);

  const handleChangeMap = useCallback(
    ({
      networkId,
      value,
      accounts,
    }: {
      networkId: string;
      value: boolean;
      accounts: Account[];
    }) => {
      if (!value) {
        setMap((m) => omit(m, networkId));
        return;
      }
      setMap((m) => ({ ...m, [networkId]: accounts }));
    },
    [],
  );

  const renderItem: ListRenderItem<Network> = useCallback(
    ({ item }) => (
      <NetworkItem
        name={item.name}
        logoURI={item.logoURI}
        accounts={getAccountsByNetworkId(item.id)}
        isChecked={!!map[item.id]}
        onChange={(value: boolean, accounts: Account[]) => {
          handleChangeMap({
            networkId: item.id,
            accounts,
            value,
          });
        }}
      />
    ),
    [map, handleChangeMap, getAccountsByNetworkId],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) =>
      search || !section.data?.length ? null : (
        <Typography.Subheading pb="3" pt="6" bg="background-default">
          {intl.formatMessage(
            { id: section.title },
            {
              0: section.data?.length ?? 0,
            },
          )}
        </Typography.Subheading>
      ),
    [intl, search],
  );

  const onConfirm = useCallback(() => {
    backgroundApiProxy.dispatch(
      setAllNetworksAccountsMap({
        accountId,
        data: map,
      }),
    );
    backgroundApiProxy.serviceOverview.refreshCurrentAccount();
    close();
  }, [map, accountId, close]);

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
          onPress={() => {
            showAllNetworksHelp();
          }}
        />
      }
      hideSecondaryAction
      onPrimaryActionPress={onConfirm}
    >
      <Searchbar
        w="full"
        value={search}
        mb="4"
        onChangeText={(text) => setSearch(text)}
        placeholder={intl.formatMessage({ id: 'content__search' })}
        onClear={() => setSearch('')}
      />
      <SectionList
        stickySectionHeadersEnabled={false}
        sections={sections}
        contentContainerStyle={{ flexGrow: 1 }}
        keyExtractor={(item: Network) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListHeaderComponent={
          <Alert
            title={intl.formatMessage({
              id: 'msg__tips_optimize_load_times_by_choosing_fewer_chains',
            })}
            dismiss
            alertType="info"
            customIconName="InformationCircleMini"
          />
        }
      />
    </Modal>
  );
};
