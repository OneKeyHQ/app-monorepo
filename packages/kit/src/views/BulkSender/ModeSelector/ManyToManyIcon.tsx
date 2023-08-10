import type { ComponentProps } from 'react';

import { Divider, VStack } from '@onekeyhq/components';

function ManyToManyIcon(props: ComponentProps<typeof VStack>) {
  return (
    <VStack {...props} space="30px">
      {[1, 2, 3].map((i) => (
        <Divider bg="text-success" height="2px" key={i} />
      ))}
    </VStack>
  );
}

export default ManyToManyIcon;
