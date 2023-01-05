import type { FC } from 'react';

import { HStack, Icon, Image, VStack } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/4.png';

import { Container, WText } from '../components';

const AnnualPage3: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText
        fontWeight="600"
        fontSize="32px"
        color="#E2E2E8"
        mb="2"
        lineHeight="45px"
      >
        {`最爱NFT的您，\n这一年也有不少收获。`}
      </WText>
      <HStack mt="6">
        <VStack flex="1">
          <WText
            fontWeight="800"
            fontSize="20px"
            lineHeight="28px"
            color="#E2E2E8"
            mb="2"
          >
            花了
          </WText>
          <WText
            fontWeight="bold"
            fontSize="24px"
            lineHeight="29px"
            color="#E2E2E8"
            mb="2"
          >
            23.3 ETH
          </WText>
        </VStack>
        <VStack flex="1">
          <WText
            fontWeight="800"
            fontSize="20px"
            lineHeight="28px"
            color="#E2E2E8"
            mb="2"
          >
            盈利
          </WText>
          <WText
            fontWeight="bold"
            fontSize="24px"
            lineHeight="29px"
            color="#E2E2E8"
            mb="6"
          >
            -2.3 ETH
          </WText>
        </VStack>
      </HStack>
      <HStack alignItems="center">
        <Image
          source={{
            uri: 'https://common.onekey-asset.com/token/evm-1/0xdAC17F958D2ee523a2206206994597C13D831ec7.jpg',
          }}
          w={20}
          h={20}
          mr="6"
        />
        <VStack>
          <WText
            fontWeight="600"
            fontSize="20px"
            lineHeight="28px"
            color="#E2E2E8"
            mb="2"
          >
            KaijuKing #6511
          </WText>
          <WText
            fontWeight="600"
            fontSize="20px"
            lineHeight="28px"
            color="text-success"
          >
            13%
          </WText>
        </VStack>
      </HStack>
    </Container>
  );
};

export default AnnualPage3;
