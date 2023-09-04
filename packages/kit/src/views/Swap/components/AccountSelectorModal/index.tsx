import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  Icon,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Searchbar,
  Select,
  Skeleton,
  Text,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { LazyDisplayView } from '../../../../components/LazyDisplayView';
import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import { WalletAvatarPro } from '../../../../components/WalletSelector/WalletAvatar';
import {
  useDebounce,
  useNativeTokenBalance,
  useNetwork,
  useNetworkSimple,
} from '../../../../hooks';
import { useAppSelector, useRuntime } from '../../../../hooks/redux';
import { getWalletName } from '../../../../hooks/useWalletName';
import ExternalAccountImg from '../../../ExternalAccount/components/ExternalAccountImg';
import { formatAmount } from '../../utils';

type WalletSelectDropdownProps = {
  wallet?: Wallet;
  setWalletId?: (walletId: string) => void;
};
const WalletSelectDropdown: FC<WalletSelectDropdownProps> = ({
  wallet: selectedWallet,
  setWalletId,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { wallets } = useRuntime();
  const data = useMemo(() => {
    const items = wallets
      .filter((o) => o.type !== 'watching')
      .map((wallet) => ({
        label: getWalletName({ wallet, intl }) || '-',
        value: wallet.id,
        wallet,
      }));
    return items;
  }, [wallets, intl]);

  return (
    <Box pb={2}>
      <Box flexDirection="row" alignItems="center">
        <Select
          title={intl.formatMessage({ id: 'title__wallets' })}
          footer={null}
          value={selectedWallet?.id}
          activatable={false}
          containerProps={{
            flex: 1,
            alignItems: 'flex-start',
          }}
          options={data}
          renderTrigger={({ visible, onPress }) => (
            <Pressable onPress={onPress}>
              {({ isHovered, isPressed }) => {
                const getBg = () => {
                  if (visible) {
                    return 'surface-selected';
                  }
                  if (isPressed) {
                    return 'surface-pressed';
                  }
                  if (isHovered) {
                    return 'surface-hovered';
                  }
                  return undefined;
                };
                return (
                  <Box
                    flexDirection="row"
                    alignItems="center"
                    maxW="240px"
                    p={2}
                    rounded="xl"
                    bgColor={getBg()}
                  >
                    {selectedWallet ? (
                      <WalletAvatarPro
                        wallet={selectedWallet}
                        size="xs"
                        devicesStatus={undefined}
                      />
                    ) : null}
                    <Text
                      typography="Body2Strong"
                      ml={2}
                      mr={1}
                      color="text-subdued"
                      isTruncated
                    >
                      {getWalletName({
                        wallet: selectedWallet,
                        intl,
                      })}
                    </Text>
                    <Box>
                      <Icon
                        name="ChevronUpDownMini"
                        color="icon-subdued"
                        size={20}
                      />
                    </Box>
                  </Box>
                );
              }}
            </Pressable>
          )}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          renderItem={(item, isActive, onChange) => (
            <Pressable
              key={item.value}
              onPress={() => {
                // call internal select onChange to make sure selector closed
                onChange?.(item.value, item);
                // @ts-ignore
                setWalletId?.(item.value);
              }}
            >
              {({ isHovered, isPressed }) => {
                const getBgColor = () => {
                  if (isPressed) {
                    return 'surface-pressed';
                  }
                  if (isHovered) {
                    return 'surface-hovered';
                  }
                };
                return (
                  <Box
                    p={2}
                    pr={{ base: 3, md: 2 }}
                    flexDirection="row"
                    alignItems="center"
                    bgColor={getBgColor()}
                    rounded="xl"
                  >
                    {
                      // @ts-expect-error
                      item.wallet ? (
                        <WalletAvatarPro
                          // @ts-expect-error
                          wallet={item.wallet}
                          devicesStatus={undefined}
                          size={isVerticalLayout ? 'lg' : 'xs'}
                        />
                      ) : null
                    }

                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      flex={1}
                      mx={3}
                    >
                      {item.label}
                    </Text>
                    {isActive ? (
                      <Icon
                        name={isVerticalLayout ? 'CheckOutline' : 'CheckMini'}
                        size={isVerticalLayout ? 24 : 20}
                        color="interactive-default"
                      />
                    ) : null}
                  </Box>
                );
              }}
            </Pressable>
          )}
        />
      </Box>
    </Box>
  );
};

type HeaderDescriptionProps = {
  networkId?: string;
};

const HeaderDescription: FC<HeaderDescriptionProps> = ({ networkId }) => {
  const network = useNetworkSimple(networkId);
  return (
    <Box flexDirection="row">
      {network?.logoURI ? (
        <Image
          source={{ uri: network?.logoURI }}
          size={4}
          borderRadius="full"
          mr={2}
        />
      ) : null}
      <Typography.Caption color="text-subdued">
        {network?.name || '-'}
      </Typography.Caption>
    </Box>
  );
};

type AccountViewProps = {
  account: Account;
  networkId?: string;
  onSelect?: (acc: Account) => void;
  isActive?: boolean;
};

const AccountView: FC<AccountViewProps> = ({
  account,
  networkId,
  onSelect,
  isActive,
}) => {
  const network = useNetworkSimple(networkId);
  const nativeBalance = useNativeTokenBalance(network?.id, account.id);
  const activeExternalWalletName = useAppSelector(
    (s) => s.general.activeExternalWalletName,
  );
  const hiddenAddress = isLightningNetworkByNetworkId(networkId);
  const onPress = useCallback(() => {
    onSelect?.(account);
  }, [account, onSelect]);
  return (
    <Pressable onPress={onPress}>
      {({ isHovered, isPressed }) => {
        const getBgColor = () => {
          if (isActive) {
            return 'surface-selected';
          }
          if (isPressed) {
            return 'surface-pressed';
          }
          if (isHovered) {
            return 'surface-hovered';
          }
          return 'transparent';
        };
        return (
          <Box
            flexDirection="row"
            alignItems="center"
            p={2}
            pr={1.5}
            rounded="xl"
            bgColor={getBgColor()}
          >
            <ExternalAccountImg
              mr={3}
              accountId={account?.id}
              walletName={isActive ? activeExternalWalletName : null}
            />
            <Box flex={1} mr={3}>
              <Text typography="Body2Strong" isTruncated numberOfLines={1}>
                {account.name}
              </Text>
              <Box flexDirection="row">
                <Text typography="Body2" color="text-subdued">
                  {hiddenAddress
                    ? null
                    : shortenAddress(account.displayAddress || account.address)}
                </Text>
                {!hiddenAddress && (
                  <Box
                    w={1}
                    h={1}
                    m={2}
                    bgColor="icon-disabled"
                    rounded="full"
                  />
                )}
                {nativeBalance ? (
                  <>
                    <Text typography="Body2" color="text-subdued" isTruncated>
                      {formatAmount(nativeBalance, 6)}
                    </Text>
                    <Text typography="Body2" color="text-subdued" ml="2px">
                      {network?.symbol.toUpperCase()}
                    </Text>
                  </>
                ) : (
                  <Skeleton shape="Body2" />
                )}
              </Box>
            </Box>
          </Box>
        );
      }}
    </Pressable>
  );
};

type AccountsListProps = {
  activeAccountId?: string;
  accounts?: Account[];
  networkId?: string;
  searchValue: string;
  onSelect?: (acc: Account) => void;
};

const AccountsList: FC<AccountsListProps> = ({
  activeAccountId,
  accounts,
  networkId,
  searchValue,
  onSelect,
}) => {
  const terms = useDebounce(searchValue, 500);
  const data = useMemo(() => {
    if (!accounts) {
      return;
    }
    const keywork = terms.toLowerCase();
    return accounts?.filter(({ name, address }) => {
      const result =
        name.toLowerCase().includes(keywork) ||
        address.toLowerCase().includes(keywork);
      return result;
    });
  }, [accounts, terms]);
  return (
    <ScrollView>
      <VStack space="1">
        {data?.map((account) => (
          <AccountView
            key={account.id}
            account={account}
            isActive={account.id === activeAccountId}
            networkId={networkId}
            onSelect={onSelect}
          />
        ))}
      </VStack>
    </ScrollView>
  );
};

type EmptyAccountStateProps = {
  walletId: string;
  networkId: string;
};

const EmptyAccountState: FC<EmptyAccountStateProps> = ({
  walletId,
  networkId,
}) => {
  const intl = useIntl();

  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    walletId,
    networkId,
  });
  const { network } = useNetwork({ networkId });
  return (
    <Empty
      emoji="💳"
      title={intl.formatMessage({ id: 'empty__no_account_title' })}
      subTitle={intl.formatMessage({
        id: 'empty__no_account_desc',
      })}
      handleAction={() => {
        if (isCreateAccountSupported) {
          createAccount();
        } else {
          ToastManager.show({
            title: intl.formatMessage(
              {
                id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
              },
              { 0: network?.shortName },
            ),
          });
        }
      }}
      actionTitle={intl.formatMessage({ id: 'action__create_account' })}
      actionProps={{
        leftIconName: 'PlusOutline',
      }}
      flex={1}
      mt={8}
    />
  );
};

type AccountSelectorModalProps = ComponentProps<typeof Modal> & {
  networkId?: string;
  accountId?: string;
  excluded?: { networkId?: string; accountId?: string };
  onSelect?: (acc: Account) => void;
};

const AccountSelectorModal: FC<AccountSelectorModalProps> = ({
  networkId,
  accountId,
  onSelect,
  excluded,
  ...rest
}) => {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<Account[]>();
  const wallets = useAppSelector((s) => s.runtime.wallets);
  const [walletId, setWalletId] = useState(() => {
    if (accountId) {
      for (let i = 0; i < wallets.length; i += 1) {
        const item = wallets[i];
        if (item.accounts.includes(accountId)) {
          return item.id;
        }
      }
    }
    return wallets[0]?.id;
  });

  const wallet = useMemo(
    () => wallets.find((item) => item.id === walletId),
    [wallets, walletId],
  );

  useEffect(() => {
    async function main() {
      let data = await backgroundApiProxy.engine.getAccounts(
        wallet?.accounts ?? [],
        networkId,
      );
      if (accountId && networkId && excluded) {
        if (excluded.accountId && excluded.networkId) {
          const current = await backgroundApiProxy.engine.getAccount(
            excluded.accountId,
            excluded.networkId,
          );
          data = data.filter((acc) => acc.address !== current.address);
        }
      }
      if (isLightningNetworkByNetworkId(networkId)) {
        const lnurlMap =
          await backgroundApiProxy.serviceLightningNetwork.batchGetLnUrlByAccounts(
            {
              networkId: networkId ?? '',
              accounts: data,
            },
          );
        data = data.map((acc) => {
          const lnurl = lnurlMap[acc.id];
          return {
            ...acc,
            address: lnurl,
          };
        });
      }
      setAccounts(data);
    }
    main();
  }, [wallet, networkId, accountId, wallets, excluded]);

  return (
    <Modal
      height="560px"
      header={intl.formatMessage({ id: 'title__accounts' })}
      headerDescription={<HeaderDescription networkId={networkId} />}
      {...rest}
    >
      <LazyDisplayView>
        <Box flex="1">
          <Box>
            <WalletSelectDropdown wallet={wallet} setWalletId={setWalletId} />
            <Searchbar
              w="full"
              value={search}
              placeholder={intl.formatMessage({ id: 'form__search' })}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
            />
          </Box>
          <Box flex="1" mt="2">
            {accounts && accounts?.length > 0 ? (
              <AccountsList
                accounts={accounts}
                networkId={networkId}
                searchValue={search}
                onSelect={onSelect}
                activeAccountId={accountId}
              />
            ) : (
              <EmptyAccountState
                walletId={walletId}
                networkId={networkId ?? ''}
              />
            )}
          </Box>
        </Box>
      </LazyDisplayView>
    </Modal>
  );
};

export default AccountSelectorModal;
