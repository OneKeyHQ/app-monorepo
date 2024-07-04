import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  ScrollView,
  SizableText,
  useClipboard,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { checkIsEvmNativeTransfer } from '@onekeyhq/kit-bg/src/vaults/impls/evm/decoder/utils';
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
  const { copyText } = useClipboard();

  const encodedTx = unsignedTx?.encodedTx as IEncodedTxEvm;

  if (
    encodedTx &&
    encodedTx.data &&
    !checkIsEvmNativeTransfer({ tx: encodedTx })
  ) {
    return (
      <>
        <Divider mx="$5" />
        <InfoItemGroup>
          <InfoItem
            label={
              <Button
                alignSelf="flex-start"
                variant="tertiary"
                size="small"
                iconAfter={
                  shouldShowData
                    ? 'ChevronDownSmallOutline'
                    : 'ChevronRightSmallOutline'
                }
                onPress={() => setShouldShowData((prev) => !prev)}
              >
                {intl.formatMessage({ id: ETranslations.transaction_data })}
              </Button>
            }
            renderContent={
              shouldShowData ? (
                <ScrollView
                  maxHeight="$48"
                  showsVerticalScrollIndicator={false}
                  borderRadius="$3"
                  borderCurve="continuous"
                  bg="$bgSubdued"
                >
                  <SizableText
                    p="$4"
                    size="$bodyMd"
                    color="$textSubdued"
                    flex={1}
                    hoverStyle={{
                      color: '$text',
                    }}
                    userSelect="none"
                    onPress={() => {
                      copyText(encodedTx.data as string);
                    }}
                  >
                    {encodedTx.data}
                  </SizableText>
                </ScrollView>
              ) : null
            }
          />
        </InfoItemGroup>
      </>
    );
  }

  return null;
}

export { TxExtraInfoContainer };
