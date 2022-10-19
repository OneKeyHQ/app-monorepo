import React from 'react';

import { Center,Box, Typography } from '@onekeyhq/components';

const TypographyGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Typography.DisplayXLarge my="4">DisplayXLarge</Typography.DisplayXLarge>
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
    <Typography.CaptionUnderline>CaptionUnderline</Typography.CaptionUnderline>
    <Box my="2" justifyContent="space-between" w="110px" h="85px">
      <Typography.Body2 color="text-subdued">title</Typography.Body2>
      <Typography.Heading numberOfLines={2}>
        0.00000000000123
      </Typography.Heading>
    </Box>
  </Center>
);

export default TypographyGallery;
