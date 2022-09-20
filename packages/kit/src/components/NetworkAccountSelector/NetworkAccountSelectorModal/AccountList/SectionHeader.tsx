import React, { FC } from 'react';

import { Box, Text } from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import { WalletAvatarPro } from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';

import { useWalletName } from '../../../../hooks/useWalletName';
import { CreateAccountButton } from '../CreateAccountButton';

type SectionHeaderProps = {
  wallet: IWallet;
  networkId: string | undefined;
  emptySectionData?: boolean;
  isCreateLoading?: boolean;
};

const defaultProps = {} as const;

const SectionHeader: FC<SectionHeaderProps> = ({
  wallet,
  networkId,
  emptySectionData,
  isCreateLoading,
}) => {
  const walletName = useWalletName({ wallet });

  return (
    <Box bg="surface-subdued">
      <Box flexDirection="row" alignItems="center" mb={2} pl={2} pr={1.5}>
        <Box flex={1} flexDirection="row" alignItems="center" mr={3}>
          <WalletAvatarPro size="xs" wallet={wallet} deviceStatus={null} />
          <Text ml={2} typography="Subheading" color="text-subdued" isTruncated>
            {walletName}
          </Text>
        </Box>
        {!emptySectionData ? (
          <CreateAccountButton
            networkId={networkId}
            walletId={wallet.id}
            fullBleed={false}
            isLoading={isCreateLoading}
          />
        ) : undefined}
      </Box>
      {/* move fullBleed Button to renderSectionFooter */}
      {emptySectionData ? null : undefined}
    </Box>
  );
};

SectionHeader.defaultProps = defaultProps;

export default SectionHeader;
