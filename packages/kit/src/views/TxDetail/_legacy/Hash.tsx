import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Container, useToast } from '@onekeyhq/components';
import type { ContentItemProps } from '@onekeyhq/components/src/ContentBox/ContentBasisItem';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

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
      customArrowIconName="Square2StackMini"
      onArrowIconPress={copyHashToClipboard}
    />
  );
};

export default Hash;
