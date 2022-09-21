/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Box, SectionList } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IAccount, IWallet } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useRuntime,
} from '../../../../hooks/redux';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_ACCOUNT } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AccountSectionLoadingSkeleton } from '../../../Header/AccountSelectorChildren/RightAccountSection';
import { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import { CreateAccountButton } from '../CreateAccountButton';

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
  const { selectedNetworkId, selectedNetwork, preloadingCreateAccount } =
    accountSelectorInfo;
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

  // TODO define useScrollToActiveItem hooks
  const isScrolledRef = useRef(false);
  useLayoutEffect(() => {
    if (isScrolledRef.current || !activeWalletId || !data || !data.length) {
      return;
    }
    setTimeout(() => {
      try {
        let sectionIndex = 0;
        let itemIndex = 1;

        const index = data.findIndex((item) => {
          if (
            item.wallet?.id === activeWalletId &&
            item.networkId === activeNetworkId
          ) {
            const i = item.data.findIndex(
              (account) => account.id === activeAccountId,
            );
            if (i >= 0) {
              itemIndex = i + 1;
              return true;
            }
            if (item.data.length === 0 && !activeAccountId) {
              itemIndex = 1;
              return true;
            }
          }
          return false;
        });
        if (index >= 0) {
          sectionIndex = index;
        }

        if (sectionIndex === 0 && itemIndex < 5) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        sectionListRef?.current?.scrollToLocation?.({
          animated: true,
          sectionIndex, // starts from 0
          itemIndex, // starts from 1
        });
        isScrolledRef.current = true;
      } catch (error) {
        debugLogger.common.error(error);
      }
    }, ACCOUNT_SELECTOR_AUTO_SCROLL_ACCOUNT);
  }, [activeNetworkId, activeAccountId, activeWalletId, data]);

  useEffect(
    () => () => {
      lastDataCache = data;
    },
    [data],
  );
  useEffect(() => {
    (async () => {
      // TODO sort by active accounts first only if trigger by open modal
      const groupData: INetworkAccountSelectorAccountListSectionData[] = [];
      if (selectedNetworkId) {
        // TODO performance
        for (const wallet of wallets) {
          const accounts = await engine.getAccounts(
            wallet.accounts,
            selectedNetworkId,
          );
          groupData.push({
            wallet,
            networkId: selectedNetworkId,
            data: accounts || [],
          });
        }
        setData(groupData);
      }
    })();
  }, [engine, selectedNetworkId, wallets, refreshAccountSelectorTs]);

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

  return (
    <>
      <SectionList
        // TODO auto scroll to active item
        ref={sectionListRef}
        //    this.refs.foo.scrollToLocation({
        //       sectionIndex: sectionIndex,
        //       itemIndex: itemIndex
        //     });
        stickySectionHeadersEnabled
        sections={data}
        keyExtractor={(item: IAccount) => item.id}
        renderSectionHeader={({
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
                <CreateAccountButton
                  networkId={section?.networkId}
                  walletId={section?.wallet.id}
                  fullBleed
                  isLoading={isPreloadingCreate}
                />
              ) : null}

              <Box h={6} />
            </>
          );
        }}
        style={{ margin: 8 }}
      />
    </>
  );
}

export default AccountList;
