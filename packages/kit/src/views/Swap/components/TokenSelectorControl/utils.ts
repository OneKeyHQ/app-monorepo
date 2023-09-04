import { createTokenSelectorUtils } from '../../hooks/useTokenSelecter';

import { TokenSelectorControlContext } from './context';

const { useAccountTokens, useTokenList, Observer } = createTokenSelectorUtils(
  TokenSelectorControlContext,
);

export {
  useAccountTokens as useContextAccountTokens,
  useTokenList as useContextTokenList,
  Observer,
};
