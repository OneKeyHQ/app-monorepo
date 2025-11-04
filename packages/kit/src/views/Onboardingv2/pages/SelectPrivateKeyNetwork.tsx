import { useMemo, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Page,
  Popover,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';

import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { OnboardingLayout } from '../components/OnboardingLayout';

const NETWORKS = [
  {
    title: 'EVM networks',
    networks: [
      {
        id: 'evm--1',
      },
      {
        id: 'evm--56',
      },
      {
        id: 'evm--137',
      },
      {
        id: 'evm--43114',
      },
      {
        id: 'evm--42161',
      },
      {
        id: 'evm--10',
      },
      {
        id: 'evm--8453',
      },
    ],
  },
  {
    title: 'Tron',
    networks: [
      {
        id: 'tron--0x2b6653dc',
      },
    ],
  },
];

function NetworkAvatars({
  networks,
  showMore,
  ...rest
}: {
  networks: { id: string }[];
  showMore?: boolean;
} & IXStackProps) {
  return (
    <XStack {...rest}>
      {networks.slice(0, 3).map((item, index) => (
        <YStack
          key={item.id}
          {...(index !== 0 && {
            ml: '$-2',
          })}
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatar networkId={item.id} size="$8" />
        </YStack>
      ))}
      {showMore ? (
        <YStack
          ml="$-2"
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
          bg="$gray4"
          w={36}
          h={36}
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="DotHorOutline" color="$iconSubdued" />
        </YStack>
      ) : null}
    </XStack>
  );
}

export default function SelectPrivateKeyNetwork() {
  const [selected, setSelected] = useState(NETWORKS[0].title);
  const media = useMedia();
  const openChainSelector = useConfigurableChainSelector();

  // Get all networks data to get network names
  const { result: networksData } = usePromiseResult(
    async () => {
      const allNetworkIds = NETWORKS.flatMap((group) =>
        group.networks.map((n) => n.id),
      );
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds: allNetworkIds,
        });
      return networks;
    },
    [],
    {
      initResult: [],
    },
  );

  // Create a map of networkId to network name
  const networkNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    networksData.forEach((network) => {
      map[network.id] = network.name;
    });
    return map;
  }, [networksData]);

  const handleShowMoreNetworks = () => {
    openChainSelector({
      title: 'Select Network',
      excludeAllNetworkItem: true,
      onSelect: (network) => {
        console.log('Selected network:', network);
        // TODO: Handle network selection
      },
    });
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Select Network" />
        <OnboardingLayout.Body>
          <YStack gap="$2.5">
            {NETWORKS.map((network) => (
              <ListItem
                key={network.title}
                gap="$3"
                bg="$bg"
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius="$5"
                borderCurve="continuous"
                p="$3"
                pl="$5"
                m="$0"
                userSelect="none"
                pressStyle={undefined}
                onPress={() => {
                  setSelected(network.title);
                }}
                {...(selected === network.title && {
                  borderColor: '$borderActive',
                  hoverStyle: undefined,
                })}
              >
                <ListItem.Text primary={network.title} flex={1} />
                {network.networks.length > 3 ? (
                  <Popover
                    title={`Supported ${network.networks.length} networks`}
                    placement="bottom"
                    renderTrigger={
                      <NetworkAvatars
                        networks={network.networks}
                        showMore
                        p="$1"
                        m="$-1"
                        hoverStyle={{
                          bg: '$bgHover',
                        }}
                        borderRadius="$full"
                      />
                    }
                    renderContent={
                      <ScrollView
                        contentContainerStyle={{
                          gap: '$2',
                          p: '$3',
                          maxHeight: '400px',
                        }}
                      >
                        {media.gtMd ? (
                          <SizableText
                            size="$bodyMd"
                            color="$textSubdued"
                            pb="$2"
                          >
                            Supported {network.networks.length} networks
                          </SizableText>
                        ) : null}
                        <XStack flexWrap="wrap" w="100%" mb="$-4">
                          {network.networks.map((item) => (
                            <YStack
                              key={item.id}
                              w="25%"
                              gap="$2"
                              alignItems="center"
                              px="$2"
                              pb="$6"
                            >
                              <NetworkAvatar networkId={item.id} size="$8" />
                              <SizableText
                                size="$bodySm"
                                textAlign="center"
                                color="$textSubdued"
                                numberOfLines={1}
                              >
                                {networkNameMap[item.id] || item.id}
                              </SizableText>
                            </YStack>
                          ))}
                        </XStack>
                      </ScrollView>
                    }
                  />
                ) : (
                  <NetworkAvatars networks={network.networks} />
                )}
              </ListItem>
            ))}
            <XStack gap="$2.5" pt="$5" justifyContent="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Can't find your network?
              </SizableText>
              <Button
                variant="tertiary"
                size="small"
                onPress={handleShowMoreNetworks}
              >
                Show more networks
              </Button>
            </XStack>
          </YStack>
          <Button mt="$5" size="large" variant="primary" onPress={() => {}}>
            Confirm
          </Button>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
