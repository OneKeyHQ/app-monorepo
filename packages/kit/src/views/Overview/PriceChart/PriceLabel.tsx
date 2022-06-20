import React from 'react';

import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

type PriceLabelProps = {
  price?: number;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price = 0 }) => {
  const intl = useIntl();
  return (
    <>
      <Typography.Subheading>Price ${price}</Typography.Subheading>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
