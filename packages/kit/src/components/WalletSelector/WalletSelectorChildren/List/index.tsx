/* eslint-disable react/no-unused-prop-types */
import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { orderBy } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, SectionList, Text } from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useActiveWalletAccount, useRuntime } from '../../../../hooks/redux';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_WALLET } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { useDeviceStatusOfHardwareWallet } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import { useWalletSelectorStatus } from '../../useWalletSelectorStatus';

import { ListItemWithHidden } from './ListItemWithHidden';

enum EWalletDataSectionType {
  hd = 'hd',
  hw = 'hw',
  other = 'other',
}
export type IWalletDataBase = {
  wallet: IWallet | undefined;
  isSingleton?: boolean;
  hiddenWallets?: IWallet[];
};
type IWalletDataSection = {
  type: EWalletDataSectionType;
  data: IWalletDataBase[];
};

function useWalletSelectorSectionData(): IWalletDataSection[] {
  // TODO rename \ remove \ change avatar \ deviceStatus
  const { wallets } = useRuntime();

  const data = useMemo(() => {
    const hdData: IWalletDataBase[] = [];
    const hwData: IWalletDataBase[] = [];
    const otherData: IWalletDataBase[] = []; // TODO sort by type
    const hwWalletsMap: Partial<{ [deviceId: string]: IWallet[] }> = {};

    wallets.forEach((wallet) => {
      // hd wallet
      if (wallet.type === WALLET_TYPE_HD) {
        hdData.push({
          wallet,
        });
      }
      // imported\watching\external wallet
      if (
        [
          WALLET_TYPE_IMPORTED,
          WALLET_TYPE_WATCHING,
          WALLET_TYPE_EXTERNAL,
        ].includes(wallet.type)
      ) {
        otherData.push({
          wallet,
          isSingleton: true,
        });
      }
      // hw wallet
      if (wallet.type === WALLET_TYPE_HW && wallet.associatedDevice) {
        const deviceId = wallet.associatedDevice || '';
        if (!hwWalletsMap[deviceId]) {
          hwWalletsMap[deviceId] = [];
        }
        hwWalletsMap[deviceId]?.push(wallet);
      }
    });

    // rebuild hw wallet with hidden grouped
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(hwWalletsMap).forEach(([deviceId, hwWallets]) => {
      // eslint-disable-next-line no-param-reassign
      hwWallets = hwWallets || [];
      const normalWallet = hwWallets.find((w) => !w.passphraseState);
      // TODO sort by
      const hiddenWallets = orderBy(
        hwWallets.filter((w) => w.passphraseState),
        ['name'],
        ['asc'],
      );
      if (normalWallet || hiddenWallets.length) {
        hwData.push({
          wallet: normalWallet,
          hiddenWallets,
        });
      }
    });

    return [
      {
        type: EWalletDataSectionType.hd,
        data: hdData,
        // data: [],
      },
      {
        type: EWalletDataSectionType.hw,
        data: hwData,
        // data: [],
      },
      { type: EWalletDataSectionType.other, data: otherData },
    ];
  }, [wallets]);
  return data;
}

function SectionHeader({ type }: { type: EWalletDataSectionType }) {
  const intl = useIntl();
  const label = useMemo(() => {
    if (type === 'hd') return intl.formatMessage({ id: 'wallet__app_wallet' });
    if (type === 'hw')
      return intl.formatMessage({ id: 'wallet__hardware_wallet' });
    return intl.formatMessage({ id: 'content__other' });
  }, [intl, type]);
  return (
    <Text typography="Subheading" color="text-subdued" px={2} mb={1}>
      {label}
    </Text>
  );
}

function Body() {
  const sectionData = useWalletSelectorSectionData();
  const { deviceStatus } = useDeviceStatusOfHardwareWallet();
  const sectionListRef = useRef<any>(null);
  const { walletId } = useActiveWalletAccount();
  const { visible } = useWalletSelectorStatus();

  const isScrolledRef = useRef(false);
  useLayoutEffect(() => {
    if (
      isScrolledRef.current ||
      !visible ||
      !walletId ||
      !sectionData ||
      !sectionData.length
    ) {
      return;
    }
    setTimeout(() => {
      try {
        let sectionIndex = 0;
        let itemIndex = 1;
        // TODO use for in, break;
        const index = sectionData.findIndex((section) => {
          const i = section.data.findIndex(
            (wallet) =>
              wallet.wallet?.id === walletId ||
              Boolean(wallet.hiddenWallets?.find((w) => w.id === walletId)),
          );
          if (i >= 0) {
            itemIndex = i + 1;
            return true;
          }
          return false;
        });
        if (index >= 0) {
          sectionIndex = index;
        }
        if (sectionIndex === 0 && itemIndex < 5) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        sectionListRef?.current?.scrollToLocation?.({
          animated: true,
          sectionIndex, // starts from 0
          itemIndex, // starts from 1
        });
        isScrolledRef.current = true;
      } catch (error) {
        debugLogger.common.error(error);
      }
    }, ACCOUNT_SELECTOR_AUTO_SCROLL_WALLET);
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
          <ListItemWithHidden item={item} deviceStatus={deviceStatus} />
        )}
        ItemSeparatorComponent={() => <Box h={1} />} // The spacing between items within a section
        renderSectionFooter={({ section }: { section: IWalletDataSection }) =>
          section.data?.length ? <Box h={6} /> : null
        }
        // The spacing between sections
        p={2}
        style={
          {
            // ERROR on iOS: JSON value '8px' of type NSString cannot be converted to YGVaule
            // padding: '8px',
          }
        }
      />
    </>
  );
}

export default Body;
