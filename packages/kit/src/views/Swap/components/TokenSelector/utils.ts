import { createTokenSelectorUtils } from '../../hooks/useTokenSelecter';

import { TokenSelectorContext } from './context';

const { useAccountTokens, useTokenList, Observer } =
  createTokenSelectorUtils(TokenSelectorContext);

export {
  useAccountTokens as useContextAccountTokens,
  useTokenList as useContextTokenList,
  Observer,
};
