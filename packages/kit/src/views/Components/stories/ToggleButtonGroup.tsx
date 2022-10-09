import { useState } from 'react';

import { ToggleButtonGroup } from '@onekeyhq/components';
import { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';

const buttons: ToggleButtonProps[] = [
  {
    text: 'BTC',
    leftImage: 'https://onekey-asset.com/assets/btc/btc.png',
  },
  {
    text: 'ETH',
    leftImage: 'https://onekey-asset.com/assets/eth/eth.png',
  },
  {
    text: 'BSC',
    leftImage: 'https://onekey-asset.com/assets/bsc/bsc.png',
  },
  {
    text: 'polygon',
    leftImage: 'https://onekey-asset.com/assets/polygon/polygon.png',
  },
];
const ToggleButtonGroupGallery = () => {
  const [selectedIndex1, setSelectedIndex1] = useState(2);

  const [selectedIndex2, setSelectedIndex2] = useState(1);
  return (
    <>
      <ToggleButtonGroup
        buttons={buttons}
        selectedIndex={selectedIndex1}
        onButtonPress={setSelectedIndex1}
      />

      <ToggleButtonGroup
        buttons={buttons.concat(buttons).concat(buttons)}
        selectedIndex={selectedIndex2}
        onButtonPress={setSelectedIndex2}
      />
    </>
  );
};

export default ToggleButtonGroupGallery;
