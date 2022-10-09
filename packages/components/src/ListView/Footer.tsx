import { FC } from 'react';

import { Text } from '@onekeyhq/components';

interface FooterProps {
  text: string;
}

const Footer: FC<FooterProps> = ({ text }) => (
  <Text p={2} typography="Body2" color="text-subdued">
    {text}
  </Text>
);

export default Footer;
