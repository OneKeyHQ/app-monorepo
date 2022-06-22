import React from 'react';

import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

type PriceLabelProps = {
  price: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price }) => {
  const intl = useIntl();
  const priceLabel = intl.formatMessage({
    // TODO replace with real id
    id: 'content__total',
  });
  return (
    <>
      <Typography.DisplayXLarge>
        {priceLabel} ${price}
      </Typography.DisplayXLarge>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
