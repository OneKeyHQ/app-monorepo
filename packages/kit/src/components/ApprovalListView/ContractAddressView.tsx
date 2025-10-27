import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  IconButton,
  SizableText,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { openExplorerAddressUrl } from '../../utils/explorerUtils';

type IProps = {
  address: string;
  networkId: string;
  showShortAddress?: boolean;
  showCopy?: boolean;
  showExternalLink?: boolean;
  addressStyleProps?: ISizableTextProps;
};

function ContractAddressView(props: IProps) {
  const {
    address,
    networkId,
    showShortAddress,
    showCopy,
    showExternalLink,
    addressStyleProps,
  } = props;

  const intl = useIntl();

  const { copyText } = useClipboard();

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText size="$bodyMdMedium" {...addressStyleProps}>
        {showShortAddress
          ? accountUtils.shortenAddress({
              address,
              leadingLength: 6,
              trailingLength: 4,
            })
          : address}
      </SizableText>
      {showCopy ? (
        <IconButton
          title={intl.formatMessage({ id: ETranslations.global_copy })}
          variant="tertiary"
          icon="Copy3Outline"
          iconColor="$iconSubdued"
          size="small"
          onPress={() => {
            copyText(address);
          }}
        />
      ) : null}
      {showExternalLink ? (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          })}
          variant="tertiary"
          icon="OpenOutline"
          iconColor="$iconSubdued"
          size="small"
          onPress={() =>
            openExplorerAddressUrl({
              networkId,
              address,
              openInExternal: true,
            })
          }
        />
      ) : null}
    </XStack>
  );
}

export default memo(ContractAddressView);
