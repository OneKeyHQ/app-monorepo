import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Image, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  data: IStakingInfo;
};

function StakingInfo(props: IProps) {
  const { data } = props;
  const intl = useIntl();

  if (!data) {
    return null;
  }

  return (
    <XStack flexWrap="wrap" testID="staking-info" pt="$5">
      <SignatureConfirmItem compact>
        <SignatureConfirmItem.Label>
          {intl.formatMessage({
            id: ETranslations.swap_history_detail_provider,
          })}
        </SignatureConfirmItem.Label>
        <XStack alignItems="center" gap="$2">
          <Image
            borderRadius="$1"
            w="$5"
            h="$5"
            source={{ uri: data.protocolLogoURI }}
          />
          <SignatureConfirmItem.Value>
            {data.protocol}
          </SignatureConfirmItem.Value>
        </XStack>
      </SignatureConfirmItem>
    </XStack>
  );
}

export default memo(StakingInfo);
