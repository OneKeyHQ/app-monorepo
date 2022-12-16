import { Center, Image } from '@onekeyhq/components';

const ImageViewerGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Image
      src="https://img1.baidu.com/it/u=3048781436,3261736990&fm=253&fmt=auto&app=138&f=JPEG?w=889&h=500"
      size={100}
      resizeMode="cover"
      preview
    />
  </Center>
);

export default ImageViewerGallery;
