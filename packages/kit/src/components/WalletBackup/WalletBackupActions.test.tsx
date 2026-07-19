import type { ComponentProps, ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import type { ActionList } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { WalletBackupTestIDs } from './testIDs';
import { WalletBackupActions } from './WalletBackupActions';

const mockActionListProps: ComponentProps<typeof ActionList>[] = [];
const mockHandleBackUpByPhrase = jest.fn();
const mockHandleBackUpByLiteCard = jest.fn();
const mockHandleBackUpByKeyTag = jest.fn();
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ActionList: (props: ComponentProps<typeof ActionList>) => {
      mockActionListProps.push(props);
      return React.createElement('View', null, props.renderTrigger);
    },
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isHdWallet: () => true },
}));

jest.mock('../../hooks/useBackUpWallet', () => ({
  useBackUpWallet: () => ({
    handleBackUpByPhrase: mockHandleBackUpByPhrase,
    handleBackUpByLiteCard: mockHandleBackUpByLiteCard,
    handleBackUpByKeyTag: mockHandleBackUpByKeyTag,
    handleBackUpByCloud: jest.fn(),
    supportCloudBackup: false,
    cloudBackupFeatureInfo: undefined,
  }),
}));

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('WalletBackupActions', () => {
  beforeEach(() => {
    mockActionListProps.length = 0;
    jest.clearAllMocks();
  });

  it('exposes unique backup option IDs and preserves the manual handler', () => {
    const onSelected = jest.fn();
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <WalletBackupActions
          wallet={{ id: 'hd-1' } as IDBWallet}
          onSelected={onSelected}
        >
          {'trigger' as ReactNode}
        </WalletBackupActions>,
      );
    });

    expect(view).toBeTruthy();
    const items = mockActionListProps.at(-1)?.items ?? [];
    const testIDs = items.map((item) => item.testID);
    expect(testIDs).toEqual([
      WalletBackupTestIDs.manual,
      WalletBackupTestIDs.oneKeyLite,
      WalletBackupTestIDs.oneKeyKeyTag,
    ]);
    expect(new Set(testIDs).size).toBe(testIDs.length);

    const manualItem = items.find(
      (item) => item.testID === WalletBackupTestIDs.manual,
    );
    act(() => {
      void manualItem?.onPress?.(jest.fn());
    });
    expect(mockHandleBackUpByPhrase).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(mockHandleBackUpByLiteCard).not.toHaveBeenCalled();
    expect(mockHandleBackUpByKeyTag).not.toHaveBeenCalled();
  });
});
