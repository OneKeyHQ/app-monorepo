import { useState } from 'react';

import { Box, ToggleButtonGroup } from '@onekeyhq/components';
import type { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';

const buttons: ToggleButtonProps[] = [
  {
    text: 'BTC',
    leftImage: 'https://uni.onekey-asset.com/static/chain/btc.png',
  },
  {
    text: '',
    leftIcon: 'StarMini',
  },
  {
    text: '',
    leftImage: 'https://uni.onekey-asset.com/static/chain/bsc.png',
  },
  {
    text: 'polygon',
  },
];
const ToggleButtonGroupGallery = () => {
  const [selectedIndex1, setSelectedIndex1] = useState(2);

  const [selectedIndex2, setSelectedIndex2] = useState(10);
  return (
    <>
      <Box h="20px" />
      <ToggleButtonGroup
        buttons={buttons}
        selectedIndex={selectedIndex1}
        onButtonPress={setSelectedIndex1}
      />

      <Box h="20px" />
      <ToggleButtonGroup
        buttons={buttons.concat(buttons).concat(buttons).concat(buttons)}
        selectedIndex={selectedIndex2}
        onButtonPress={setSelectedIndex2}
      />
    </>
  );
};

export default ToggleButtonGroupGallery;
