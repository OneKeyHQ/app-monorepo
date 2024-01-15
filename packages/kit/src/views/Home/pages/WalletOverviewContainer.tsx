import { useEffect, useState } from 'react';

import { WalletOverview } from '../components/WalletOverview';

const address =
  'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh';
const value = '$42.13';

function WalletOverviewContainer() {
  const [isFetchingValue, setIsFetchingValue] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsFetchingValue(false);
    }, 1000);
  }, []);

  return (
    <WalletOverview
      address={address}
      value={value}
      isFetchingValue={isFetchingValue}
    />
  );
}

export { WalletOverviewContainer };
