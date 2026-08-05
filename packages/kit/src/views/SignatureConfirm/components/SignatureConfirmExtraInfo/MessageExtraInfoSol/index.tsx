import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function MessageExtraInfoSol({
  unsignedMessage,
  style,
}: {
  unsignedMessage: IUnsignedMessage;
  style?: IStackProps;
}) {
  const intl = useIntl();

  const { type, payload } = unsignedMessage;

  if (
    type !== EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE ||
    payload?.version !== 1
  ) {
    return null;
  }

  // Version 1 of the offchain message spec encodes the required signers into the bytes being
  // signed, and dropped the application domain in favour of them.
  // Only shown when the message requires someone besides the signing account: a lone signer is
  // the account itself, which the confirm screen already displays above.
  const requiredSigners = payload.requiredSigners ?? [];
  if (requiredSigners.length <= 1) {
    return null;
  }

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({ id: ETranslations.global_accounts })}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Block>
        {requiredSigners.map((signer) => (
          <SignatureConfirmItem.Value key={signer} size="$bodySm">
            {signer}
          </SignatureConfirmItem.Value>
        ))}
      </SignatureConfirmItem.Block>
    </SignatureConfirmItem>
  );
}

export default memo(MessageExtraInfoSol);
