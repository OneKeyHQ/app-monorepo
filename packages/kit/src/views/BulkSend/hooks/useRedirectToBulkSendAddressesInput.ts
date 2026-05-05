import { useEffect } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalBulkSendRoutes,
  ETabHomeRoutes,
} from '@onekeyhq/shared/src/routes';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

type IProps = {
  accountId?: string;
  bulkSendMode?: EBulkSendMode;
  hasRequiredParams: boolean;
  isInModal?: boolean;
  networkId?: string;
  tokenInfo?: IToken;
};

export function useRedirectToBulkSendAddressesInput({
  accountId,
  bulkSendMode,
  hasRequiredParams,
  isInModal,
  networkId,
  tokenInfo,
}: IProps) {
  const navigation = useAppNavigation();

  useEffect(() => {
    if (hasRequiredParams) {
      return;
    }

    if (isInModal) {
      navigation.replace(EModalBulkSendRoutes.BulkSendAddressesInput, {
        networkId,
        accountId,
        indexedAccountId: undefined,
        tokenInfo,
        isInModal: true,
        bulkSendMode,
      });
      return;
    }

    navigation.replace(ETabHomeRoutes.TabHomeBulkSendAddressesInput, {
      networkId,
      accountId,
      indexedAccountId: undefined,
      tokenInfo,
      isInModal: false,
      bulkSendMode,
    });
  }, [
    accountId,
    bulkSendMode,
    hasRequiredParams,
    isInModal,
    navigation,
    networkId,
    tokenInfo,
  ]);
}
