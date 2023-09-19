import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
  Box,
  Center,
  HStack,
  Slider,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { doHapticsWhenEnabled } from '@onekeyhq/shared/src/haptics';

type PercentInputProps = ComponentProps<typeof Slider> & {
  value: number;
};

const PercentInput: FC<PercentInputProps> = ({
  value,
  onChange,
  onChangeEnd,
  ...rest
}) => {
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
      doHapticsWhenEnabled();
      setPressed(true);
      onChange?.(v);
    },
    [onChange],
  );

  const handleChangeEnd = useCallback(
    (v: number) => {
      doHapticsWhenEnabled();
      setPressed(false);
      onChange?.(v);
      onChangeEnd?.(v);
    },
    [onChange, onChangeEnd],
  );

  const valueNum = Math.min(value, 100);
  const text = `${value}%`;

  return (
    <Slider
      maxW="300"
      value={valueNum}
      minValue={0}
      maxValue={100}
      step={1}
      onChangeEnd={handleChangeEnd}
      onChange={handleChange}
      _interactionBox={{
        borderWidth: 0,
        children: (
          <Box position="relative">
            <Box
              w="4"
              h="4"
              bg="icon-subdued"
              justifyContent="center"
              alignItems="center"
              borderRadius="full"
            >
              <Box
                w="3"
                h="3"
                bg="surface-neutral-default"
                borderRadius="full"
              />
            </Box>
            {isPressed ? (
              <Box
                position="absolute"
                zIndex={1}
                right={0}
                bottom={8}
                bg="surface-neutral-subdued"
                borderRadius={4}
                style={{ transform: [{ translateX: 17 }] }}
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
                    right: 20,
                  }}
                />
                <Center p="1" flexDirection="row" w="12">
                  <Typography.CaptionStrong color="text-default">
                    {text}
                  </Typography.CaptionStrong>
                </Center>
              </Box>
            ) : null}
          </Box>
        ),
      }}
      {...rest}
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
      <Slider.Thumb
        _pressed={{
          borderWidth: 0,
          outlineStyle: 'none',
        }}
        _focus={{
          borderWidth: 0,
          outlineStyle: 'none',
        }}
        _hover={{
          borderWidth: 0,
          outlineStyle: 'none',
        }}
      />
    </Slider>
  );
};

export default PercentInput;
