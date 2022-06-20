import React from 'react';

import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

type PriceLabelProps = {
  price: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price }) => {
  const intl = useIntl();
  return (
    <>
      <Typography.Subheading>Price ${price}</Typography.Subheading>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
