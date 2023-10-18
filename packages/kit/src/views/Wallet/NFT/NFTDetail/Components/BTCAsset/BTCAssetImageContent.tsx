import { BlurView } from 'expo-blur';

import {
  Box,
  Center,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getBTCListComponent } from '../../../NFTList/NFTBTCContent/getBTCListComponent';

function BTCAssetImageContent(params: {
  asset: NFTBTCAssetModel;
  networkId: string;
  isOwner: boolean;
}) {
  const { asset } = params;
  const { themeVariant } = useTheme();
  const isVertical = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();

  const hasBlurViewBG = asset?.content_type?.includes('image');
  const { Component: CollectibleContent } = getBTCListComponent({
    data: asset,
    sizeType: 'detail',
  });

  // eslint-disable-next-line no-nested-ternary
  const imageWidth = isVertical
    ? platformEnv.isExtension
      ? 176
      : screenWidth - 32
    : 288;

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
            <CollectibleContent asset={asset} size={imageWidth} showOrigin />
          </BlurView>
        </Box>
      ) : isVertical ? (
        <CollectibleContent asset={asset} size={imageWidth} showOrigin />
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
            <CollectibleContent asset={asset} size={imageWidth} showOrigin />
          </BlurView>
        </Box>
      )}
    </>
  );
}
export { BTCAssetImageContent };
