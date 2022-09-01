import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  Modal,
  ScrollView,
  Typography,
  VStack,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';

import CollectibleContent from './CollectibleContent';

type Props = {
  imageContent: JSX.Element;
  content: JSX.Element | null;
};
const Desktop: FC<Props> = ({ imageContent, content }) => (
  <Box flexDirection="row" flex={1}>
    {imageContent}
    <Box flex={1} flexDirection="column" px="24px">
      <ScrollView>{content}</ScrollView>
    </Box>
  </Box>
);
const Mobile: FC<Props> = ({ imageContent, content }) => (
  <Box flexDirection="column" flex={1} pr="16px">
    <ScrollView>
      {imageContent}
      <Box paddingY="24px">{content}</Box>
    </ScrollView>
  </Box>
);

const CollectibleDetailModal: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const isSmallScreen = useIsVerticalLayout();
  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectibleDetailModal
      >
    >();
  const { network, asset } = route.params;
  const shareProps: Props = {
    imageContent: <CollectibleContent asset={asset} />,
    content: asset && (
      <Box w="100%">
        {/* Asset name and collection name */}
        <VStack mb="24px">
          <Typography.DisplayLarge fontWeight="700">
            {asset.name}
          </Typography.DisplayLarge>
          {!!asset.collection.contractName && (
            <Typography.Body2 color="text-subdued">
              {asset.collection.contractName}
            </Typography.Body2>
          )}
        </VStack>

        {/* Description */}
        {!!asset.description && (
          <VStack space={3} mb="24px">
            <Typography.Heading fontWeight="600">
              {intl.formatMessage({ id: 'content__description' })}
            </Typography.Heading>
            <Typography.Body2 color="text-subdued">
              {asset.description}
            </Typography.Body2>
          </VStack>
        )}

        {/* traits */}
        {!!asset.attributes?.length && (
          <VStack space="12px" mb="12px">
            <Typography.Heading>
              {intl.formatMessage({ id: 'content__attributes' })}
            </Typography.Heading>
            <Box flexDirection="row" flexWrap="wrap">
              {asset.attributes.map((trait, index) => (
                <Box
                  key={`${trait.traitType}-${index}`}
                  alignSelf="flex-start"
                  padding="16px"
                  mr="12px"
                  mb="12px"
                  bgColor="surface-default"
                  borderRadius="12px"
                >
                  <Typography.Body2
                    color="text-subdued"
                    textTransform="uppercase"
                  >
                    {trait.traitType}
                  </Typography.Body2>
                  <Typography.Body1Strong>{trait.value}</Typography.Body1Strong>
                </Box>
              ))}
            </Box>
          </VStack>
        )}

        {/* Details */}
        <VStack>
          <Typography.Heading mb="12px">
            {intl.formatMessage({ id: 'content__details' })}
          </Typography.Heading>
          <VStack bgColor="surface-default" borderRadius="12px">
            {!!asset.tokenId && (
              <Box
                flexDirection="column"
                alignItems="flex-start"
                padding="16px"
              >
                <Typography.Body1Strong color="text-subdued" mb="4px">
                  Token ID
                </Typography.Body1Strong>
                <Typography.Body1Strong>{asset.tokenId}</Typography.Body1Strong>
              </Box>
            )}
            {!!network && (
              <Box
                flexDirection="column"
                alignItems="flex-start"
                padding="16px"
              >
                <Typography.Body1Strong color="text-subdued" mb="4px">
                  {intl.formatMessage({ id: 'content__blockchain' })}
                </Typography.Body1Strong>

                <Typography.Body1Strong flex="1">
                  {network.name}
                </Typography.Body1Strong>
              </Box>
            )}
            {!!asset.contractAddress && (
              <Box
                flexDirection="column"
                alignItems="flex-start"
                padding="16px"
              >
                <Typography.Body1Strong color="text-subdued" mb="4px">
                  {intl.formatMessage({
                    id: 'transaction__contract_address',
                  })}
                </Typography.Body1Strong>

                <Box flexDirection="row" alignItems="center">
                  <Typography.Body1Strong>
                    {shortenAddress(asset.contractAddress, 6)}
                  </Typography.Body1Strong>
                  <IconButton
                    size="sm"
                    type="plain"
                    name="DuplicateSolid"
                    onPress={() => {
                      copyToClipboard(asset.contractAddress ?? '');
                      toast.show({
                        title: intl.formatMessage({ id: 'msg__copied' }),
                      });
                    }}
                  />
                </Box>
              </Box>
            )}
            {!!asset.tokenAddress && (
              <Box
                flexDirection="column"
                alignItems="flex-start"
                padding="16px"
              >
                <Typography.Body1Strong color="text-subdued" mb="4px">
                  Token address
                </Typography.Body1Strong>
                <Box flexDirection="row" alignItems="center">
                  <Typography.Body1Strong>
                    {shortenAddress(asset.tokenAddress, 6)}
                  </Typography.Body1Strong>
                  <IconButton
                    size="sm"
                    type="plain"
                    name="DuplicateSolid"
                    onPress={() => {
                      copyToClipboard(asset.tokenAddress ?? '');
                      toast.show({
                        title: intl.formatMessage({ id: 'msg__copied' }),
                      });
                    }}
                  />
                </Box>
              </Box>
            )}
          </VStack>
        </VStack>
      </Box>
    ),
  };

  const modalContent = () =>
    isSmallScreen ? <Mobile {...shareProps} /> : <Desktop {...shareProps} />;
  return (
    <Modal
      size="2xl"
      footer={null}
      height="640px"
      header={asset.contractName ?? ''}
      staticChildrenProps={{
        flex: 1,
        pt: '24px',
        pl: isSmallScreen ? '16px' : '24px',
      }}
    >
      {modalContent()}
    </Modal>
  );
};

export default CollectibleDetailModal;
