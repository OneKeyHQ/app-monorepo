import React from 'react';

import { Typography, Center } from '@onekeyhq/components';

const TypographyGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Typography.DisplayXLarge my="4">DisplayXLarge</Typography.DisplayXLarge>
    <Typography.DisplayLarge color="text-default">
      DisplayLarge
    </Typography.DisplayLarge>
    <Typography.DisplayMedium color="text-subdued">
      DisplayMedium
    </Typography.DisplayMedium>
    <Typography.DisplaySmall color="text-critical">
      DisplaySmall
    </Typography.DisplaySmall>
    <Typography.PageHeading>PageHeading</Typography.PageHeading>
    <Typography.Heading>Heading</Typography.Heading>
    <Typography.SUBHEADING>SUBHEADING</Typography.SUBHEADING>
    <Typography.Button1>Button1</Typography.Button1>
    <Typography.Button2>Button2</Typography.Button2>
    <Typography.Body1>Body1</Typography.Body1>
    <Typography.Body2>Body2</Typography.Body2>
    <Typography.Caption>Caption</Typography.Caption>
  </Center>
);

export default TypographyGallery;
