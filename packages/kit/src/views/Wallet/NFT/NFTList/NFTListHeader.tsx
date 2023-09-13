import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { showHomeNFTSettings } from '../../../Overlay/HomeNFTSettings';
// import { showSelectNFTPriceType } from '../../../Overlay/SelectNFTPriceType';

const NFTListHeader = () => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const { networkId, accountId } = useActiveWalletAccount();
  const isNFTSupport = isCollectibleSupportedChainId(networkId ?? '');

  const totalPrice = useAppSelector(
    (s) =>
      s.overview.overviewStats?.[networkId]?.[accountId]?.nfts?.totalValue ?? 0,
  );
  const disPlayPriceType = useAppSelector((s) => s.nft.disPlayPriceType);
  const subDesc =
    disPlayPriceType === 'lastSalePrice'
      ? intl.formatMessage({ id: 'form__last_price' })
      : intl.formatMessage({ id: 'form__floor_price' });

  const isBtcNetwork = useMemo(
    () => networkId === OnekeyNetwork.btc || networkId === OnekeyNetwork.tbtc,
    [networkId],
  );

  return (
    <Box flexDirection="column" paddingRight="16px">
      {isNFTSupport && (
        <Box
          flexDirection="row"
          height="84px"
          mb="24px"
          bgColor="surface-default"
          borderRadius="12px"
          borderColor="border-subdued"
          borderWidth={themeVariant === 'light' ? 1 : undefined}
          padding="16px"
          justifyContent="space-between"
        >
          <Box flexDirection="column">
            <Typography.DisplayLarge>
              <FormatCurrencyNumber
                value={0}
                decimals={2}
                convertValue={Number(totalPrice) > 0 ? totalPrice : ''}
              />
            </Typography.DisplayLarge>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage(
                {
                  id: 'content__total_value_by_str',
                },
                { 0: subDesc },
              )}
            </Typography.Body2>
          </Box>
          {/* <IconButton
            disabled
            onPress={showSelectNFTPriceType}
            size="sm"
            name="CogMini"
            type="plain"
            mr={-2}
          /> */}
        </Box>
      )}
      <HStack
        space={4}
        alignItems="center"
        justifyContent="space-between"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__assets' })}
        </Typography.Heading>
        {isBtcNetwork ? (
          <IconButton
            name="Cog8ToothMini"
            size="sm"
            type="plain"
            onPress={() => showHomeNFTSettings({ accountId, networkId })}
          />
        ) : null}
        {/* {expandEnable ? ( */}
        {/*   <IconButton */}
        {/*     name={expand ? 'ArrowsPointingInMini' : 'ArrowsPointingOutMini'} */}
        {/*     size="sm" */}
        {/*     circle */}
        {/*     type="plain" */}
        {/*     onPress={onPress} */}
        {/*   /> */}
        {/* ) : null} */}
      </HStack>
    </Box>
  );
};

export default memo(NFTListHeader);
