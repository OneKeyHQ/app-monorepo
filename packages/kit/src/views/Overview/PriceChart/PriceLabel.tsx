import React, { useEffect, useRef } from 'react';

import { Typography } from '@onekeyhq/components';

type PriceLabelProps = {
  price?: number;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price }) => {
  const intl = useIntl();
  return (
    <>
      <Typography.Subheading>Price</Typography.Subheading>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
