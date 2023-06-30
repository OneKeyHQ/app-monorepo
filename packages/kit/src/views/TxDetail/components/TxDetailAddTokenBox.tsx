import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Spinner, ToastManager } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { useAccountTokens, useActiveWalletAccount } from '../../../hooks';

import type { ITxActionListViewProps } from '../types';

type Props = ITxActionListViewProps & {
  tokensInTx: Token[];
};

function TxDetailAddTokenBox(props: Props) {
  const intl = useIntl();
  const { tokensInTx } = props;

  const [tokensNotInList, setTokensNotInList] = useState<Token[]>([]);
  const [isAddingTokens, setIsAddingTokens] = useState(false);

  const { accountId, networkId } = useActiveWalletAccount();

  const accountTokens = useAccountTokens(networkId, accountId);

  const handleAddToken = useCallback(async () => {
    if (isAddingTokens) return;
    setIsAddingTokens(true);
    let addTokenSuccessed = false;
    for (let i = 0, len = tokensNotInList.length; i < len; i += 1) {
      const token = tokensNotInList[i];
      const result = await backgroundApiProxy.serviceToken.addAccountToken(
        networkId,
        accountId,
        token.tokenIdOnNetwork,
      );
      if (result) {
        addTokenSuccessed = true;
      }
    }

    if (addTokenSuccessed) {
      ToastManager.show({
        title: intl.formatMessage({
          id: 'msg__token_added',
          defaultMessage: 'Token Added',
        }),
      });
      await backgroundApiProxy.serviceToken.fetchAccountTokens({
        accountId,
        networkId,
      });
    }

    setIsAddingTokens(false);
  }, [accountId, intl, isAddingTokens, networkId, tokensNotInList]);

  useEffect(() => {
    const getTokensNotInList = () => {
      const tokens: Token[] = [];
      for (let i = 0, len = tokensInTx.length; i < len; i += 1) {
        const tokenInfo = tokensInTx[i];
        const isOwned = accountTokens.some(
          (t) =>
            tokenInfo.tokenIdOnNetwork === t.tokenIdOnNetwork &&
            !t.autoDetected,
        );
        if (!isOwned) {
          tokens.push(tokenInfo);
        }
      }
      setTokensNotInList(tokens);
    };
    getTokensNotInList();
  }, [tokensInTx, accountTokens]);

  if (!tokensNotInList || tokensNotInList.length === 0) return null;

  return (
    <Box mb={6}>
      <Alert
        title="Add x to your token list"
        alertType="info"
        dismiss={false}
        action={
          isAddingTokens ? (
            <Spinner />
          ) : (
            intl.formatMessage({ id: 'action__add' })
          )
        }
        onAction={handleAddToken}
      />
    </Box>
  );
}

export { TxDetailAddTokenBox };
