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
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { TxDetailActionBox } from './TxDetailActionBox';
import { TxDetailHexDataMoreMenu } from './TxDetailHexDataMoreMenu';

import type { ITxActionElementDetail, ITxActionListViewProps } from '../types';

function TxDetailAdvanceInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, isSendConfirm } = props;

  const intl = useIntl();

  const details: ITxActionElementDetail[] = [];

  if (decodedTx.nonce && decodedTx.nonce >= 0) {
    details.push({
      title: intl.formatMessage({ id: 'form__nonce' }),
      content: `${new BigNumber(decodedTx.nonce).toFixed()}`,
    });
  }

  if ((decodedTx.encodedTx as IEncodedTxEvm)?.data) {
    details.push({
      title: intl.formatMessage({ id: 'form__hex_data' }),
      content: (
        <Text numberOfLines={1} typography="Body2Strong">
          {(decodedTx.encodedTx as IEncodedTxEvm)?.data}
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

  if (isSendConfirm) return null;

  if (!details || details.length === 0) return null;

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
        {isSendConfirm ? null : (
          <Text
            typography="Subheading"
            textTransform="uppercase"
            mb={3}
            color="text-subdued"
          >
            {intl.formatMessage({ id: 'action__advance' })}
          </Text>
        )}
        <TxDetailActionBox details={details} showContentDivider />
      </Box>
    </Collapse>
  );
}

export { TxDetailAdvanceInfoBox };
