import { useMemo } from 'react';

import { BlurView } from 'expo-blur';

import {
  Badge,
  Box,
  Center,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { convertToMoneyFormat } from '../../../utils';
import CollectibleContent from '../CollectibleContent';

function isImage(contentType?: string | null) {
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/jpg' ||
    contentType === 'image/png'
  ) {
    return true;
  }
  return false;
}

function EVMAssetImageContent(params: {
  asset: NFTAsset;
  network: Network;
  isOwner: boolean;
}) {
  const { asset, isOwner } = params;
  const { themeVariant } = useTheme();
  const isVertical = useIsVerticalLayout();
  const AmountTag = useMemo(() => {
    if (
      asset?.amount &&
      isOwner &&
      Number(asset?.amount) > 1 &&
      asset.ercType === 'erc1155'
    ) {
      return (
        <Badge
          position="absolute"
          right="8px"
          bottom="8px"
          title={`X ${convertToMoneyFormat(asset.amount)}`}
          size="sm"
          type="default"
        />
      );
    }
    return null;
  }, [asset.amount, asset.ercType, isOwner]);
  let hasBlurViewBG = isImage(asset.contentType);
  if (asset.nftscanUri && asset.nftscanUri?.length > 0) {
    hasBlurViewBG = true;
  }
  hasBlurViewBG = !!(asset.nftscanUri && asset.nftscanUri?.length > 0);
  return (
    <>
      {/* eslint-disable-next-line no-nested-ternary */}
      {(isVertical && platformEnv.isExtension) || platformEnv.isNativeIOSPad ? (
        <Box overflow="hidden" mt="-16px" mr="-16px" ml="-16px">
          {hasBlurViewBG && (
            <Center position="absolute" top={0} right={0} bottom={0} left={0}>
              <CollectibleContent
                asset={asset}
                size={platformEnv.isExtension ? 360 : 680}
              />
            </Center>
          )}
          <BlurView
            tint={themeVariant === 'light' ? 'light' : 'dark'}
            intensity={100}
            style={{
              alignItems: 'center',
              padding: 24,
            }}
          >
            <CollectibleContent asset={asset} />
            {AmountTag}
          </BlurView>
        </Box>
      ) : isVertical ? (
        <Box>
          <CollectibleContent asset={asset} />
          {AmountTag}
        </Box>
      ) : (
        <Box
          alignSelf="stretch"
          borderLeftRadius={24}
          mr="24px"
          overflow="hidden"
        >
          {hasBlurViewBG && (
            <Center position="absolute" top={0} right={0} bottom={0} left={0}>
              <CollectibleContent
                asset={asset}
                size={platformEnv.isExtension ? 360 : 680}
              />
            </Center>
          )}
          <BlurView
            tint={themeVariant === 'light' ? 'light' : 'dark'}
            intensity={100}
            style={{
              flex: 1,
              alignSelf: 'stretch',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <CollectibleContent asset={asset} />
            {AmountTag}
          </BlurView>
        </Box>
      )}
    </>
  );
}
export { EVMAssetImageContent };
