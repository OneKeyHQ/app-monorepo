import { useRoute } from '@react-navigation/core';

import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

function TxConfirm() {
  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.TxConfirm
      >
    >();

  return <div>TxConfirm</div>;
}

export default TxConfirm;
