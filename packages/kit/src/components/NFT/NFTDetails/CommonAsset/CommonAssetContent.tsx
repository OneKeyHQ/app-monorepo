/* eslint-disable camelcase */
import { useMemo } from 'react';

import { isNil, isObject } from 'lodash';
import { useIntl } from 'react-intl';

import type { IImageProps, IKeyOfIcons } from '@onekeyhq/components';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  ETraitsDisplayType,
  type IAccountNFT,
} from '@onekeyhq/shared/types/nft';

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
    source?: IImageProps['source'];
  }[] = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({ id: ETranslations.nft_collection }),
          value: nft.collectionName,
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_network }),
          value: network?.name ?? '',
          source: {
            uri: network?.logoURI,
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.nft_token_id }),
          value: nft.itemId,
        },
        {
          label: intl.formatMessage({ id: ETranslations.nft_nft_standard }),
          value: nft.collectionType,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.nft_contract_address,
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
      network?.logoURI,
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
        {details.map(({ label, value, onPress, iconAfter, source }) => (
          <DescriptionList.Item key={label}>
            <DescriptionList.Item.Key
              maxWidth="30%"
              size="$bodyMd"
              color="$textSubdued"
            >
              {label}
            </DescriptionList.Item.Key>
            <DescriptionList.Item.Value
              space="$1"
              maxWidth="60%"
              onPress={onPress}
              iconAfter={iconAfter}
              source={source}
              textProps={{
                wordWrap: 'break-word',
                numberOfLines: 1,
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
        <Heading size="$headingSm">
          {intl.formatMessage({ id: ETranslations.nft_attributes })}
        </Heading>
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
                      ? formatDate(new Date(value), {})
                      : value}
                  </SizableText>
                </Stack>
              ),
            )}
          </XStack>
        ) : (
          <SizableText size="$bodyMd" mt="$2" color="$textSubdued">
            {`🤷‍♂️ ${intl.formatMessage({
              id: ETranslations.nft_no_attributes_found,
            })}`}
          </SizableText>
        )}
      </Stack>
    </Stack>
  );
}

export { CommonAssetContent };
