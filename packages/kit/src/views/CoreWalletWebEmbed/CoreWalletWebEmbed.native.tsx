import { memo } from 'react';

import { CoreWalletWebEmbedWebview } from './CoreWalletWebEmbedWebview';

function CoreWalletWebEmbed() {
  return (
    <CoreWalletWebEmbedWebview
      routePath="/core_wallet"
      onContentLoaded={() => {
        console.log('CoreWalletWebEmbedWebview onContentLoaded');
      }}
    />
  );
}

export default memo(CoreWalletWebEmbed);
