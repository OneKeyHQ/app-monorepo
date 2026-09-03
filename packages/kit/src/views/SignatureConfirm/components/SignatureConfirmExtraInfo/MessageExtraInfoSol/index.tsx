import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function MessageExtraInfoSol({
  accountId,
  networkId,
  unsignedMessage,
  style,
}: {
  accountId: string;
  networkId: string;
  unsignedMessage: IUnsignedMessage;
  style?: IStackProps;
}) {
  const intl = useIntl();
  const { account } = useAccountData({ accountId, networkId });

  const { type, payload } = unsignedMessage;

  if (
    type !== EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE ||
    payload?.version !== 1
  ) {
    return null;
  }

  // Version 1 of the offchain message spec encodes the required signers into the bytes being
  // signed, and dropped the application domain in favour of them, so they are what tells the
  // user who this message commits.
  //
  // Listed whenever anyone other than the signing account is required. When the account is the
  // only required signer there is nothing to add: it is already shown above. Decided by
  // comparing addresses rather than by counting, so a lone signer that is NOT this account
  // still shows up, which is exactly the case worth surfacing.
  const { requiredSigners } = payload;
  const accountAddress = account?.address;
  const requiresOnlyThisAccount =
    requiredSigners.length > 0 &&
    Boolean(accountAddress) &&
    requiredSigners.every((signer) => signer === accountAddress);

  if (requiredSigners.length === 0 || requiresOnlyThisAccount) {
    return null;
  }

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>
        {`${intl.formatMessage({ id: ETranslations.global_accounts })} (${
          requiredSigners.length
        })`}
      </SignatureConfirmItem.Label>
      {/* One box per signer: base58 addresses wrap onto several lines, so stacked plain text
          gives no way to tell where one address ends and the next begins. */}
      <YStack gap="$2">
        {requiredSigners.map((signer) => (
          <SignatureConfirmItem.Block key={signer}>
            <SignatureConfirmItem.Value size="$bodySm">
              {signer}
            </SignatureConfirmItem.Value>
          </SignatureConfirmItem.Block>
        ))}
      </YStack>
    </SignatureConfirmItem>
  );
}

export default memo(MessageExtraInfoSol);
