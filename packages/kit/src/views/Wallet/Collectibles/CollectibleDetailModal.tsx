import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Modal,
  ScrollView,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
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
  const isSmallScreen = useIsVerticalLayout();
  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectibleDetailModal
      >
    >();
  const { asset, network } = route.params;

  const shareProps: Props = {
    imageContent: <CollectibleContent asset={asset} />,
    content: asset && (
      <VStack space={6} w="100%">
        {/* Asset name and collection name */}
        <VStack>
          <Typography.DisplayLarge fontWeight="700">
            {asset.assetName}
          </Typography.DisplayLarge>
          {!!asset.name && (
            <Typography.Body2 color="text-subdued">
              {asset.name}
            </Typography.Body2>
          )}
        </VStack>

        {/* Description */}
        {!!asset.description && (
          <VStack space={3}>
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
          <VStack space={3}>
            <Typography.Heading>
              {intl.formatMessage({ id: 'content__attributes' })}
            </Typography.Heading>
            <Box flexDirection="row" flexWrap="wrap">
              {asset.attributes.map((trait, index) => (
                <Box
                  key={`${trait.traitType}-${index}`}
                  alignSelf="flex-start"
                  px="3"
                  py="2"
                  mr="2"
                  mb="2"
                  bgColor="surface-default"
                  borderRadius="12px"
                >
                  <Typography.Caption
                    color="text-subdued"
                    textTransform="uppercase"
                  >
                    {trait.traitType}
                  </Typography.Caption>
                  <Typography.Body2>{trait.value}</Typography.Body2>
                </Box>
              ))}
            </Box>
          </VStack>
        )}

        {/* Details */}
        <VStack>
          <Typography.Heading>
            {intl.formatMessage({ id: 'content__details' })}
          </Typography.Heading>
          <Box
            flexDirection="row"
            alignItems="flex-start"
            justifyContent="space-between"
            py="4"
          >
            <Typography.Body1Strong color="text-subdued">
              Token ID
            </Typography.Body1Strong>
            <Typography.Body1Strong
              ml="4"
              textAlign="right"
              flex="1"
              numberOfLines={999}
            >
              {asset.tokenId}
            </Typography.Body1Strong>
          </Box>
          {!!network && (
            <>
              <Divider />
              <Box
                display="flex"
                flexDirection="row"
                alignItems="flex-start"
                justifyContent="space-between"
                py="4"
              >
                <Typography.Body1Strong color="text-subdued">
                  {intl.formatMessage({ id: 'content__blockchain' })}
                </Typography.Body1Strong>

                <Typography.Body1Strong
                  ml="4"
                  flex="1"
                  textAlign="right"
                  numberOfLines={999}
                >
                  {network.name}
                </Typography.Body1Strong>
              </Box>
            </>
          )}
          {!!asset.tokenAddress && (
            <>
              <Divider />
              <Box
                display="flex"
                flexDirection="row"
                alignItems="flex-start"
                justifyContent="space-between"
                py="4"
              >
                <Typography.Body1Strong color="text-subdued">
                  {intl.formatMessage({
                    id: 'transaction__contract_address',
                  })}
                </Typography.Body1Strong>

                <Typography.Body1Strong
                  ml="4"
                  flex="1"
                  textAlign="right"
                  numberOfLines={999}
                  selectable
                >
                  {asset.tokenAddress}
                </Typography.Body1Strong>
              </Box>
            </>
          )}
        </VStack>
      </VStack>
    ),
  };

  const modalContent = () =>
    isSmallScreen ? <Mobile {...shareProps} /> : <Desktop {...shareProps} />;
  return (
    <Modal
      size="2xl"
      footer={null}
      height="640px"
      header={asset.assetName ?? ''}
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
