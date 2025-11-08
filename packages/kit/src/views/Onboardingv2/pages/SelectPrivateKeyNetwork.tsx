import { useMemo, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
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
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import type {
  IDetectedNetwork,
  IDetectedNetworkGroupItem,
} from '@onekeyhq/shared/src/utils/networkDetectUtils';
import networkDetectUtils from '@onekeyhq/shared/src/utils/networkDetectUtils';

import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { useAppRoute } from '../../../hooks/useAppRoute';
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
  networks: IDetectedNetwork[];
  showMore?: boolean;
} & IXStackProps) {
  return (
    <XStack {...rest}>
      {networks.slice(0, 3).map((item, index) => (
        <YStack
          key={item.networkId}
          {...(index !== 0 && {
            ml: '$-2',
          })}
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatar networkId={item.networkId} size="$8" />
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

function NetworkGroupItem({
  selectedUUID,
  onSelect,
  item,
}: {
  selectedUUID: string;
  onSelect: (uuid: string) => void;
  item: IDetectedNetworkGroupItem;
}) {
  const media = useMedia();
  const title = useMemo(() => {
    return item.name;
  }, [item.name]);
  return (
    <ListItem
      key={item.uuid}
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
        onSelect(item.uuid);
      }}
      {...(selectedUUID === item.uuid && {
        borderColor: '$borderActive',
        hoverStyle: undefined,
      })}
    >
      <ListItem.Text primary={title} flex={1} />
      {item.networks.length > 1 ? (
        <Popover
          title={`Supported ${item.networks.length} networks`}
          placement="bottom"
          renderTrigger={
            <NetworkAvatars
              networks={item.networks}
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
                <SizableText size="$bodyMd" color="$textSubdued" pb="$2">
                  Supported {item.networks.length} networks
                </SizableText>
              ) : null}
              <XStack flexWrap="wrap" w="100%" mb="$-4">
                {item.networks.map((network) => (
                  <YStack
                    key={network.networkId}
                    w="25%"
                    gap="$2"
                    alignItems="center"
                    px="$2"
                    pb="$6"
                  >
                    <NetworkAvatar networkId={network.networkId} size="$8" />
                    <SizableText
                      size="$bodySm"
                      textAlign="center"
                      color="$textSubdued"
                      numberOfLines={1}
                    >
                      {network.name}
                    </SizableText>
                  </YStack>
                ))}
              </XStack>
            </ScrollView>
          }
        />
      ) : (
        <NetworkAvatars networks={item.networks} />
      )}
    </ListItem>
  );
}

export default function SelectPrivateKeyNetwork() {
  const [selected, setSelected] = useState('');
  const media = useMedia();
  const openChainSelector = useConfigurableChainSelector();
  const routeParams = useAppRoute<
    IOnboardingParamListV2,
    EOnboardingPagesV2.SelectPrivateKeyNetwork
  >().params;
  const input = routeParams?.input;

  const { result: detectedNetworks = [] } = usePromiseResult(async () => {
    if (!input) {
      return [];
    }
    const privateKey =
      await backgroundApiProxy.servicePassword.decodeSensitiveText({
        encodedText: input || '',
      });
    const { groupedByImpl } =
      await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
    return Object.values(groupedByImpl);
  }, [input]);

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
            <SizableText>{input}</SizableText>
            {detectedNetworks.map((network) => (
              <NetworkGroupItem
                key={network.uuid}
                selectedUUID={selected}
                onSelect={setSelected}
                item={network}
              />
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
            <Button
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: detectedNetworks,
                });
              }}
            >
              debugMessage
            </Button>
          </YStack>
          <Button mt="$5" size="large" variant="primary" onPress={() => {}}>
            Confirm
          </Button>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
