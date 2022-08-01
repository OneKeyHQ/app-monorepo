import React from 'react';

import {
  Box,
  Center,
  Image,
  NetImage,
  Text,
  Typography,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

const TypographyGallery = () => (
  <Center flex="1" bg="background-hovered">
    <NetImage
      preview
      skeleton
      retry={3}
      width="500px"
      height="500px"
      borderRadius="50px"
      src="https://dev.onekey-asset.com/0xb4cfb411252a80b35b6b73737ff11f510d0f5928/0x0cfb5d82be2b949e8fa73a656df91821e2ad99fd/0x0000000000000000000000000000000000000000000000000000000100001f2f"
      fallbackElement={<Center bgColor="amber.300" width={100} height={100} />}
    />

    {/* <Image
      width="500px"
      height="500px"
      src="https://dm2zb8bwza29x.cloudfront.net/0xabb3738f04dc2ec20f4ae4462c3d069d02ae045b/0x00000000000000000000000000000000000000000000000000000000007a19d2.png"
    /> */}

    {/* <Typography.DisplayXLarge my="4">DisplayXLarge</Typography.DisplayXLarge>
    <Typography.DisplayLarge color="text-default">
      DisplayLarge
    </Typography.DisplayLarge>
    <Typography.DisplayMedium color="text-subdued">
      DisplayMedium (color=text-subdued)
    </Typography.DisplayMedium>
    <Typography.DisplaySmall color="text-critical">
      DisplaySmall (color=text-critical)
    </Typography.DisplaySmall>
    <Typography.DisplaySmall color="text-warning">
      DisplaySmall (color=text-warning)
    </Typography.DisplaySmall>
    <Typography.PageHeading>PageHeading</Typography.PageHeading>
    <Typography.Heading>Heading</Typography.Heading>
    <Typography.Subheading>SUBHEADING</Typography.Subheading>
    <Typography.Button1>Button1</Typography.Button1>
    <Typography.Button2>Button2</Typography.Button2>
    <Typography.Body1>Body1</Typography.Body1>
    <Typography.Body2>Body2</Typography.Body2>
    <Typography.Caption>Caption</Typography.Caption>
    <Typography.Body1Strong>Body1Strong</Typography.Body1Strong>
    <Typography.Body1Underline>Body1Underline</Typography.Body1Underline>
    <Typography.Body2Strong>Body2Strong</Typography.Body2Strong>
    <Typography.Body2Underline>Body2Underline</Typography.Body2Underline>
    <Typography.CaptionStrong>CaptionStrong</Typography.CaptionStrong>
    <Typography.CaptionUnderline>CaptionUnderline</Typography.CaptionUnderline> */}
  </Center>
);

export default TypographyGallery;
