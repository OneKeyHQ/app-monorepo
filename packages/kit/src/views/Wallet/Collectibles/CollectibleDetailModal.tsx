import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  CustomSkeleton,
  Divider,
  Empty,
  Modal,
  ScrollView,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { getUserAsset } from '@onekeyhq/engine/src/managers/opensea';
import { OpenSeaAsset } from '@onekeyhq/engine/src/types/opensea';
import IconWifi from '@onekeyhq/kit/assets/3d_wifi.png';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';

import CollectibleContent from './CollectibleContent';

const MODAL_PADDING = 16;

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

const LoadingView = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const imageWidth = isSmallScreen ? width - MODAL_PADDING * 2 : 358;
  const intl = useIntl();
  const skeletonAttWidth = isSmallScreen ? (width - 48) / 3 : 112;
  const skeletonAttArray = [
    skeletonAttWidth,
    skeletonAttWidth,
    skeletonAttWidth,
    137,
    137,
  ];

  const skeletonDetailWidth = isSmallScreen ? width - 32 : 358;
  const skeletonDetailArray = [
    skeletonDetailWidth,
    skeletonDetailWidth,
    skeletonDetailWidth,
  ];
  const shareProps: Props = {
    imageContent: (
      <CustomSkeleton
        width={`${imageWidth}px`}
        height={`${imageWidth}px`}
        borderRadius="12px"
      />
    ),
    content: (
      <Box flexDirection="column" width={isSmallScreen ? undefined : '418px'}>
        <CustomSkeleton width="255px" height="32px" borderRadius="16px" />
        <CustomSkeleton
          width="160px"
          height="20px"
          borderRadius="10px"
          mt="8px"
        />
        <Text typography="Heading" mt="24px" mb="12px">
          {intl.formatMessage({ id: 'content__attributes' })}
        </Text>
        <Box flexDirection="row" flexWrap="wrap">
          {skeletonAttArray.map((itemWidth, index) => (
            <CustomSkeleton
              key={`Skeleton att${index}`}
              width={itemWidth}
              height="52px"
              borderRadius="26px"
              mr="8px"
              mb="8px"
            />
          ))}
        </Box>
        <Text typography="Heading" mt="16px" mb="12px">
          {intl.formatMessage({ id: 'content__details' })}
        </Text>
        <Box flexDirection="column">
          {skeletonDetailArray.map((itemWidth, index) => (
            <CustomSkeleton
              key={`Skeleton detail${index}`}
              width={itemWidth}
              height="24px"
              borderRadius="12px"
              mb="8px"
            />
          ))}
        </Box>
      </Box>
    ),
  };
  return isSmallScreen ? (
    <Mobile {...shareProps} />
  ) : (
    <Desktop {...shareProps} />
  );
};

type PageStatusType = 'loading' | 'empty' | 'data';

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
  const { tokenId, contractAddress, chainName, chainId, name } = route.params;
  const [asset, setAsset] = useState<OpenSeaAsset | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');
  const toast = useToast();

  const shareProps: Props = {
    imageContent: <CollectibleContent asset={asset as OpenSeaAsset} />,
    content: asset && (
      <VStack space={6} w="100%">
        {/* Asset name and collection name */}
        <VStack>
          <Typography.DisplayLarge fontWeight="700">
            {asset.name}
          </Typography.DisplayLarge>
          {!!asset.collection.name && (
            <Typography.Body2 color="text-subdued">
              {asset.collection.name}
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
        {!!asset.traits?.length && (
          <VStack space={3}>
            <Typography.Heading>
              {intl.formatMessage({ id: 'content__attributes' })}
            </Typography.Heading>
            <Box flexDirection="row" flexWrap="wrap">
              {asset.traits.map((trait, index) => (
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
          {!!chainName && (
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
                  {chainName}
                </Typography.Body1Strong>
              </Box>
            </>
          )}
          {!!contractAddress && (
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
                >
                  {contractAddress}
                </Typography.Body1Strong>
              </Box>
            </>
          )}
        </VStack>
      </VStack>
    ),
  };

  const loadData = useCallback(async () => {
    setPageStatus('loading');
    try {
      const assetFromBe = await getUserAsset({
        chainId,
        contractAddress,
        tokenId: tokenId.toString(),
      });
      setAsset(assetFromBe);
      setPageStatus('data');
    } catch (e) {
      console.log(`Error on fetching nft asset ${tokenId}`);
      const error = e as Error | string | null | undefined;
      const message = typeof error === 'string' ? error : error?.message;
      if (message) {
        toast.show({
          title: message,
        });
      }
      setPageStatus('empty');
    }
  }, [chainId, contractAddress, toast, tokenId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const modalContent = () => {
    if (pageStatus === 'loading') {
      return <LoadingView />;
    }
    if (pageStatus === 'empty') {
      return (
        <Center flex={1}>
          <Empty
            imageUrl={IconWifi}
            title={intl.formatMessage({ id: 'title__no_connection' })}
            subTitle={intl.formatMessage({
              id: 'title__no_connection_desc',
            })}
            actionTitle={intl.formatMessage({
              id: 'action__retry',
            })}
            handleAction={() => {
              loadData();
            }}
          />
        </Center>
      );
    }
    return isSmallScreen ? (
      <Mobile {...shareProps} />
    ) : (
      <Desktop {...shareProps} />
    );
  };
  return (
    <Modal
      size="2xl"
      footer={null}
      height="640px"
      header={name ?? ''}
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
