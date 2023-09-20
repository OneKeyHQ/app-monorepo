import type { FC } from 'react';
import { memo, useEffect, useState } from 'react';

import { Box, Center, Pressable } from '@onekeyhq/components';

type DotSpaceProps = {
  size?: number;
  defaultLight?: boolean;
  disabled?: boolean;
  onClickSpace?: (openLight: boolean) => void;
  lightColor?: string;
  defaultBgColor?: string;
};
const DotSpace: FC<DotSpaceProps> = ({
  defaultLight,
  disabled,
  defaultBgColor,
  onClickSpace,
  size = 5,
  lightColor = 'text-success',
}) => {
  const [openLight, setOpenLight] = useState(() => !!defaultLight);
  useEffect(() => {
    setOpenLight(!!defaultLight);
  }, [defaultLight]);
  return (
    <Pressable
      size={`${size * 4}px`}
      borderWidth="1px"
      borderColor="border-default"
      disabled={disabled}
      onPress={() => {
        setOpenLight((pre) => !pre);
        if (onClickSpace) {
          setTimeout(() => {
            onClickSpace(!openLight);
          }, 0);
        }
      }}
    >
      {({ isHovered, isPressed }) => (
        <Center
          flex={1}
          bgColor={
            // eslint-disable-next-line no-nested-ternary
            isPressed
              ? 'surface-pressed'
              : isHovered
              ? 'surface-hovered'
              : defaultBgColor ?? 'background-default'
          }
        >
          {openLight ? (
            <Box
              size={
                Math.floor(size / 2) > 10
                  ? `${Math.floor(size / 2) * 4}px`
                  : Math.floor(size / 2)
              }
              bgColor={lightColor}
              borderRadius="9999px"
            />
          ) : null}
        </Center>
      )}
    </Pressable>
  );
};

export default memo(DotSpace);
