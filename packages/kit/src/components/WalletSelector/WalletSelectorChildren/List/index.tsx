/* eslint-disable react/no-unused-prop-types */
import React, { useCallback, useMemo, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  SectionList,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount } from '../../../../hooks/redux';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_WALLET } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { useDeviceStatusOfHardwareWallet } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import {
  EWalletDataSectionType,
  IWalletDataSection,
  useWalletSelectorSectionData,
} from '../../hooks/useWalletSelectorSectionData';
import { useWalletSelectorStatus } from '../../hooks/useWalletSelectorStatus';
import { scrollToSectionItem } from '../../scrollToSectionItem';
import { WalletCreateSelectDropdown } from '../WalletCreateSelectDropdown';

import { ListItemBase } from './ListItem';
import { ListItemWithHidden } from './ListItemWithHidden';

export type IWalletDataBase = {
  wallet: IWallet | undefined;
  isSingleton?: boolean;
  isLastItem?: boolean;
  hiddenWallets?: IWallet[];
};

function SectionHeader({
  type,
  isEmptyData,
  section,
}: {
  type: EWalletDataSectionType;
  isEmptyData?: boolean;
  section: IWalletDataSection;
}) {
  const intl = useIntl();
  const label = useMemo(() => {
    if (type === 'hd') return intl.formatMessage({ id: 'wallet__app_wallet' });
    if (type === 'hw')
      return intl.formatMessage({ id: 'wallet__hardware_wallet' });
    return intl.formatMessage({ id: 'content__other' });
  }, [intl, type]);

  const showAddIconButton =
    !isEmptyData &&
    (type === EWalletDataSectionType.hd || type === EWalletDataSectionType.hw);
  // const showAddIconButton = true;

  if (type === EWalletDataSectionType.other) {
    let totalAccountsLength = 0;
    section.data.forEach((item) => {
      totalAccountsLength += item.wallet?.accounts.length || 0;
    });
    if (totalAccountsLength <= 0) {
      return null;
    }
  }

  return (
    <Box
      bgColor="background-default"
      pt={2}
      mt={-2}
      display="flex"
      alignItems="center"
      flexDirection="row"
      px={4}
      mb={1}
    >
      <Typography.Subheading flex={1} color="text-subdued">
        {label}
      </Typography.Subheading>
      <Box>
        {showAddIconButton ? (
          <WalletCreateSelectDropdown
            walletType={type}
            renderTrigger={({ onPress }) => (
              <IconButton
                onPress={onPress}
                type="plain"
                name="PlusSolid"
                circle
                hitSlop={8}
              />
            )}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function Body() {
  const sectionData = useWalletSelectorSectionData();
  const { deviceStatus } = useDeviceStatusOfHardwareWallet();
  const sectionListRef = useRef<any>(null);
  const { walletId } = useActiveWalletAccount();
  const { visible } = useWalletSelectorStatus();
  const insets = useSafeAreaInsets();
  const intl = useIntl();

  const isScrolledRef = useRef(false);
  const scrollToItem = useCallback(() => {
    if (
      isScrolledRef.current ||
      !visible ||
      !walletId ||
      !sectionData ||
      !sectionData.length
    ) {
      return;
    }
    scrollToSectionItem({
      delay: 0,
      sectionListRef,
      sectionData,
      skipScrollIndex: 7,
      isScrollToItem(item) {
        return (
          item?.wallet?.id === walletId ||
          Boolean(item?.hiddenWallets?.find((w) => w.id === walletId))
        );
      },
      onScrolled() {
        isScrolledRef.current = true;
      },
    });
  }, [sectionData, visible, walletId]);
  const scrollToItemDebounced = useMemo(
    () =>
      debounce(scrollToItem, ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_WALLET, {
        leading: false,
        trailing: true,
      }),
    [scrollToItem],
  );
  return (
    <>
      <SectionList
        ref={sectionListRef}
        sections={sectionData}
        keyExtractor={(item: IWalletDataBase, index) =>
          `${item?.wallet?.id || ''}${index}`
        }
        renderSectionHeader={({ section }: { section: IWalletDataSection }) => {
          const isEmptyData = !section?.data?.length;

          return (
            <>
              <SectionHeader
                section={section}
                type={section.type}
                isEmptyData={isEmptyData}
              />
            </>
          );
        }}
        renderItem={({
          item,
          section,
        }: {
          item: IWalletDataBase;
          section: IWalletDataSection;
        }) => {
          console.log(item);
          return (
            <ListItemWithHidden
              item={item}
              section={section}
              deviceStatus={deviceStatus}
              onLastItemRender={scrollToItemDebounced}
            />
          );
        }}
        ItemSeparatorComponent={() => <Box h={1} />} // The spacing between items within a section
        renderSectionFooter={({ section }: { section: IWalletDataSection }) => {
          console.log({ section });
          const isEmptyData = !section?.data?.length;
          if (isEmptyData) {
            const createNewButton = null;
            const iconFontSizeMap: { [size: string]: number } = {
              'xs': 24,
              'sm': 32,
              'lg': 48,
              'xl': 56,
            };
            const iconSizeName = platformEnv.isNative ? 'lg' : 'sm';
            const iconSize = iconFontSizeMap[iconSizeName];
            let leftView: JSX.Element | null = null;
            let text = '';
            if (section.type === EWalletDataSectionType.hd) {
              text = intl.formatMessage({ id: 'action__add_app_wallet' });
              leftView = <Icon size={iconSize} name="PlusSolid" />;
            }
            if (section.type === EWalletDataSectionType.hw) {
              text = intl.formatMessage({
                id: 'action__connect_hardware_wallet' as any,
              });
              leftView = <Icon size={iconSize} name="ConnectOutline" />;
            }
            return (
              <>
                <WalletCreateSelectDropdown
                  walletType={section.type}
                  renderTrigger={({ onPress }) => (
                    <ListItemBase
                      onPress={onPress}
                      leftView={leftView}
                      text={text}
                    />
                  )}
                />
                <Box h={6} />
              </>
            );
          }

          return section.data?.length ? <Box h={6} /> : null;
        }}
        // The spacing between sections
        py={2}
        style={
          {
            // ERROR on iOS: JSON value '8px' of type NSString cannot be converted to YGVaule
            // padding: '8px',
          }
        }
        ListFooterComponent={<Box h={insets.bottom} />}
      />
    </>
  );
}

export default Body;
