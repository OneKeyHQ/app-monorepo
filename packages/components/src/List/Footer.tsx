import type { FC } from 'react';
import { isValidElement } from 'react';

import { Text } from '@onekeyhq/components';

interface FooterProps {
  text: string;
}

const Footer: FC<FooterProps> = ({ text }) =>
  isValidElement(text) ? (
    text
  ) : (
    <Text p={2} typography="Body2" color="text-subdued">
      {text}
    </Text>
  );

export default Footer;
