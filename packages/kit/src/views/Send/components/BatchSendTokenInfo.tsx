import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Divider, HStack, Text } from '@onekeyhq/components';

import {
  useNativeToken,
  useSingleToken,
  useTokenBalance,
} from '../../../hooks/useTokens';
import { BulkSenderTypeEnum } from '../../BulkSender/types';

import type { BatchSendConfirmPayloadInfo } from '../types';

type Props = {
  accountId: string;
  networkId: string;
  type: BulkSenderTypeEnum;
  payloadInfo?: BatchSendConfirmPayloadInfo;
};

function TokenInfoBlock({
  title,
  content,
}: {
  title: string;
  content: string | undefined;
}) {
  return (
    <Box flex={1}>
      <Text typography="Body2Strong" color="text-subdued">
        {title}
      </Text>
      <Text typography="Body1Strong" mt={1}>
        {content}
      </Text>
    </Box>
  );
}

function BatchSendTokenInfo(props: Props) {
  const { accountId, networkId, payloadInfo, type } = props;

  const transferInfos = payloadInfo?.transferInfos ?? [];
  const transferInfo = transferInfos[0];
  const tokenIdOnNetwork = transferInfo.token ?? '';

  let amountBN = new BigNumber(0);
  const addresses = new Set();

  for (let i = 0; i < transferInfos.length; i += 1) {
    amountBN = amountBN.plus(transferInfos[i].amount);
    addresses.add(transferInfos[i].to.toLowerCase());
  }
  const { token } = useSingleToken(networkId, tokenIdOnNetwork);
  const nativeToken = useNativeToken(networkId);
  const tokenBalance = useTokenBalance({ accountId, networkId, token });
  const nativeTokenBalance = useTokenBalance({
    accountId,
    networkId,
    token: nativeToken,
  });

  return (
    <Box
      borderWidth={1}
      borderColor="border-subdued"
      borderStyle="solid"
      borderRadius="12px"
      paddingX={4}
      bgColor="surface-default"
    >
      <HStack paddingY={4} space={2}>
        <TokenInfoBlock
          title="Address Count"
          content={Array.from(addresses).length.toString()}
        />
        <TokenInfoBlock
          title="Transfer Amount"
          content={`${amountBN.toFixed()} ${token?.symbol ?? ''}`}
        />
      </HStack>
      <Divider />
      <HStack paddingY={4} space={2}>
        <TokenInfoBlock
          title="Token Balance"
          content={`${tokenBalance ?? 0} ${token?.symbol ?? ''}`}
        />
        {type === BulkSenderTypeEnum.Token && (
          <TokenInfoBlock
            title="Native Balance"
            content={`${nativeTokenBalance ?? 0} ${nativeToken?.symbol ?? ''}`}
          />
        )}
      </HStack>
    </Box>
  );
}

export { BatchSendTokenInfo };
