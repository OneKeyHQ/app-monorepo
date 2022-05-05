import React, { FC } from 'react';

import {
  Box,
  Center,
  Container,
  HStack,
  Icon,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from '@onekeyhq/components';

const ContainerBox1: FC = () => (
  <Container.Box>
    <Container.Item title="Describe" describe="100000000000000 USDT" />

    <Container.Item
      title="Describe And subDescribe"
      describe="100000000000000 USDT"
      subDescribe="0x5528D82423d91da8E8FE8066FAb15cc014ebd5e2"
    />

    <Container.Item
      title="Receive"
      describe="100000000000000000000000000 USDT"
    />

    <Container.Item
      title="subDescribe"
      subDescribe="0x5528d82423d91da8e8fe8066fab15cc014ebd5e2"
    />

    <Container.Item
      title="Describe And subDescribes"
      describe="Test"
      subDescribe={[
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
      ]}
    />

    <Container.Item
      title="subDescribes"
      subDescribe={[
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
        '0x5528d82423d91da8e8fe8066fab15cc014ebd5e2',
      ]}
    />

    <Container.Item
      hasArrow
      title="0xbb0cf2773d0c28c32388dac00d5d49c6b25a2408694b4581077a032a6a8ab5f2"
      titleColor="text-default"
      onPress={() => {}}
    />

    <Container.Item
      hasArrow
      title="0xbb0cf2773d0c28c32388dac00d5d49c6b25a2408694b4581077a032a6a8ab5f2"
      titleColor="text-default"
      describe="Error"
      describeColor="text-critical"
      onPress={() => {}}
    />

    <Container.Item
      hasArrow
      title="Custom Amount"
      titleColor="text-default"
      describe="Error"
      describeColor="text-critical"
      subDescribeCustom={
        <HStack flex={1} flexWrap="wrap" justifyContent="flex-end">
          <Center w={10} h={10} bg="amber.100">
            1
          </Center>
          <Center w={10} h={10} bg="amber.200">
            2
          </Center>
          <Center w={10} h={10} bg="amber.300">
            3
          </Center>
        </HStack>
      }
    />

    <Container.Item
      hasArrow
      title="Custom HStack View"
      titleColor="text-default"
      subDescribeCustom={
        <HStack mt={2} flex={1} flexWrap="wrap" justifyContent="flex-end">
          <Center w={20} h={20} bg="amber.100">
            1
          </Center>
          <Center w={20} h={20} bg="amber.200">
            2
          </Center>
          <Center w={20} h={20} bg="amber.300">
            3
          </Center>
          <Center w={20} h={20} bg="amber.400">
            4
          </Center>
          <Center w={20} h={20} bg="amber.500">
            5
          </Center>
        </HStack>
      }
    />

    <Container.Item title="Child Content">
      <Box flexDirection="row" justifyContent="flex-end" flexWrap="wrap">
        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          0x5528d8242...1c014ebd5e2
        </Text>
        <Pressable ml={3} onPress={() => {}}>
          <Icon size={20} name="DuplicateSolid" />
        </Pressable>
      </Box>
    </Container.Item>

    <Container.Item
      title="Custom Right Icon"
      describe="0x5528d8242...1c014ebd5e2"
      customArrowIconName="DuplicateSolid"
    />

    <Container.Item
      title="Custom Icon"
      titleColor="text-default"
      subDescribeCustom={
        <Icon name="InformationCircleSolid" color="icon-success" />
      }
    />
  </Container.Box>
);

const ContainerBox2: FC = () => (
  <Container.Box>
    <Container.Item title="Send" describe="100000000000000 USDT" />

    <Container.Item
      title="Send"
      describe="100000000000000 USDT"
      subDescribe="0x5528D82423d91da8E8FE8066FAb15cc014ebd5e2"
    />
  </Container.Box>
);

const ContainerGallery = () => (
  <Center flex="1" bg="background-hovered">
    <ScrollView width="100%">
      <VStack space={4} m={4}>
        <ContainerBox1 key={1} />
        <ContainerBox2 key={2} />
      </VStack>
    </ScrollView>
  </Center>
);

export default ContainerGallery;
