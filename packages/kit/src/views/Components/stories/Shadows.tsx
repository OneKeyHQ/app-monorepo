import { Center, HStack } from '@onekeyhq/components';

const ShadowsGallery = () => (
  <HStack flex="1" bg="white" space={10} p={10}>
    <Center w="200px" h="200px" shadow="depth.1" bg="white">
      Depth.1
    </Center>
    <Center w="200px" h="200px" shadow="depth.2" bg="white">
      Depth.2
    </Center>
    <Center w="200px" h="200px" shadow="depth.3" bg="white">
      Depth.3
    </Center>
    <Center w="200px" h="200px" shadow="depth.4" bg="white">
      Depth.4
    </Center>
    <Center w="200px" h="200px" shadow="depth.5" bg="white">
      Depth.5
    </Center>
  </HStack>
);

export default ShadowsGallery;
