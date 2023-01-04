/* eslint-disable no-nested-ternary */
import type { ComponentProps, FC } from 'react';

import { Box, HStack, Pressable, Typography } from '@onekeyhq/components';

export interface SectionHeaderProps extends ComponentProps<typeof HStack> {
  title?: string;
  actions?: [{ label?: string; onPress: () => void }];
}

const SectionHeader: FC<SectionHeaderProps> = ({ title, actions, ...rest }) => (
  <HStack alignItems="center" p={2} pb={0} {...rest}>
    <Typography.Subheading color="text-subdued" flex={1} mr={3}>
      {title}
    </Typography.Subheading>
    {actions?.length ? (
      <HStack space={6}>
        {actions.map((item, index) => (
          <Pressable key={String(index)} onPress={item.onPress} hitSlop={8}>
            {({ isHovered, isPressed }) => (
              <Box m={-2}>
                <Box
                  p={2}
                  rounded="xl"
                  bgColor={
                    isPressed
                      ? 'surface-pressed'
                      : isHovered
                      ? 'surface-hovered'
                      : undefined
                  }
                >
                  <Typography.CaptionStrong color="text-subdued" display="flex">
                    {item.label}
                  </Typography.CaptionStrong>
                </Box>
              </Box>
            )}
          </Pressable>
        ))}
      </HStack>
    ) : null}
  </HStack>
);

export default SectionHeader;
