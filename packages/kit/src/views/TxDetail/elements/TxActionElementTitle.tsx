import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';

import type { ITxActionMeta } from '../types';

export function TxActionElementTitle(
  props: ITxActionMeta & ComponentProps<typeof Text>,
) {
  const { titleInfo, iconInfo, transferAmount, ...others } = props;
  const intl = useIntl();
  let title = '';
  if (titleInfo?.titleKey) {
    title = intl.formatMessage({ id: titleInfo?.titleKey });
  }
  if (titleInfo?.title) {
    title = titleInfo?.title;
  }
  if (!title) {
    return null;
  }
  return <Text {...others}>{title || ''}</Text>;
}

export function TxActionElementTitleHeading(
  props: ComponentProps<typeof TxActionElementTitle>,
) {
  return <TxActionElementTitle typography="Heading" {...props} />;
}

export function TxActionElementTitleNormal(
  props: ComponentProps<typeof TxActionElementTitle>,
) {
  return <TxActionElementTitle typography="Body1Strong" {...props} />;
}
