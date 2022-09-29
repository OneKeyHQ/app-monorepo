import React, { FC, ReactNode } from 'react';

import { Text } from '@onekeyhq/components';

export type FooterProps = {
  footer?: string | ReactNode;
};

const defaultProps = {} as const;

const Footer: FC<FooterProps> = ({ footer }) => (
  <>
    {React.isValidElement(footer) ? (
      footer
    ) : (
      <Text p={2} typography="Body2" color="text-subdued">
        {footer}
      </Text>
    )}
  </>
);

Footer.defaultProps = defaultProps;

export default Footer;
