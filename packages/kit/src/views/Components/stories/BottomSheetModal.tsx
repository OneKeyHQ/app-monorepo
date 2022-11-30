import { useState } from 'react';

import { Box } from '@onekeyhq/components';
import BottomSheetModal from '@onekeyhq/components/src/BottomSheetModal/BottomSheetModal';

const BottomSheetModalGallery = () => {
  const [selectedIndex1, setSelectedIndex1] = useState(2);

  const [selectedIndex2, setSelectedIndex2] = useState(10);
  return (
    <>
      <Box h="20px" />
      <BottomSheetModal />
    </>
  );
};

export default BottomSheetModalGallery;
