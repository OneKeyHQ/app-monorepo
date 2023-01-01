import type { FC } from 'react';
import { memo, useEffect, useState } from 'react';

import { Box, Center, Pressable } from '@onekeyhq/components';

type DotSpaceProps = {
  size?: number;
  defaultLight?: boolean;
  disabled?: boolean;
  onClickSpace?: (openLight: boolean) => void;
  lightColor?: string;
};
const DotSpace: FC<DotSpaceProps> = ({
  defaultLight,
  disabled,
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
      size={size}
      borderWidth="1px"
      borderColor="divider"
      disabled={disabled}
      onPress={() => {
        setOpenLight((pre) => !pre);
        if (onClickSpace) onClickSpace(!openLight);
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
              : 'background-default'
          }
        >
          {openLight ? (
            <Box size={size / 2} bgColor={lightColor} borderRadius="9999px" />
          ) : null}
        </Center>
      )}
    </Pressable>
  );
};

export default memo(DotSpace);
