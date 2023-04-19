import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
  Box,
  HStack,
  Slider,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

type PercentInputProps = {
  value: number;
  onChange: (value: number) => void;
};

const PercentInput: FC<PercentInputProps> = ({ value, onChange }) => {
  const [isPressed, setPressed] = useState(false);

  const borderTopColor = useThemeValue('surface-neutral-subdued');
  const widths = useMemo(() => {
    const m0 = value >= 25 ? 100 : Math.floor((value / 25) * 100);
    const m1 = value >= 50 ? 100 : Math.floor(((value - 25) / 25) * 100);
    const m2 = value >= 75 ? 100 : Math.floor(((value - 50) / 25) * 100);
    const m3 = value >= 100 ? 100 : Math.floor(((value - 75) / 25) * 100);
    return [`${m0}%`, `${m1}%`, `${m2}%`, `${m3}%`];
  }, [value]);

  const handleChange = useCallback(
    (v: number) => {
      setPressed(true);
      onChange(v);
    },
    [onChange],
  );

  const handleChangeEnd = useCallback(
    (v: number) => {
      setPressed(false);
      onChange(v);
    },
    [onChange],
  );

  return (
    <Slider
      maxW="300"
      value={Math.min(value, 100)}
      minValue={0}
      maxValue={100}
      step={1}
      onChangeEnd={handleChangeEnd}
      onChange={handleChange}
    >
      <Slider.Track position="relative">
        <HStack space={1} w="full" h="full" bg="background-default">
          <Box flex="1" bg="surface-neutral-default" position="relative">
            <Box
              position="absolute"
              h="full"
              bg="interactive-default"
              w={widths[0]}
            />
          </Box>
          <Box flex="1" bg="surface-neutral-default">
            <Box
              position="absolute"
              h="full"
              bg="interactive-default"
              w={widths[1]}
            />
          </Box>
          <Box flex="1" bg="surface-neutral-default">
            <Box
              position="absolute"
              h="full"
              bg="interactive-default"
              w={widths[2]}
            />
          </Box>
          <Box flex="1" bg="surface-neutral-default">
            <Box
              position="absolute"
              h="full"
              bg="interactive-default"
              w={widths[3]}
            />
          </Box>
        </HStack>
      </Slider.Track>
      <Box
        position="absolute"
        pointerEvents="none"
        left={`${value}%`}
        style={{ transform: [{ translateX: -8 }] }}
      >
        <Box position="relative">
          <Box
            w="4"
            h="4"
            bg="icon-default"
            justifyContent="center"
            alignItems="center"
            borderRadius="full"
          >
            <Box w="3" h="3" bg="surface-neutral-default" borderRadius="full">
              {isPressed}
            </Box>
          </Box>
          {isPressed ? (
            <Box
              position="absolute"
              zIndex={1}
              right={0}
              bottom={8}
              bg="surface-neutral-subdued"
              borderRadius={4}
              style={{ transform: [{ translateX: 10 }] }}
            >
              <Box
                style={{
                  width: 0,
                  height: 0,
                  backgroundColor: 'transparent',
                  borderStyle: 'solid',
                  borderLeftWidth: 5,
                  borderRightWidth: 5,
                  borderTopWidth: 10,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor,
                  position: 'absolute',
                  bottom: -8,
                  right: 12,
                }}
              />
              <Box p="1">
                <Typography.CaptionStrong color="text-default">
                  {value}%
                </Typography.CaptionStrong>
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Slider>
  );
};

export default PercentInput;
