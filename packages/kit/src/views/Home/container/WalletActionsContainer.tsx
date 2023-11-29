import { useCallback } from 'react';

import { WalletActions } from '../components/WalletActions';

function WalletActionsContainer() {
  const handleOnSend = useCallback(() => {}, []);

  const handleOnReceive = useCallback(() => {}, []);

  return <WalletActions onSend={handleOnSend} onReceive={handleOnReceive} />;
}

export { WalletActionsContainer };
