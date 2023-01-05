import type { FC } from 'react';

import bg from '@onekeyhq/kit/assets/annual/2.png';

import { Container, WText } from '../components';

const AnnualPage1: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText
        fontWeight="600"
        fontSize="24px"
        color="#E2E2E8"
        mb="2"
        lineHeight="34px"
      >
        您的总资产
      </WText>
      <WText
        fontWeight="800"
        fontSize="40px"
        lineHeight="48px"
        color="#E2E2E8"
        mb="2"
      >
        $14267
      </WText>
      <WText fontWeight="600" fontSize="24px" color="#E2E2E8" mb="2">
        折合 0.26 BTC
      </WText>
      <WText
        fontWeight="600"
        fontSize="24px"
        lineHeight="34px"
        color="#E2E2E8"
        mb="2"
        mt="6"
      >
        {`算不上富可敌国，\n但您懂得手握私钥，\n每一分每一毫，\n都真正属于您自己。`}
      </WText>
      <WText
        fontWeight="800"
        fontSize="40px"
        color="#E2E2E8"
        mb="2"
        lineHeight="48px"
        mt="8"
      >
        #HYOK
      </WText>
    </Container>
  );
};

export default AnnualPage1;
