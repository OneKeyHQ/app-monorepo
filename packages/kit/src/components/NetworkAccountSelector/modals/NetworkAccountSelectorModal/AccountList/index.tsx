/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Dispatch, FC, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Collapse,
  Empty,
  SectionList,
  Text,
  ToastManager,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { IAccount } from '@onekeyhq/engine/src/types';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useDebounce,
  useNetwork,
  useWallet,
} from '../../../../../hooks';
import { isHwClassic } from '../../../../../utils/hardware';
import { scrollToSectionItem } from '../../../../WalletSelector';
import { AccountSectionLoadingSkeleton } from '../../../AccountSectionLoadingSkeleton';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_ACCOUNT } from '../../../consts';
import {
  isListAccountsSingleWalletMode,
  useAccountSelectorSectionData,
} from '../../../hooks/useAccountSelectorSectionData';
import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../../../hooks/useCreateAccountInWallet';

import ListItem from './ListItem';
import SectionHeader from './SectionHeader';

import type { useAccountSelectorInfo } from '../../../hooks/useAccountSelectorInfo';
import type { INetworkAccountSelectorAccountListSectionData } from '../../../hooks/useAccountSelectorSectionData';

export function searchAccount(
  accounts: INetworkAccountSelectorAccountListSectionData[],
  terms: string,
): INetworkAccountSelectorAccountListSectionData[] {
  const keywork = terms.toLowerCase();
  return accounts.map((item) => {
    const searchResult = item.data.filter(
      ({ name, address }) =>
        name.toLowerCase().includes(keywork) ||
        address.toLowerCase().includes(keywork),
    );
    return {
      ...item,
      data: searchResult,
    };
  });
}

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
  const { wallet } = useWallet({ walletId });

  if (
    network?.settings.enableOnClassicOnly &&
    !isHwClassic(wallet?.deviceType)
  ) {
    return (
      <Empty
        emoji="🔗"
        title={intl.formatMessage(
          {
            id: 'empty__chain_support_wallettype_only',
          },
          { 'walletType': '「Classic」' },
        )}
        flex={1}
        mt={8}
      />
    );
  }
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

function AccountListItemSeparator({
  section,
  dataSource,
}: {
  section: INetworkAccountSelectorAccountListSectionData;
  dataSource: INetworkAccountSelectorAccountListSectionData[];
}) {
  const isCollapsed =
    dataSource.find(
      (i) => i.derivationInfo?.template === section.derivationInfo?.template,
    )?.collapsed ?? false;
  if (isCollapsed) {
    return null;
  }
  return <Box h={2} />;
}

function DerivationSectionHeader({
  section,
  setDataSource,
}: {
  section: INetworkAccountSelectorAccountListSectionData;
  setDataSource: Dispatch<
    SetStateAction<INetworkAccountSelectorAccountListSectionData[]>
  >;
}) {
  const intl = useIntl();
  const { derivationInfo } = section;
  const title = useMemo(() => {
    if (!derivationInfo) {
      return null;
    }
    if (typeof derivationInfo.label === 'object' && derivationInfo.label?.id) {
      return intl.formatMessage({ id: derivationInfo.label.id });
    }
    return derivationInfo.label;
  }, [intl, derivationInfo]);
  if (!section.data.length) return null;
  return (
    // @ts-expect-error
    <Collapse
      backgroundColor="background-default"
      defaultCollapsed={false}
      arrowPosition="right"
      value={section.collapsed}
      trigger={
        <Text
          typography={{ sm: 'Subheading', md: 'Subheading' }}
          color="text-subdued"
        >
          {title}
        </Text>
      }
      triggerWrapperProps={{
        p: 0,
        px: '7px',
        borderRadius: 'lg',
        mb: 2,
      }}
      onCollapseChange={(isCollapsed) => {
        setDataSource((prev) => {
          const newDataSource = [...prev];
          const sectionIndex = newDataSource.findIndex(
            (item) =>
              item.derivationInfo?.template === derivationInfo?.template,
          );
          if (sectionIndex >= 0) {
            newDataSource[sectionIndex] = {
              ...newDataSource[sectionIndex],
              collapsed: isCollapsed,
            };
          }
          return newDataSource;
        });
      }}
    />
  );
}

function AccountList({
  accountSelectorInfo,
  searchValue,
  tokenShowBalance,
  multiSelect,
  singleSelect,
  hideAccountActions,
  selectedAccounts,
  setSelectedAccounts,
  onAccountsSelected,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  searchValue: string;
  tokenShowBalance?: Token;
  multiSelect?: boolean;
  singleSelect?: boolean;
  hideAccountActions?: boolean;
  selectedAccounts?: string[];
  setSelectedAccounts?: React.Dispatch<React.SetStateAction<string[]>>;
  onAccountsSelected?: (selectedAccounts: string[]) => void;
}) {
  const terms = useDebounce(searchValue, 500);
  const intl = useIntl();

  const {
    selectedNetworkId,
    selectedNetwork,
    selectedNetworkSettings,
    preloadingCreateAccount,
    isOpenDelay,
  } = accountSelectorInfo;
  const data = useAccountSelectorSectionData({
    accountSelectorInfo,
  });
  const [dataSource, setDataSource] = useState<
    INetworkAccountSelectorAccountListSectionData[]
  >([]);
  useEffect(() => {
    if (terms.length && data.length > 0) {
      setDataSource(searchAccount(data, terms));
    } else {
      setDataSource(data);
    }
  }, [data, terms]);

  const hasMoreDerivationPath = useMemo(() => data.length > 1, [data]);

  useEffect(() => {
    if (data.length > 0) {
      data.forEach((item) => {
        if (item.data.length > 0 && item.networkId) {
          backgroundApiProxy.serviceToken.batchFetchAccountBalances({
            walletId: item.wallet.id,
            networkId: item.networkId,
            accountIds: item.data.map((acc) => acc.id),
          });
        }
      });
    }
  }, [data]);

  const sectionListRef = useRef<any>(null);
  const {
    walletId: activeWalletId,
    accountId: activeAccountId,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const insets = useSafeAreaInsets();

  const isScrolledRef = useRef(false);
  const scrollToItem = useCallback(() => {
    if (isScrolledRef.current || !activeWalletId || !data || !data.length) {
      return;
    }
    scrollToSectionItem({
      sectionListRef,
      sectionData: data,
      isScrollToItem(
        item,
        section: INetworkAccountSelectorAccountListSectionData,
      ) {
        return (
          section.wallet?.id === activeWalletId &&
          section.networkId === activeNetworkId &&
          (!item || item?.id === activeAccountId)
        );
      },
      onScrolled() {
        isScrolledRef.current = true;
      },
      skipScrollIndex: 3,
      delay: 0,
    });
  }, [activeAccountId, activeNetworkId, activeWalletId, data]);
  const scrollToItemDebounced = useMemo(
    () =>
      debounce(scrollToItem, ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_ACCOUNT, {
        leading: false,
        trailing: true,
      }),
    [scrollToItem],
  );

  const getSectionMetaInfo = useCallback(
    ({
      section,
    }: {
      section: INetworkAccountSelectorAccountListSectionData;
    }) => {
      const isEmptySectionData = !section?.data?.length;
      const template = section.derivationInfo?.template;
      const isPreloadingCreate = Boolean(
        preloadingCreateAccount?.walletId &&
          preloadingCreateAccount?.networkId &&
          preloadingCreateAccount?.walletId === section?.wallet?.id &&
          preloadingCreateAccount?.networkId === section?.networkId &&
          (preloadingCreateAccount?.template && template
            ? preloadingCreateAccount?.template === template
            : true),
      );
      const isCollapsed = section.collapsed;
      const sectionIndex = dataSource.findIndex(
        (s) => s.derivationInfo?.template === template,
      );
      return {
        isEmptySectionData,
        isPreloadingCreate,
        template,
        isCollapsed,
        sectionIndex,
      };
    },
    [
      preloadingCreateAccount?.networkId,
      preloadingCreateAccount?.walletId,
      preloadingCreateAccount?.template,
      dataSource,
    ],
  );

  const getDataSourceInfo = useCallback(() => {
    const isEmptyDataSource = dataSource.every(
      (section) => !section.data.length,
    );

    return {
      isEmptyDataSource,
    };
  }, [dataSource]);

  const getSearchInfo = useCallback(() => {
    const { isEmptyDataSource } = getDataSourceInfo();
    const isEmptySearchData =
      isEmptyDataSource && data.every((section) => section.data.length);

    return {
      isEmptySearchData,
    };
  }, [data, getDataSourceInfo]);

  const ListItemSeparatorComponent = useCallback(
    (props) => <AccountListItemSeparator {...props} dataSource={dataSource} />,
    [dataSource],
  );

  // for performance: do NOT render UI if selector not open
  if (!isOpenDelay) {
    return null;
  }

  return (
    <SectionList
      initialNumToRender={20}
      // TODO auto scroll to active item
      ref={sectionListRef}
      //    this.refs.foo.scrollToLocation({
      //       sectionIndex: sectionIndex,
      //       itemIndex: itemIndex
      //     });
      stickySectionHeadersEnabled
      sections={dataSource}
      keyExtractor={(item: IAccount) => item.id}
      renderSectionHeader={({
        section,
      }: {
        section: INetworkAccountSelectorAccountListSectionData;
      }) => {
        if (isListAccountsSingleWalletMode) {
          if (hasMoreDerivationPath) {
            return (
              <DerivationSectionHeader
                section={section}
                setDataSource={setDataSource}
              />
            );
          }
          return null;
        }
        const { isEmptySectionData, isPreloadingCreate } = getSectionMetaInfo({
          section,
        });
        return (
          <SectionHeader
            wallet={section?.wallet}
            networkId={selectedNetworkId}
            emptySectionData={isEmptySectionData}
            isCreateLoading={isPreloadingCreate}
          />
        );
      }}
      renderItem={({
        item,
        section,
      }: {
        // eslint-disable-next-line react/no-unused-prop-types
        item: IAccount;
        // eslint-disable-next-line react/no-unused-prop-types
        section: INetworkAccountSelectorAccountListSectionData;
      }) => {
        const { isPreloadingCreate, isCollapsed } = getSectionMetaInfo({
          section,
        });
        if (
          isPreloadingCreate &&
          preloadingCreateAccount &&
          preloadingCreateAccount?.accountId === item.id
        ) {
          // footer should render AccountSectionLoadingSkeleton, so here render null
          return null;
        }

        if (isCollapsed) {
          return null;
        }
        return (
          <ListItem
            key={item.id}
            onLastItemRender={scrollToItemDebounced}
            account={item}
            wallet={section?.wallet}
            network={selectedNetwork}
            networkId={selectedNetworkId}
            networkSettings={selectedNetworkSettings}
            walletId={section?.wallet?.id}
            label={item.name}
            address={shortenAddress(item.displayAddress || item.address)}
            // TODO wait Overview implements all accounts balance
            balance={undefined}
            tokenShowBalance={tokenShowBalance}
            singleSelect={singleSelect}
            multiSelect={multiSelect}
            hideAccountActions={hideAccountActions}
            selectedAccounts={selectedAccounts}
            onAccountsSelected={onAccountsSelected}
            setSelectedAccounts={setSelectedAccounts}
          />
        );
      }}
      ItemSeparatorComponent={ListItemSeparatorComponent}
      renderSectionFooter={({
        section,
      }: {
        // eslint-disable-next-line react/no-unused-prop-types
        section: INetworkAccountSelectorAccountListSectionData;
      }) => {
        const { isEmptyDataSource } = getDataSourceInfo();
        const { isEmptySearchData } = getSearchInfo();

        const { isEmptySectionData, isPreloadingCreate, sectionIndex } =
          getSectionMetaInfo({
            section,
          });
        if (isEmptySearchData && sectionIndex === 0) {
          return (
            <Empty
              flex={1}
              mt={8}
              emoji="🔍"
              title={intl.formatMessage({
                id: 'content__no_results',
                defaultMessage: 'No Result',
              })}
            />
          );
        }
        return (
          <>
            {isPreloadingCreate ? (
              <AccountSectionLoadingSkeleton isLoading />
            ) : null}
            {/* only render EmptyState in first section footer */}
            {isEmptyDataSource &&
            isEmptySectionData &&
            !isPreloadingCreate &&
            sectionIndex === 0 ? (
              <EmptyAccountState
                walletId={section.wallet.id}
                networkId={section.networkId}
              />
            ) : null}
            {!isEmptySectionData && <Box h={8} />}
          </>
        );
      }}
      ListFooterComponent={<Box h={`${insets.bottom}px`} />}
      px={{ base: 2, md: 4 }}
    />
  );
}

export default AccountList;
