import React, { FC, memo, useMemo } from 'react';

import { SectionList } from 'react-native';

import { Box, Skeleton, Typography } from '@onekeyhq/components';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { NetworkIcon } from '@onekeyhq/kit/src/views/ManageNetworks/Listing/NetworkIcon';

import { useAppSelector } from '../../../../hooks';

import AccountSectionItem, { AccountGroup } from './ItemSection';

export const AccountSectionLoadingSkeleton = React.memo(
  ({ isLoading }: { isLoading: boolean }) =>
    isLoading ? (
      <Box mx="2" borderRadius={12} p="2">
        <Skeleton shape="Body2" />
        <Skeleton shape="Body2" />
      </Box>
    ) : null,
);
AccountSectionLoadingSkeleton.displayName = 'AccountSectionLoadingSkeleton';

type AccountSectionProps = {
  activeAccounts: AccountGroup[];
  activeWallet: Wallet | null | undefined;
  activeNetwork: Network | null;
  activeAccount: AccountEngineType | null;
  refreshAccounts: (walletId: string, networkId: string) => void;
};

const RightAccountSection: FC<AccountSectionProps> = ({
  activeAccounts,
  activeWallet,
  activeNetwork,
  activeAccount,
  refreshAccounts,
}) => {
  const { preloadingCreateAccount } = useAppSelector((s) => s.accountSelector);
  const preloadingSkeleton = useMemo(
    () => (
      <AccountSectionLoadingSkeleton
        // isLoading={true}
        isLoading={
          !!preloadingCreateAccount &&
          activeWallet?.id === preloadingCreateAccount?.walletId &&
          activeNetwork?.id === preloadingCreateAccount?.networkId
        }
      />
    ),
    [activeNetwork?.id, activeWallet?.id, preloadingCreateAccount],
  );
  return (
    <SectionList
      testID="AccountSelectorChildren-AccountSection-SectionList"
      stickySectionHeadersEnabled
      sections={activeAccounts}
      SectionSeparatorComponent={(section) => (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        <Box h={section?.leadingItem ? 2 : 0} />
      )}
      ListFooterComponent={preloadingSkeleton}
      ItemSeparatorComponent={() => <Box h={2} />}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      renderItem={({ item, section }) =>
        preloadingCreateAccount &&
        preloadingCreateAccount.accountId === item.id ? (
          <Box mt={-2} />
        ) : (
          <AccountSectionItem
            item={item}
            section={section}
            activeWallet={activeWallet}
            activeNetwork={activeNetwork}
            activeAccount={activeAccount}
            refreshAccounts={refreshAccounts}
          />
        )
      }
      renderSectionHeader={({ section: { title } }) =>
        activeAccounts.length > 1 ? (
          <Box
            px={4}
            p={2}
            bg="surface-subdued"
            flexDirection="row"
            alignItems="center"
          >
            <NetworkIcon network={title} size={4} mr={2} />
            <Typography.Subheading color="text-subdued">
              {title.shortName}
            </Typography.Subheading>
          </Box>
        ) : null
      }
    />
  );
};

export default memo(RightAccountSection);
