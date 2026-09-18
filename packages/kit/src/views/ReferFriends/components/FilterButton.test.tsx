/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../testIDs';

type IActionListItem = {
  label: string;
  description?: string;
};

type IActionListShowParams = {
  title?: string;
  sections?: Array<{
    title?: string;
    items: IActionListItem[];
  }>;
  sheetProps?: {
    snapPointsMode?: string;
    snapPoints?: number[];
  };
};

type IDesktopActionListProps = {
  title?: string;
  sections?: IActionListShowParams['sections'];
  renderTrigger?: ReactNode;
  floatingPanelProps?: {
    width?: string;
    maxHeight?: string;
  };
};

const mockActionListShow = jest.fn();
const mockUseMedia = jest.fn(() => ({ gtMd: false }));
const mockDesktopActionList = jest.fn(
  (props: IDesktopActionListProps) => props,
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function ActionList(props: IDesktopActionListProps) {
    mockDesktopActionList(props);
    return React.createElement(
      'div',
      { 'data-testid': 'desktop-action-list' },
      props.renderTrigger,
    );
  }
  ActionList.show = (params: IActionListShowParams) => {
    mockActionListShow(params);
  };

  return {
    ActionList,
    Button: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      React.createElement(
        'button',
        { 'data-testid': testID, type: 'button' },
        children,
      ),
    Icon: () => null,
    IconButton: ({
      onPress,
      testID,
    }: {
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement('button', {
        'data-testid': testID,
        onClick: onPress,
        type: 'button',
      }),
    useMedia: () => mockUseMedia(),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection/hooks/useInviteCodeList',
  () => ({
    useInviteCodeList: () => ({
      codeListData: {
        items: [
          { code: 'Swappp', note: '  swappp99 note  ' },
          { code: 'Perperp', note: 'perps' },
        ],
      },
    }),
  }),
);

import { FilterButton } from './FilterButton';

const defaultFilterState = {
  timeRange: EExportTimeRange.All,
};

describe('FilterButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMedia.mockReturnValue({ gtMd: false });
  });

  it('opens a fit-height invite-code sheet on mobile', () => {
    render(
      <FilterButton
        filterState={defaultFilterState}
        onFilterChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.filterBtn));

    expect(mockActionListShow).toHaveBeenCalledTimes(1);
    const showParams = mockActionListShow.mock
      .calls[0][0] as IActionListShowParams;
    expect(showParams.sheetProps).toEqual({
      snapPointsMode: 'fit',
    });
    expect(showParams.sheetProps?.snapPoints).toBeUndefined();
    expect(showParams.title).toBe(ETranslations.referral_filter);

    const section = showParams.sections?.[0];
    expect(section?.title).toBe(ETranslations.referral_code_list);
    expect(section?.items.map((item) => item.label)).toEqual([
      ETranslations.referral_filter_code_all,
      'Swappp',
      'Perperp',
    ]);
    expect(section?.items.map((item) => item.description)).toEqual([
      undefined,
      'swappp99 note',
      'perps',
    ]);
  });

  it('renders a desktop ActionList instead of calling show', () => {
    mockUseMedia.mockReturnValue({ gtMd: true });

    render(
      <FilterButton
        filterState={defaultFilterState}
        onFilterChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('desktop-action-list')).toBeTruthy();
    expect(screen.getByTestId(ReferFriendsTestIDs.filterBtn)).toBeTruthy();
    expect(mockActionListShow).not.toHaveBeenCalled();
    expect(mockDesktopActionList).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ETranslations.referral_filter,
        floatingPanelProps: {
          width: '$56',
          maxHeight: '$96',
        },
      }),
    );
  });
});
