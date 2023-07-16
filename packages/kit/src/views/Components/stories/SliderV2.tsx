import { Center, SliderV2 as Slider } from '@onekeyhq/components';


const BaseExample = () => (
  <Slider
    value={70}
    minimumValue={0}
    maximumValue={100}
    accessibilityLabel="hello world"
    step={10}
  />
);

const SliderGallery = () => (
  <Center alignItems="center" w="full" h="full">
    <BaseExample />
  </Center>
);

const GalleryV2 = () => <SliderGallery />;

export default GalleryV2;
