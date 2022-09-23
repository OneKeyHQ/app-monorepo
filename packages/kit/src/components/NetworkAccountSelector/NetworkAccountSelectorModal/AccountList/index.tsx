/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  SectionList,
  Text,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IAccount, IWallet } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useRuntime,
} from '../../../../hooks/redux';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_ACCOUNT } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AccountSectionLoadingSkeleton } from '../../../Header/AccountSelectorChildren/RightAccountSection';
import { scrollToSectionItem } from '../../../WalletSelector';
import { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';

import ListItem from './ListItem';
import SectionHeader from './SectionHeader';

type INetworkAccountSelectorAccountListSectionData = {
  wallet: IWallet;
  networkId: string;
  data: IAccount[];
};

let lastDataCache: INetworkAccountSelectorAccountListSectionData[] = [];

function AccountList({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const { wallets } = useRuntime();
  const {
    selectedNetworkId,
    selectedNetwork,
    preloadingCreateAccount,
    isOpenDelay,
    selectedWallet,
    // selectedWalletId,
  } = accountSelectorInfo;
  const { engine } = backgroundApiProxy;
  const [data, setData] =
    useState<INetworkAccountSelectorAccountListSectionData[]>(lastDataCache);
  const sectionListRef = useRef<any>(null);
  const { refreshAccountSelectorTs } = useAppSelector((s) => s.refresher);
  const {
    walletId: activeWalletId,
    accountId: activeAccountId,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const insets = useSafeAreaInsets();
  const intl = useIntl();

  const isListAccountsOnlySingleWallet = true;
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
      delay: ACCOUNT_SELECTOR_AUTO_SCROLL_ACCOUNT,
      // delay: 0,
    });
  }, [activeAccountId, activeNetworkId, activeWalletId, data]);
  const isMounted = useIsMounted();
  useEffect(
    () => () => {
      // TODO cache is error in android, change HD wallet to imported wallet
      lastDataCache = data;
    },
    [data],
  );
  const buildData = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ts = refreshAccountSelectorTs; // keep this for refresh deps
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const acc = activeAccountId; // keep this for refresh deps
    const groupData: INetworkAccountSelectorAccountListSectionData[] = [];
    if (isMounted.current && selectedNetworkId && isOpenDelay) {
      debugLogger.accountSelector.info(
        'rebuild NetworkAccountSelector accountList data',
        {
          refreshAccountSelectorTs,
          isOpenDelay,
          selectedNetworkId,
          selectedWalletId: selectedWallet?.id,
          activeAccountId,
        },
      );
      const pushWalletAccountsData = async (wallet: IWallet) => {
        const accounts = await engine.getAccounts(
          wallet.accounts,
          selectedNetworkId,
        );
        if (accounts.length) {
          // @ts-ignore
          accounts[accounts.length - 1].$isLastItem = true;
        }
        groupData.push({
          wallet,
          networkId: selectedNetworkId,
          data: accounts || [],
        });
      };
      if (isListAccountsOnlySingleWallet) {
        if (selectedWallet) {
          await pushWalletAccountsData(selectedWallet);
        }
      } else {
        let walletIndex = 0;
        for (const wallet of wallets) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          walletIndex += 1;
          await pushWalletAccountsData(wallet);
        }
      }
      setData(groupData);
    }
  }, [
    activeAccountId,
    refreshAccountSelectorTs,
    isMounted,
    selectedNetworkId,
    isOpenDelay,
    wallets,
    isListAccountsOnlySingleWallet,
    engine,
    selectedWallet,
  ]);
  const buildDataDebounced = useMemo(
    () =>
      debounce(buildData, 150, {
        leading: false,
        trailing: true,
      }),
    [buildData],
  );
  useEffect(() => {
    buildDataDebounced();
  }, [buildDataDebounced]);

  const getSectionMetaInfo = useCallback(
    ({
      section,
    }: {
      section: INetworkAccountSelectorAccountListSectionData;
    }) => {
      const isEmptySectionData = !section?.data?.length;
      const isPreloadingCreate = Boolean(
        preloadingCreateAccount?.walletId &&
          preloadingCreateAccount?.networkId &&
          preloadingCreateAccount?.walletId === section?.wallet?.id &&
          preloadingCreateAccount?.networkId === section?.networkId,
      );
      return {
        isEmptySectionData,
        isPreloadingCreate,
      };
    },
    [preloadingCreateAccount?.networkId, preloadingCreateAccount?.walletId],
  );

  // for performance: do NOT render UI if selector not open
  if (!isOpenDelay) {
    return null;
  }

  return (
    <>
      <SectionList
        initialNumToRender={20}
        // TODO auto scroll to active item
        ref={sectionListRef}
        //    this.refs.foo.scrollToLocation({
        //       sectionIndex: sectionIndex,
        //       itemIndex: itemIndex
        //     });
        ListEmptyComponent={
          <Empty
            emoji="💳"
            title={intl.formatMessage({ id: 'empty__no_account_title' })}
            subTitle={intl.formatMessage({ id: 'empty__no_account_desc' })}
            mt={16}
          />
        }
        stickySectionHeadersEnabled
        sections={data}
        keyExtractor={(item: IAccount) => item.id}
        renderSectionHeader={({
          section,
        }: {
          // eslint-disable-next-line react/no-unused-prop-types
          section: INetworkAccountSelectorAccountListSectionData;
        }) => {
          if (isListAccountsOnlySingleWallet) {
            return null;
          }
          const { isEmptySectionData, isPreloadingCreate } = getSectionMetaInfo(
            { section },
          );
          return (
            <>
              <SectionHeader
                wallet={section?.wallet}
                networkId={selectedNetworkId}
                emptySectionData={isEmptySectionData}
                isCreateLoading={isPreloadingCreate}
              />
            </>
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
          const { isPreloadingCreate } = getSectionMetaInfo({ section });
          if (
            isPreloadingCreate &&
            preloadingCreateAccount &&
            preloadingCreateAccount?.accountId === item.id
          ) {
            // footer should render AccountSectionLoadingSkeleton, so here render null
            return null;
          }
          return (
            <>
              <ListItem
                key={item.id}
                onLastItemRender={scrollToItem}
                account={item}
                wallet={section?.wallet}
                network={selectedNetwork}
                networkId={selectedNetworkId}
                walletId={section?.wallet?.id}
                label={item.name}
                // TODO uppercase address
                address={shortenAddress(item.address)}
                // TODO wait Overview implements all accounts balance
                balance={undefined}
              />
            </>
          );
        }}
        ItemSeparatorComponent={() => <Box h={2} />}
        renderSectionFooter={({
          section,
        }: {
          // eslint-disable-next-line react/no-unused-prop-types
          section: INetworkAccountSelectorAccountListSectionData;
        }) => {
          const { isEmptySectionData, isPreloadingCreate } = getSectionMetaInfo(
            { section },
          );
          return (
            <>
              {isPreloadingCreate ? (
                <AccountSectionLoadingSkeleton isLoading />
              ) : null}

              {isEmptySectionData && !isPreloadingCreate ? (
                <Text typography="Body2" color="text-subdued" px={2}>
                  {intl.formatMessage({ id: 'empty__no_account_title' })}
                </Text>
              ) : null}

              <Box h={6} />
            </>
          );
        }}
        ListFooterComponent={<Box h={`${insets.bottom}px`} />}
        p={2}
      />
    </>
  );
}

export default AccountList;
