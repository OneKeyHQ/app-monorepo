import { SizableText } from '@onekeyhq/components';

import { Container } from '../Container';

function SingerInfo() {
  return (
    <Container.Box title="With">
      <Container.Item>
        <SizableText>0x12345678</SizableText>
      </Container.Item>
    </Container.Box>
  );
}

export { SingerInfo };
