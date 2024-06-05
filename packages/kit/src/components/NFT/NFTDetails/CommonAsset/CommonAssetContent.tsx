/* eslint-disable camelcase */
import { useMemo } from 'react';

import { isNil, isObject } from 'lodash';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  DescriptionList,
  Divider,
  Heading,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  ETraitsDisplayType,
  type IAccountNFT,
} from '@onekeyhq/shared/types/nft';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

type IProps = {
  networkId: string;
  nft: IAccountNFT;
};

function CommonAssetContent(props: IProps) {
  const intl = useIntl();
  const { networkId, nft } = props;
  const { attributes } = nft.metadata ?? {};
  const { copyText } = useClipboard();

  const { network } = useAccountData({ networkId });

  const details: {
    label: string;
    value: string;
    onPress?: () => void;
    iconAfter?: IKeyOfIcons;
  }[] = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({ id: 'content__collection' }),
          value: nft.collectionName,
        },
        {
          label: intl.formatMessage({ id: 'network__network' }),
          value: network?.name ?? '',
        },
        {
          label: 'Token ID',
          value: nft.itemId,
        },
        {
          label: intl.formatMessage({ id: 'content__nft_standard' }),
          value: nft.collectionType,
        },
        {
          label: intl.formatMessage({
            id: 'transaction__contract_address',
          }),
          value: accountUtils.shortenAddress({
            address: nft.collectionAddress,
          }),
          onPress: () => copyText(nft.collectionAddress),
          iconAfter: 'Copy1Outline' as IKeyOfIcons,
        },
      ].filter((item) => !isNil(item.value)),
    [
      copyText,
      intl,
      network?.name,
      nft.collectionAddress,
      nft.collectionName,
      nft.collectionType,
      nft.itemId,
    ],
  );

  return (
    <Stack
      px="$5"
      $gtMd={{
        flexBasis: '66.6666%',
      }}
      space="$5"
    >
      <DescriptionList>
        {details.map(({ label, value, onPress, iconAfter }) => (
          <DescriptionList.Item key={label}>
            <DescriptionList.Item.Key size="$bodyMd" color="$textSubdued">
              {label}
            </DescriptionList.Item.Key>
            <DescriptionList.Item.Value
              maxWidth="70%"
              onPress={onPress}
              iconAfter={iconAfter}
              textProps={{
                numberOfLines: 999,
              }}
            >
              {value}
            </DescriptionList.Item.Value>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
      {/* Attributes */}
      <Divider />
      <Stack>
        <Heading size="$headingSm">Attributes</Heading>
        {attributes?.length ? (
          <XStack m="$-1" pt="$2.5" flexWrap="wrap">
            {attributes?.map(({ traitType, value, displayType }) =>
              isObject(value) ? null : (
                <Stack
                  key={traitType}
                  py="$2"
                  px="$3.5"
                  m="$1"
                  bg="$bgStrong"
                  borderRadius="$2"
                  borderCurve="continuous"
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {traitType}
                  </SizableText>
                  <SizableText size="$bodyMdMedium">
                    {displayType === ETraitsDisplayType.Date
                      ? formatDate(new Date(value),{})
                      : value}
                  </SizableText>
                </Stack>
              ),
            )}
          </XStack>
        ) : (
          <SizableText size="$bodyMd" mt="$2" color="$textSubdued">
            🤷‍♂️ We haven't found any attributes for this NFT.
          </SizableText>
        )}
      </Stack>
    </Stack>
  );
}

export { CommonAssetContent };
