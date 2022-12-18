import type { FC } from 'react';

import OnKele from './OnKele';

type StakedETHAssetProps = {
  networkId: string;
  accountId: string;
};

const StakedETHAsset: FC<StakedETHAssetProps> = ({ networkId, accountId }) => (
  <OnKele networkId={networkId} accountId={accountId} />
);

export default StakedETHAsset;
