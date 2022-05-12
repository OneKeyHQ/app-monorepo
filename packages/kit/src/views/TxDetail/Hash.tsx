import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';
import { ContentItemProps } from '@onekeyhq/components/src/ContentBox/ContentBasisItem';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { useToast } from '../../hooks';

export type HashProps = {
  hash: string; // tx hash
} & ContentItemProps;

const Hash: FC<HashProps> = (props) => {
  const { hash } = props;
  const intl = useIntl();
  const toast = useToast();

  const copyHashToClipboard = useCallback(() => {
    copyToClipboard(hash ?? '');
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [hash, toast, intl]);

  return (
    <Container.Item
      {...props}
      title={intl.formatMessage({ id: 'content__hash' })}
      describe={shortenAddress(hash ?? '', 8)}
      customArrowIconName="DuplicateSolid"
      onArrowIconPress={copyHashToClipboard}
    />
  );
};

export default Hash;
