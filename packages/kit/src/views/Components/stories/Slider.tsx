import { Center, Slider } from '@onekeyhq/components';

const SliderGallery = () => (
  <Center alignItems="center" w="full" h="full">
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
  </Center>
);

export default SliderGallery;
