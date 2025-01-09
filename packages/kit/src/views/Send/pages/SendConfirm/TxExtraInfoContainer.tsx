import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  ScrollView,
  SizableText,
  useClipboard,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

function TxExtraInfoContainer() {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const intl = useIntl();
  const [shouldShowData, setShouldShowData] = useState<boolean>(false);
  const { copyText } = useClipboard();

  const dataContent = useMemo(() => {
    if (!unsignedTxs || unsignedTxs.length === 0) {
      return '';
    }
    return unsignedTxs.reduce((acc, unsignedTx) => {
      const tx = unsignedTx.encodedTx as IEncodedTxEvm;
      if (tx && tx.data) {
        return acc ? `${acc}\n\n${tx.data}` : tx.data;
      }
      return acc;
    }, '');
  }, [unsignedTxs]);

  if (dataContent && dataContent !== '') {
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
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  pb="$5" // for spacing between the text and the border while haven't scroll behavior
                  borderBottomWidth={StyleSheet.hairlineWidth}
                  borderColor="$borderSubdued"
                >
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    flex={1}
                    hoverStyle={{
                      color: '$text',
                    }}
                    userSelect="none"
                    onPress={() => {
                      copyText(dataContent);
                    }}
                  >
                    {dataContent}
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
