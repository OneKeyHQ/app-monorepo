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
  const [selectedIndex, setSelectedIndex] = useState(0);
  return (
    <ToggleButtonGroup
      buttons={buttons}
      selectedIndex={selectedIndex}
      onButtonPress={setSelectedIndex}
    />
  );
};

export default ToggleButtonGroupGallery;
