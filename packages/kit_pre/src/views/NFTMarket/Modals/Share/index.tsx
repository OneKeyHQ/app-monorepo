import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Platform, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

import {
  Box,
  Modal,
  QRCode,
  SegmentedControl,
  Text,
  useTheme,
} from '@onekeyhq/components';
import LogoBlack from '@onekeyhq/components/src/Icon/react/illus/LogoBlack';
import LogoWhite from '@onekeyhq/components/src/Icon/react/illus/LogoWhite';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useFormatDate from '../../../../hooks/useFormatDate';
import { PriceString } from '../../PriceText';

import { PNLCardGroup } from './PNLCard';

import type { NFTMarketRoutes, NFTMarketRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  NFTMarketRoutesParams,
  NFTMarketRoutes.ShareNFTPNLModal
>;

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

const logo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAACcCAMAAAC9ZjJ/AAAAllBMVEUAAAAAuBIAtxAAuBMAtxIAuRIAtxMAuRIAtxIAtxIAuBIAuBMAuBEAsxAAtxIAtxIAuBIAuRIAuBIAuBL///8AtRIAtxIAsxKA2ojf9uG/7cRg0WsgvzCg5Kbv+/BAyk2v6LUQvSFw13pAxk0wxT/P8dMQuiEQtyHv+vBw1HpQzFyQ3Zcwwj6Q4JiQ35fP8tOQ35iP35ce/Hr/AAAAE3RSTlMA3yC/QO9gsJCAz1AwENCgn39wIDfjZgAABGxJREFUeNrtnNlS4zAQReV4zcYALcmWF7ITwjDb///c2BCQwImdcTt2ZyqH5SGVh1NXaklxSs3qmE68wB9ZLrSJZfvBvcNwOHe2C+fDHjrNzVw4O9btoImaDR1he+zf8CzoEMsjmdqH3pidxtSHHjht7o0RZXDusQ2gN+5YNYMb6JHRoNLNgl6xKuwmCLdz2w1c6B13QnNM37Oj63bE7gaIMGIl7oAMQWmnB0KMaU64N9wpM/kGpPCZwRiI4TANqUEtsIlWwxse3eAALMLB6VlnA0Hs/RoHJHEornHvDKmWQ4HLchwgSjGuQyDKkGqtvtcrUMWd0p1yABN2D2TxWABkCZgPOBQvE0Er+NhinfFDcgLaYITdH7LDchJawGKAQ51RzkXKzfgZ5QApl1GWU4flQgpyM044uYyynOJ0h3Uda+glJ4UQYYEIySX3aielKKCXnEYSTE5DOTm4JncyV7mmXOWacrFy16WkimtyTbnKNeVi5xxpOdLDepX7BxKDF2pyIEUocsL8P9atfTmQbwDkf+1A92uIduUW61nyPFsvAEnrcovlXPE9v+ZJCghalpvF/AvZDHDg5bRamTiVgAQvl8b8CH8WOD283OyBH0WlgAAvt+RVPD0jskPLRbyGBGGHlFvyWl4Qdii5Na/nKRXQALRcqvgJxIhTAEIu4594yHbP6ctqN8d/KYGXSz+r7bZhKF5JI/VpYB97kIu5wfdtYSYl5D+53hwRHVKuXA1Rnpo+xUkpok/RCWgARi776gYGUvxGRIeXM7atLCwfzEWMKFis3MzcQvPcKoe9wVqHkvthDqqQ1eOeNIgOIxcbuYSyJtusYzk95WId3LG3bMJu5YwlLhRwEL3YqVDAyeDlUmNCHYvlJ/+gRzk4TERBTki6cjsh61abp27lwNwfZN1qszEKuh68nKotxYX2jztOzjgUrQQcIjFWm47llrX7uuIfPHe8Q6y5ZiWrg+PbjuXMYNSBg3hqHKnmYddyEddsHmXVJ7Mk7PjIBIsH0y6VJTfEzoqWkxE3UIk09JamOE+6ltPRab3F/vWl4iYq7EGu/KQknmdZpvgX0rDbj4Z6Ia4nauSGl1soXkt8wqBi5DCPctQW4YaSq7dTiAmHlpPVdvEW4YaWA/n4s6oWcG7AXEAhRaKOxLbCugH6Spo8rKeSXE0ACouNAI0QSfzlIeeqUJOAw8Zdc9HpPa6i+UblbLLdavuamgQkfjsXhGSuJ0S4Z/+QE03APMCi4yvQYmju2QTaQxa/7eGwKYE+IEegfhGS9BVSsjchHZZDdNJZjNEd11tG+FL1gH6TAZrReZfQ2IJiZ4siOKqtLV6DozrrxszAB1LcMgNiZ5Oi4xbZ/kIeoXaC5eNIiREQ4ebSWrwRsTPdTCYEStYdUG0WCWBNLrOVZW7Xa83eVLj1fWgPqLUS1rhjdgKDb9AD/pSdxrjz8Gzn/2gTXeDZgACdWv3c6yA+F9E6fXjO/Fw7N8Ph3Ae+bbVrZY38wJvU1udfiwGx6zsgLxcAAAAASUVORK5CYII=';

const Share = () => {
  const ref = useRef<ViewShot | null>(null);
  const route = useRoute<RouteProps>();
  const { data, network, nameOrAddress } = route.params;
  const { content, win, lose, totalProfit, totalWinProfit, totalLoseProfit } =
    data;

  const endTime = content[0].exit.timestamp;
  const startTime = content[content.length - 1].exit.timestamp;
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const onCapture = useCallback(async () => {
    const uri = await ref.current?.capture?.();
    if (uri) {
      const share = await getShareModule();
      const options = Platform.select({
        ios: {
          activityItemSources: [
            {
              placeholderItem: { type: 'url' as const, content: logo },
              item: {
                default: { type: 'url' as const, content: `file://${uri}` },
              },
              linkMetadata: {
                title: 'Share',
              },
            },
          ],
          failOnCancel: true,
        },
        default: {
          url: `file://${uri}`,
          title: 'Share',
          filename: 'onekey_share.png',
          failOnCancel: true,
        },
      });
      if (!share) return;
      await share.open(options).catch(() => {
        console.log('something wrong');
      });
      // navigation.goBack();
    }
  }, []);

  const [selectRange, setSelectedRange] = useState(0);

  const { format } = useFormatDate();
  const date = `${format(new Date(startTime), 'yyyy/MM/dd')} - ${format(
    new Date(endTime),
    'yyyy/MM/dd',
  )}`;

  const profit = useMemo(() => {
    if (selectRange === 0) {
      return totalProfit;
    }
    if (selectRange === 1) {
      return totalWinProfit;
    }
    if (selectRange === 2) {
      return totalLoseProfit;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectRange]);

  const totalValue = useMemo(() => {
    let value = '0';
    if (profit) {
      value = new BigNumber(profit).decimalPlaces(3).toString();
      value = `${profit.toNumber() >= 0 ? '+' : ''}${value}`;
    }
    value = PriceString({ price: value, networkId: network.id });
    return value;
  }, [network.id, profit]);

  const cards = useMemo(() => {
    if (selectRange === 0) {
      return content.slice(0, 3);
    }
    if (selectRange === 1) {
      return content.filter((item) => item.profit > 0).slice(0, 3);
    }
    if (selectRange === 2) {
      return content.filter((item) => item.profit < 0).slice(0, 3);
    }
    return [];
  }, [content, selectRange]);
  const shareAction = useCallback(() => {
    setTimeout(onCapture, 100);
  }, [onCapture]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__share' })}
      hidePrimaryAction={platformEnv.isWeb}
      primaryActionTranslationId="action__share"
      hideSecondaryAction
      onPrimaryActionPress={shareAction}
    >
      <Box w="full" h="full" position="relative">
        {win === 0 || lose === 0 ? null : (
          <Box mb="24px">
            <SegmentedControl
              selectedIndex={selectRange}
              onChange={setSelectedRange}
              values={[
                'All',
                intl.formatMessage({ id: 'content__winning_flips' }),
                intl.formatMessage({ id: 'content__losing_flips' }),
              ]}
            />
          </Box>
        )}
        <Box alignItems="center" shadow="depth.5">
          <ViewShot
            ref={ref}
            style={{
              width: '100%',
              maxWidth: 400,
            }}
          >
            <Box
              borderWidth={StyleSheet.hairlineWidth}
              borderRadius="24px"
              borderColor="border-default"
              bg="background-default"
              shadow="depth.5"
              overflow="hidden"
            >
              <Box
                p={6}
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderColor="border-default"
              >
                <Box
                  flexDirection="row"
                  justifyContent="space-between"
                  mb="36px"
                >
                  <Text typography="CaptionStrong" color="text-subdued">
                    {nameOrAddress}
                  </Text>
                  <Text typography="Caption" color="text-subdued">
                    {date}
                  </Text>
                </Box>
                <PNLCardGroup
                  key={selectRange}
                  datas={cards}
                  width="full"
                  height="102px"
                />
                <Text mt="40px" typography="Body1" color="text-subdued">
                  {intl.formatMessage({ id: 'content__profit' })}
                </Text>
                {profit && (
                  <Text
                    typography="Display2XLarge"
                    color={
                      profit.toNumber() > 0 ? 'text-success' : 'text-critical'
                    }
                    numberOfLines={1}
                  >
                    {totalValue}
                  </Text>
                )}

                <Box flexDirection="row" mt="8px">
                  {selectRange !== 2 ? (
                    <Box flexDirection="row" mr="24px" alignItems="center">
                      <Text
                        mr="6px"
                        typography="Body1Strong"
                        color="text-success"
                      >
                        {win}
                      </Text>
                      <Text typography="Body1" color="text-subdued">
                        {intl.formatMessage({ id: 'content__winning_flips' })}
                      </Text>
                    </Box>
                  ) : null}

                  {selectRange !== 1 ? (
                    <Box flexDirection="row" alignItems="center">
                      <Text
                        mr="6px"
                        typography="Body1Strong"
                        color="text-critical"
                      >
                        {lose}
                      </Text>
                      <Text typography="Body1" color="text-subdued">
                        {intl.formatMessage({ id: 'content__losing_flips' })}
                      </Text>
                    </Box>
                  ) : null}
                </Box>
              </Box>

              <Box
                px={6}
                py={5}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                bgColor="surface-subdued"
              >
                <Box>
                  {themeVariant === 'light' ? (
                    <LogoBlack width={82} height={25} />
                  ) : (
                    <LogoWhite width={82} height={25} />
                  )}
                  <Text typography="Body2" mt="2" color="text-subdued">
                    {intl.formatMessage({
                      id: 'content__all_in_one_crypto_wallet',
                    })}
                  </Text>
                </Box>
                <Box
                  bg="white"
                  p={1}
                  borderRadius="6px"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="border-default"
                  shadow="depth.1"
                >
                  <QRCode
                    value="https://onekey.so/download"
                    size={48}
                    logoSize={0}
                    logoMargin={0}
                    logoBackgroundColor="white"
                  />
                </Box>
              </Box>
            </Box>
          </ViewShot>
          <Box position="absolute" top="0" left="0" w="full" h="full" />
        </Box>
      </Box>
    </Modal>
  );
};

export default Share;
