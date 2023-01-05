import type { FC } from 'react';

import bg from '@onekeyhq/kit/assets/annual/6.png';

import { Container, WText } from '../components';

const AnnualPage5: FC<{ height: number }> = ({ height }) => {
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
        {`今年重大的Rug事件，\n机智的您逃过了么？`}
      </WText>
      <WText
        fontWeight="900"
        fontSize="24px"
        color="text-success"
        mb="2"
        mt="9"
        lineHeight="29px"
      >
        2022.05.13
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="2">
        LUNA 崩盘事故
      </WText>
      <WText
        fontWeight="900"
        fontSize="24px"
        color="text-success"
        mb="2"
        mt="7"
        lineHeight="29px"
      >
        2022.11.11
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="7">
        FTX RUG 事件
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="9">
        ...
      </WText>
      <WText fontWeight="500" fontSize="24px" color="#E2E2E8" mb="2">
        今年 RUG 事件频发，希望您都幸免于难，成为真正的
      </WText>
      <WText fontWeight="700" fontSize="40px" color="text-success" mb="2">
        跑路高手
      </WText>
    </Container>
  );
};

export default AnnualPage5;
