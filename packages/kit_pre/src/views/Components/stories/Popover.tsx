/* eslint-disable react/no-unstable-nested-components */
import { Button } from 'native-base';

import { Box, Center, Popover, Text } from '@onekeyhq/components';

const PopoverGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Popover
      position="top"
      trigger={({ ...props }) => <Button {...props}>Top</Button>}
      bodyProps={{
        children: (
          <Box
            maxHeight="64px"
            maxWidth="200px"
            justifyContent="center"
            justifyItems="center"
          >
            <Text typography="CaptionStrong" color="surface-default">
              The current statistical content only includes the assets on ETH /
              BSC / NEAR network, more networks coming soon.
            </Text>
          </Box>
        ),
      }}
    />
  </Center>
);

export default PopoverGallery;
