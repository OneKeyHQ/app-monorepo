/* eslint-disable react/no-unused-prop-types */
import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  SectionList,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';

import { useActiveWalletAccount } from '../../../../hooks/redux';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_WALLET } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { useDeviceStatusOfHardwareWallet } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import {
  EWalletDataSectionType,
  IWalletDataSection,
  useWalletSelectorSectionData,
} from '../../hooks/useWalletSelectorSectionData';
import { useWalletSelectorStatus } from '../../hooks/useWalletSelectorStatus';
import { scrollToSectionItem } from '../../scrollToSectionItem';

import { ListItemWithHidden } from './ListItemWithHidden';

export type IWalletDataBase = {
  wallet: IWallet | undefined;
  isSingleton?: boolean;
  isLastItem?: boolean;
  hiddenWallets?: IWallet[];
};

function SectionHeader({ type }: { type: EWalletDataSectionType }) {
  const intl = useIntl();
  const label = useMemo(() => {
    if (type === 'hd') return intl.formatMessage({ id: 'wallet__app_wallet' });
    if (type === 'hw')
      return intl.formatMessage({ id: 'wallet__hardware_wallet' });
    return intl.formatMessage({ id: 'content__other' });
  }, [intl, type]);
  return (
    <Box bgColor="background-default" pt={2} mt={-2}>
      <Typography.Subheading color="text-subdued" px={4} mb={1}>
        {label}
      </Typography.Subheading>
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
      delay: ACCOUNT_SELECTOR_AUTO_SCROLL_WALLET,
      // delay: 0,
      sectionListRef,
      sectionData,
      skipScrollIndex: 5,
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

  return (
    <>
      <SectionList
        ref={sectionListRef}
        sections={sectionData}
        keyExtractor={(item: IWalletDataBase, index) =>
          `${item?.wallet?.id || ''}${index}`
        }
        renderSectionHeader={({ section }: { section: IWalletDataSection }) => (
          <>
            {/* Hidden section header if there is no wallet item in the current category */}
            {section.data?.length ? (
              <SectionHeader type={section.type} />
            ) : null}
          </>
        )}
        renderItem={({ item }: { item: IWalletDataBase }) => (
          <ListItemWithHidden
            item={item}
            deviceStatus={deviceStatus}
            onLastItemRender={scrollToItem}
          />
        )}
        ItemSeparatorComponent={() => <Box h={1} />} // The spacing between items within a section
        renderSectionFooter={({ section }: { section: IWalletDataSection }) =>
          section.data?.length ? <Box h={6} /> : null
        }
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
