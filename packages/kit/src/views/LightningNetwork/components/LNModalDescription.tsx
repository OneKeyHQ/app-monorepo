import type { FC } from 'react';

import { Box, Token } from '@onekeyhq/components';

import { useNetwork } from '../../../hooks';

export const LNModalDescription: FC<{ networkId: string | undefined }> = ({
  networkId,
}) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};
