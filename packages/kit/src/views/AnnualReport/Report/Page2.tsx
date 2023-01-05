import type { FC } from 'react';

import { HStack, VStack } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/3.png';

import { Container, WText } from '../components';

const AnnualPage2: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <VStack>
        <WText
          fontWeight="600"
          fontSize="24px"
          color="#E2E2E8"
          mb="2"
          lineHeight="34px"
        >
          您的持仓风格
        </WText>
        <WText
          fontWeight="800"
          fontSize="40px"
          lineHeight="50px"
          color="#E2E2E8"
          mb="30px"
        >
          #我只HODL
        </WText>
        <HStack flexWrap="wrap">
          <WText
            color="text-success"
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            pr="16px"
          >
            ETH
          </WText>
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            color="#E2E2E8"
          >
            是您最偏爱的资产，
          </WText>
        </HStack>

        <HStack flexWrap="wrap">
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            color="#E2E2E8"
          >
            但
          </WText>
          <WText
            color="text-success"
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            px="2"
          >
            USDC
          </WText>
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            color="#E2E2E8"
          >
            和
          </WText>
          <WText
            color="text-success"
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            px="2"
          >
            USDT
          </WText>

          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            color="#E2E2E8"
          >
            您也很中意。
          </WText>
        </HStack>
      </VStack>
    </Container>
  );
};

export default AnnualPage2;
