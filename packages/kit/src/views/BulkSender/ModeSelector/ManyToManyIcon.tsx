import type { ComponentProps } from 'react';

import Svg, { Path } from 'react-native-svg';

import { VStack } from '@onekeyhq/components';

function ManyToManyIcon(props: ComponentProps<typeof VStack>) {
  return (
    <VStack {...props} space="30px">
      {[1, 2, 3].map((i) => (
        <Svg width="24" height="2" viewBox="0 0 24 2" fill="none" key={i}>
          <Path
            id="Vector 1"
            d="M0 1H24"
            stroke="#4CC38A"
            stroke-width="1.54"
          />
        </Svg>
      ))}
    </VStack>
  );
}

export default ManyToManyIcon;
