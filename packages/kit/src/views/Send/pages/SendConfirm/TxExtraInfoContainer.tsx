import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

function TxExtraInfoContainer() {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const unsignedTx = unsignedTxs[0];
  const intl = useIntl();
  const [shouldShowData, setShouldShowData] = useState<boolean>(false);

  const encodedTx = unsignedTx?.encodedTx as IEncodedTxEvm;

  if (encodedTx && encodedTx.data) {
    return (
      <InfoItemGroup>
        <Stack p="$2.5">
          <Button
            size="small"
            iconAfter={
              shouldShowData
                ? 'ChevronTopSmallOutline'
                : 'ChevronDownSmallOutline'
            }
            onPress={() => setShouldShowData((prev) => !prev)}
          >
            {intl.formatMessage({ id: ETranslations.transaction_data })}
          </Button>
        </Stack>
        {shouldShowData ? (
          <InfoItem
            renderContent={
              <Stack flex={1}>
                <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                  {encodedTx.data}
                </SizableText>
              </Stack>
            }
          />
        ) : null}
      </InfoItemGroup>
    );
  }

  return null;
}

export { TxExtraInfoContainer };
