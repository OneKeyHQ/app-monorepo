import { chunk } from 'lodash';
import { useIntl } from 'react-intl';

import {
  HStack,
  Modal,
  Text,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';

import { useManageNetworks } from '../../../hooks';

function AllNetworksSupportedNetworks() {
  const intl = useIntl();

  const { allNetworks } = useManageNetworks();

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
                  0: allNetworks.filter((n) => !n.isTestnet).length,
                },
              )}
            </Typography.DisplayLarge>
            <Typography.Body1>
              {intl.formatMessage({ id: 'title__str_supported_networks_desc' })}
            </Typography.Body1>
            {chunk(allNetworks, 3).map((networks, i) => (
              <HStack key={String(i)} justifyContent="space-between">
                {networks.map((n) => (
                  <VStack
                    w="108px"
                    h="80px"
                    alignItems="center"
                    justifyContent="center"
                    key={n.id}
                    bg="surface-subdued"
                    borderWidth="1"
                    borderColor="border-default"
                    borderRadius="12px"
                    mt="16px"
                  >
                    <Token size={8} token={{ logoURI: n.logoURI }} />
                    <Typography.Caption>{n.shortName}</Typography.Caption>
                  </VStack>
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
