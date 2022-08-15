import React, { FC, memo } from 'react';

import { SectionList } from 'react-native';

import { Box, Skeleton, Typography } from '@onekeyhq/components';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { NetworkIcon } from '@onekeyhq/kit/src/views/ManageNetworks/Listing/NetworkIcon';

import AccountSectionItem, { AccountGroup } from './ItemSection';

const LoadingSkeleton: FC<{ isLoading: boolean }> = ({ isLoading }) =>
  isLoading ? (
    <Box mx="2" borderRadius={12} p="2">
      <Skeleton shape="Body2" />
      <Skeleton shape="Body2" />
    </Box>
  ) : null;

type AccountSectionProps = {
  activeAccounts: AccountGroup[];
  activeWallet: Wallet | null;
  activeNetwork: Network | null;
  activeAccount: AccountEngineType | null;
  loadingAccountWalletId: string;
  refreshAccounts: (walletId: string, networkId: string) => void;
};

const AccountSection: FC<AccountSectionProps> = ({
  activeAccounts,
  activeWallet,
  loadingAccountWalletId,
  activeNetwork,
  activeAccount,
  refreshAccounts,
}) => (
  <SectionList
    testID="AccountSelectorChildren-AccountSection-SectionList"
    stickySectionHeadersEnabled
    sections={activeAccounts}
    SectionSeparatorComponent={(section) => (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      <Box h={section?.leadingItem ? 2 : 0} />
    )}
    ListFooterComponent={() => (
      <LoadingSkeleton
        // isLoading={true}
        isLoading={activeWallet?.id === loadingAccountWalletId}
      />
    )}
    ItemSeparatorComponent={() => <Box h={2} />}
    keyExtractor={(item, index) => `${item.id}-${index}`}
    renderItem={({ item, section }) => (
      <AccountSectionItem
        item={item}
        section={section}
        activeWallet={activeWallet}
        activeNetwork={activeNetwork}
        activeAccount={activeAccount}
        refreshAccounts={refreshAccounts}
      />
    )}
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

export default memo(AccountSection);
