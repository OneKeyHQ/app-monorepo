import { useEffect, useState } from 'react';

import { Dimensions } from 'react-native';

export const useOrientation = () => {
  const [isLandscape, setIsLandscape] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height,
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      const { width, height } = Dimensions.get('window');
      setIsLandscape(width > height);
    };

    const subscription = Dimensions.addEventListener(
      'change',
      handleOrientationChange,
    );
    return () => {
      subscription.remove();
    };
  }, []);

  return isLandscape;
};
