import { createTokenSelectorUtils } from '../../hooks/useTokenSelecter';

import { OutputCrosschainTokenSelectorContext } from './context';

const { useAccountTokens, useTokenList, Observer } = createTokenSelectorUtils(
  OutputCrosschainTokenSelectorContext,
);

export {
  useAccountTokens as useContextAccountTokens,
  useTokenList as useContextTokenList,
  Observer,
};
