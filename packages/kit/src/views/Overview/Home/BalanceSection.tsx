import React, { FC } from 'react';

import { Button as NBButton } from 'native-base';

import { Box, Icon, Popover, Text } from '@onekeyhq/components';

const BalanceSection: FC = () => (
  <Box height="76px" marginY="24px">
    <Box
      justifyContent="space-between"
      justifyItems="flex-start"
      flexDirection="row"
      paddingTop="10px"
    >
      <Box flexDirection="column" height="60px">
        <Box flexDirection="row" alignItems="center">
          <Text typography="Subheading" color="text-subdued" mr="4px">
            Total Balance
          </Text>
          <Popover
            position="right"
            trigger={({ ...props }) => (
              <NBButton {...props} padding="0px" bgColor="background-default">
                <Icon name="InformationCircleSolid" size={20} />
              </NBButton>
            )}
            bodyProps={{
              children: (
                <Box
                  maxHeight="64px"
                  maxWidth="200px"
                  justifyContent="center"
                  justifyItems="center"
                >
                  <Text typography="CaptionStrong" color="surface-default">
                    The current statistical content only includes the assets on
                    ETH / BSC / NEAR network, more networks coming soon.
                  </Text>
                </Box>
              ),
            }}
          />
        </Box>
        <Text typography="DisplayXLarge">$541.87</Text>
      </Box>
      <Box
        height="36px"
        bgColor="surface-default"
        padding="8px"
        borderRadius="12px"
      >
        <Text typography="Button2" color="text-success">
          +2.04%
        </Text>
      </Box>
    </Box>
  </Box>
);

export default BalanceSection;
