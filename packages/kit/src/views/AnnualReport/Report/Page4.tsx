import type { FC } from 'react';

import bg from '@onekeyhq/kit/assets/annual/4.png';

import { Container, WText } from '../components';

const AnnualPage4: FC<{ height: number }> = ({ height }) => {
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
        {`最终，54张小图片，\n依然留在您的钱包里。`}
      </WText>
      <WText
        fontWeight="600"
        fontSize="24px"
        color="#E2E2E8"
        mb="2"
        lineHeight="34px"
      >
        {`也许只有您才清楚，\n哪些是长期持有，\n哪些已经归零。`}
      </WText>
    </Container>
  );
};

export default AnnualPage4;
