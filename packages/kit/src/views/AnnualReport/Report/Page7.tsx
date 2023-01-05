import type { FC } from 'react';

import { Center } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/3.png';
import bgStart from '@onekeyhq/kit/assets/annual/bg_start.png';

import { BgButton, Container, WText } from '../components';

const AnnualPage7: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText
        textAlign="center"
        fontWeight="600"
        fontSize="20px"
        color="#E2E2E8"
        mb="6"
      >
        回顾您的链上故事，您属于...
      </WText>

      <Center mt="6">
        <BgButton w={196} h={50} bg={bgStart} onPress={console.log}>
          <WText fontSize="16" fontWeight="600">
            保存图片
          </WText>
        </BgButton>
      </Center>
    </Container>
  );
};

export default AnnualPage7;
