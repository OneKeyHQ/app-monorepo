import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';

export function useSwapAccountNetworkSync({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const { updateSelectedAccount } = useAccountSelectorActions().current;
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHideByModal: boolean) => {
      if (isHideByModal) return;
      if (isFocus) {
        if (fromToken) {
          updateSelectedAccount({
            num: 0,
            builder: (v) => ({ ...v, networkId: fromToken.networkId }),
          });
        }
        if (toToken) {
          updateSelectedAccount({
            num: 1,
            builder: (v) => ({ ...v, networkId: toToken.networkId }),
          });
        }
      }
    },
  );
}
