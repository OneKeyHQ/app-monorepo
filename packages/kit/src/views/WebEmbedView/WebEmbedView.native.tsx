import { memo } from 'react';

import { WebEmbedWebview } from './WebEmbedWebview';

function WebEmbedView() {
  return (
    <WebEmbedWebview
      routePath="/webembed_api"
      onContentLoaded={() => {
        console.log('WebEmbedWebview onContentLoaded');
      }}
    />
  );
}

export default memo(WebEmbedView);
