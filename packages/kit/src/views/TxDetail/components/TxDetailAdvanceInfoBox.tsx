import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Collapse,
  Icon,
  IconButton,
  Text,
} from '@onekeyhq/components';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';

import { TxDetailActionBox } from './TxDetailActionBox';

import type { ITxActionElementDetail, ITxActionListViewProps } from '../types';
import { TxDetailHashMoreMenu } from './TxDetailHashMoreMenu';
import { TxDetailHexDataMoreMenu } from './TxDetailHexDataMoreMenu';

function TxDetailAdvanceInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, historyTx, feeInput, isSendConfirm } = props;

  const intl = useIntl();

  if (!isSendConfirm) {
    const details: ITxActionElementDetail[] = [];

    if (decodedTx.nonce && decodedTx.nonce >= 0) {
      details.push({
        title: intl.formatMessage({ id: 'form__nonce' }),
        content: `${new BigNumber(decodedTx.nonce).toFixed()}`,
      });

      if (decodedTx.data) {
        details.push({
          title: intl.formatMessage({ id: 'form__hex_data' }),
          content: (
            <Text numberOfLines={1} typography="Body2Strong">
              {decodedTx.data}
            </Text>
          ),
          extra: (
            <TxDetailHexDataMoreMenu decodedTx={decodedTx}>
              <IconButton
                circle
                type="plain"
                iconSize={18}
                name="EllipsisVerticalOutline"
              />
            </TxDetailHexDataMoreMenu>
          ),
        });
      }
    }

    return (
      <Collapse
        arrowPosition="right"
        renderCustomTrigger={(onPress, collapsed) =>
          collapsed ? (
            <Button
              rightIcon={
                <Icon size={12} name="ChevronDownMini" color="icon-subdued" />
              }
              type="plain"
              size="sm"
              mt={2}
              onPress={onPress}
            >
              <Text
                textAlign="center"
                typography="Body1Strong"
                fontSize="14px"
                color="text-subdued"
              >
                {intl.formatMessage({ id: 'action__advance' })}
              </Text>
            </Button>
          ) : null
        }
      >
        <Box mt={6}>
          <TxDetailActionBox details={details} />
        </Box>
      </Collapse>
    );
  }

  return null;
}

export { TxDetailAdvanceInfoBox };
