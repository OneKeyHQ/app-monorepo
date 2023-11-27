import { memo } from 'react';

import { Page, Text } from '@onekeyhq/components';

const Swap = () => {
  console.log('swap');

  return (
    <Page>
      <Page.Body space="$4">
        <Text>Swap</Text>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
