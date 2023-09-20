import type { FC } from 'react';

import { Box, Text } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';

import { useWalletName } from '../../../../../hooks/useWalletName';
import { WalletAvatarPro } from '../../../../WalletSelector/WalletAvatar';
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
    <Box mt={-2} pt={2} bg="surface-subdued">
      <Box flexDirection="row" alignItems="center" mb={2} pr={1.5} pl={2}>
        <Box flex={1} flexDirection="row" alignItems="center" mr={3}>
          <WalletAvatarPro size="xs" wallet={wallet} devicesStatus={null} />
          <Text ml={2} typography="Subheading" color="text-subdued" isTruncated>
            {walletName}
          </Text>
        </Box>
        <CreateAccountButton
          networkId={networkId}
          walletId={wallet.id}
          isLoading={isCreateLoading}
        />
      </Box>
      {/* move fullBleed Button to renderSectionFooter */}
      {emptySectionData ? null : undefined}
    </Box>
  );
};

SectionHeader.defaultProps = defaultProps;

export default SectionHeader;
