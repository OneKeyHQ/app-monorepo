import type { FC } from 'react';

import { Box, Center, Icon, Image } from '@onekeyhq/components';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';

interface ChainsProps {
  networkIds?: string[];
}

export const Chains: FC<ChainsProps> = ({ networkIds }) => {
  const networks = useAppSelector((s) => s.runtime.networks);
  const items = networks.filter((network) => networkIds?.includes(network.id));
  return (
    <Box flexDirection="row">
      {items?.map((item, i) => (
        <Box ml={i > 0 ? -1 : 0} key={item.id}>
          <Image
            size={4}
            borderRadius="full"
            src={item.logoURI}
            fallbackElement={
              <Center
                width={4}
                height={4}
                borderRadius="full"
                bg="background-selected"
              >
                <Icon name="QuestionMarkOutline" />
              </Center>
            }
          />
        </Box>
      ))}
    </Box>
  );
};
