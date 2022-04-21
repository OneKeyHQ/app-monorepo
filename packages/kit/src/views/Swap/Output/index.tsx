import React, { useCallback } from 'react';

import { useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';

import type { Token } from '../../../store/typings';

const Output = () => {
  const navigation = useNavigation();
  const { inputToken } = useSwapState();
  const { onSelectToken } = useSwapActionHandlers();
  const onPress = useCallback(
    (token: Token) => {
      onSelectToken(token, 'OUTPUT');
      navigation.goBack();
    },
    [navigation, onSelectToken],
  );
  return <TokenSelector onPress={onPress} excluded={inputToken} />;
};

export default Output;
