import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatDate,
  formatDistanceStrict,
} from '@onekeyhq/shared/src/utils/dateUtils';
import {
  EParseTxDateTimeFormat,
  type IDisplayComponentDateTime,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

export const MAX_UINT48_STRING = '281474976710655';

interface IProps {
  component: IDisplayComponentDateTime;
}

function DateTime(props: IProps) {
  const { component } = props;
  const intl = useIntl();

  const formattedDateTime = useMemo(() => {
    const now = new Date();
    const timestamp = new BigNumber(component.value ?? 0);

    if (timestamp.gte(MAX_UINT48_STRING)) {
      return intl.formatMessage({
        id: ETranslations.global_forever,
      });
    }

    let timestampInMs =
      timestamp.toFixed().length <= 10 ? timestamp.times(1000) : timestamp;
    const duration = timestampInMs.minus(new Date().getTime());
    timestampInMs = duration.isGreaterThan(0)
      ? timestampInMs
      : new BigNumber(now.getTime());
    if (component.format === EParseTxDateTimeFormat.Duration) {
      return formatDistanceStrict(new Date(timestampInMs.toNumber()), now);
    }
    return formatDate(new Date(timestampInMs.toNumber()));
  }, [component.value, component.format, intl]);

  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>{component.label}</SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {formattedDateTime}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export { DateTime };
