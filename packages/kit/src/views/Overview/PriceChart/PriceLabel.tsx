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
      <Typography.DisplayXLarge>Price ${price}</Typography.DisplayXLarge>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
