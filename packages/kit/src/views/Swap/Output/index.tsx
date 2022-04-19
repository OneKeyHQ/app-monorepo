import React, { useCallback } from 'react';

import { useNavigation, useSwap, useSwapQuote } from '../../../hooks';
import TokenSelector from '../components/TokenSelector';

import type { Token } from '../../../store/typings';

const Output = () => {
  const navigation = useNavigation();
  const { setOut, input } = useSwap();
  const { refresh } = useSwapQuote();
  const onPress = useCallback(
    (token: Token) => {
      setOut(token);
      refresh();
      navigation.goBack();
    },
    [navigation, refresh, setOut],
  );
  return <TokenSelector onPress={onPress} excluded={input} />;
};

export default Output;
