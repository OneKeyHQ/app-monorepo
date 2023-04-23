import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { Box, Center, HStack, Slider } from '@onekeyhq/components';

type PercentInputProps = Exclude<
  ComponentProps<typeof Slider>,
  'onChangeEnd' | 'onChange'
> & {
  value: number;
  onChange: (value: number) => void;
};

const BaseExample = () => (
  <Slider
    w="3/4"
    maxW="300"
    defaultValue={70}
    minValue={0}
    maxValue={100}
    accessibilityLabel="hello world"
    step={10}
  >
    <Slider.Track>
      <Slider.FilledTrack />
    </Slider.Track>
    <Slider.Thumb />
  </Slider>
);

const PercentInput: FC<PercentInputProps> = ({ value, onChange, ...rest }) => {
  const widths = useMemo(() => {
    const m0 = value >= 25 ? 100 : Math.floor((value / 25) * 100);
    const m1 = value >= 50 ? 100 : Math.floor(((value - 25) / 25) * 100);
    const m2 = value >= 75 ? 100 : Math.floor(((value - 50) / 25) * 100);
    const m3 = value >= 100 ? 100 : Math.floor(((value - 75) / 25) * 100);
    return [`${m0}%`, `${m1}%`, `${m2}%`, `${m3}%`];
  }, [value]);

  const handleChange = useCallback(
    (v: number) => {
      onChange(v);
    },
    [onChange],
  );

  const handleChangeEnd = useCallback(
    (v: number) => {
      onChange(v);
    },
    [onChange],
  );

  const valueNum = Math.min(value, 100);

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
        children: (
          <Box
            w="4"
            h="4"
            bg="icon-default"
            justifyContent="center"
            alignItems="center"
            borderRadius="full"
          >
            <Box w="3" h="3" bg="surface-neutral-default" borderRadius="full" />
          </Box>
        ),
        borderWidth: 0,
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
        borderWidth="0"
        bg="transparent"
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

const PercentInputExample = () => {
  const [value, setValue] = useState(0);
  return <PercentInput value={value} onChange={setValue} />;
};

const SliderGallery = () => (
  <Center alignItems="center" w="full" h="full">
    <BaseExample />
    <Box p="10" />
    <PercentInputExample />
  </Center>
);

const Gallery = () => <SliderGallery />;

export default Gallery;
