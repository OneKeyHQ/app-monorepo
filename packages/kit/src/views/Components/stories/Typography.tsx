import { Center, Text, Typography } from '@onekeyhq/components';

const TypographyGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Text
      fontSize={{
        base: 'md',
        md: 'lg',
        lg: 'xl',
      }}
    >
      This is responsive text
    </Text>
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
  </Center>
);

export default TypographyGallery;
