import React, { useCallback } from 'react';

import { useNavigation } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';
import { useSwapActionHandlers, useSwapState } from '../hooks/useSwap';
import { refs } from '../refs';

import type { Token } from '../../../store/typings';

const Input = () => {
  const navigation = useNavigation();
  const { outputToken } = useSwapState();
  const { onSelectToken } = useSwapActionHandlers();
  const onPress = useCallback(
    (token: Token) => {
      onSelectToken(token, 'INPUT');
      refs.inputIsDirty = true;
      navigation.goBack();
    },
    [navigation, onSelectToken],
  );
  return <TokenSelector onPress={onPress} excluded={outputToken} />;
};

export default Input;
