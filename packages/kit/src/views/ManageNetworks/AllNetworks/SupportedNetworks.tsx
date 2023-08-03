import { chunk } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Modal,
  Text,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';

import { useAllNetworksIncludedNetworks } from '../../../hooks/useAllNetwoks';

function AllNetworksSupportedNetworks() {
  const intl = useIntl();

  const allNetworks = useAllNetworksIncludedNetworks(false);

  return (
    <Modal
      header={intl.formatMessage({ id: 'content__info' })}
      height="560px"
      footer={null}
      scrollViewProps={{
        children: (
          <>
            <Text mb="2" textAlign="center" fontWeight={600} fontSize="56px">
              🌐
            </Text>
            <Typography.DisplayLarge mb="2" textAlign="center">
              {intl.formatMessage(
                { id: 'title__str_supported_networks' },
                {
                  0: allNetworks.length,
                },
              )}
            </Typography.DisplayLarge>
            <Typography.Body1 color="text-subdued" mb="8">
              {intl.formatMessage({ id: 'title__str_supported_networks_desc' })}
            </Typography.Body1>
            {chunk(allNetworks, 3).map((networks, i) => (
              <HStack key={String(i)}>
                {networks.map((n, index) => (
                  <VStack
                    flex="1"
                    h="80px"
                    alignItems="center"
                    justifyContent="center"
                    key={n.id}
                    bg="surface-subdued"
                    borderWidth="1"
                    borderColor="border-default"
                    borderRadius="12px"
                    mt="16px"
                    ml={index === 0 ? 0 : 4}
                  >
                    <Token size={8} token={{ logoURI: n.logoURI }} />
                    <Typography.Caption mt="2">
                      {n.shortName}
                    </Typography.Caption>
                  </VStack>
                ))}
                {new Array(3 - networks.length).fill(1).map((_, index) => (
                  <Box key={index} flex="1" ml="4" />
                ))}
              </HStack>
            ))}
          </>
        ),
      }}
    />
  );
}

export { AllNetworksSupportedNetworks };
