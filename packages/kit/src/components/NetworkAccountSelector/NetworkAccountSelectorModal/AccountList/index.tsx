/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useCallback, useMemo, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  SectionList,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IAccount } from '@onekeyhq/engine/src/types';

import { useActiveWalletAccount } from '../../../../hooks/redux';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_ACCOUNT } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AccountSectionLoadingSkeleton } from '../../../Header/AccountSelectorChildren/RightAccountSection';
import { scrollToSectionItem } from '../../../WalletSelector';
import { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import {
  INetworkAccountSelectorAccountListSectionData,
  isListAccountsSingleWalletMode,
  useAccountSelectorSectionData,
} from '../../hooks/useAccountSelectorSectionData';

import ListItem from './ListItem';
import SectionHeader from './SectionHeader';

function AccountList({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const {
    selectedNetworkId,
    selectedNetwork,
    preloadingCreateAccount,
    isOpenDelay,
  } = accountSelectorInfo;
  const data = useAccountSelectorSectionData({
    accountSelectorInfo,
  });
  const sectionListRef = useRef<any>(null);
  const {
    walletId: activeWalletId,
    accountId: activeAccountId,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const insets = useSafeAreaInsets();
  const intl = useIntl();

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
        stickySectionHeadersEnabled
        sections={data}
        keyExtractor={(item: IAccount) => item.id}
        renderSectionHeader={({
          section,
        }: {
          // eslint-disable-next-line react/no-unused-prop-types
          section: INetworkAccountSelectorAccountListSectionData;
        }) => {
          if (isListAccountsSingleWalletMode) {
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
                onLastItemRender={scrollToItemDebounced}
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
                <Empty
                  emoji="💳"
                  title={intl.formatMessage({ id: 'empty__no_account_desc' })}
                  flex={1}
                  mt={8}
                />
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
