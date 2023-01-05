import type { FC } from 'react';

import { HStack } from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/7.png';

import { Container, WText } from '../components';

const AnnualPage6: FC<{ height: number }> = ({ height }) => {
  console.log(1);
  return (
    <Container bg={bg} height={height} showLogo={false}>
      <WText fontWeight="600" fontSize="32px" color="#E2E2E8" mb="2">
        2022年，OneKey 更关注您的钱包安全
      </WText>
      <HStack>
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          拦截了
        </WText>
        <WText fontWeight="500" fontSize="20px" color="text-success" px="10px">
          1.12M +
        </WText>
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          个风险代币
        </WText>
      </HStack>
      <HStack mt="2">
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          监控
        </WText>
        <WText fontWeight="500" fontSize="20px" color="text-success" px="10px">
          5000+
        </WText>
        <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
          个dApps
        </WText>
      </HStack>
      <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
        阻止了零金额转账诈骗
      </WText>
      <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
        闪兑防三文治攻击
      </WText>
      <WText fontWeight="500" fontSize="20px" color="#E2E2E8">
        ...
      </WText>

      <WText fontWeight="600" fontSize="20px" mt="6" color="#E2E2E8">
        2023年，会继续为您保驾护航。
      </WText>
    </Container>
  );
};

export default AnnualPage6;
