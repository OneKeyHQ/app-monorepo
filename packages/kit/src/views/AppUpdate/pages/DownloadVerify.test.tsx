/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, import/first */

import React from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

import { AppUpdateTestIDs } from '../testIDs';

const mockDownloadPackage = jest.fn();
const mockDownloadASC = jest.fn();
const mockInstallPackage = jest.fn();
const mockShowUpdateInCompleteDialog = jest.fn();
const mockPushModal = jest.fn();
const mockPopStack = jest.fn();
const mockHandleContactSupport = jest.fn();

const mockState: {
  data: IAppUpdateInfo;
  isForceUpdate: boolean;
} = {
  data: {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.ready,
  },
  isForceUpdate: false,
};

jest.mock('@react-navigation/core', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const EStepItemStatus = {
    Pending: 'pending',
    InProgress: 'in-progress',
    Done: 'done',
    Failed: 'failed',
  };

  const Button = ({
    children,
    onPress,
    testID,
    disabled,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );

  const Page = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  Page.Header = ({ title }: { title?: string }) => <div>{title}</div>;
  Page.Body = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  Page.Footer = ({
    onConfirmText,
    onConfirm,
    confirmButtonProps,
    onCancelText,
    onCancel,
    cancelButtonProps,
  }: {
    onConfirmText?: string;
    onConfirm?: () => void;
    confirmButtonProps?: { disabled?: boolean; loading?: boolean };
    onCancelText?: string;
    onCancel?: (close?: () => void) => void;
    cancelButtonProps?: { testID?: string };
  }) => (
    <div>
      {onCancelText ? (
        <button
          type="button"
          data-testid={cancelButtonProps?.testID ?? 'footer-cancel-btn'}
          onClick={() => onCancel?.()}
        >
          {onCancelText}
        </button>
      ) : null}
      <button
        type="button"
        data-testid="footer-confirm-btn"
        disabled={confirmButtonProps?.disabled}
        onClick={() => onConfirm?.()}
      >
        {onConfirmText}
      </button>
    </div>
  );

  const Stepper = ({
    stepIndex,
    hasError,
    children,
  }: {
    stepIndex: number;
    hasError?: boolean;
    children?: ReactNode;
  }) => {
    const items = React.Children.toArray(children);
    return (
      <div>
        {items.map((child, idx) => {
          let itemStatus = EStepItemStatus.Pending;
          if (idx < stepIndex) {
            itemStatus = EStepItemStatus.Done;
          } else if (idx === stepIndex) {
            itemStatus = hasError
              ? EStepItemStatus.Failed
              : EStepItemStatus.InProgress;
          }
          if (React.isValidElement(child)) {
            return React.cloneElement(
              child as React.ReactElement<{ __status?: string }>,
              { __status: itemStatus },
            );
          }
          return child;
        })}
      </div>
    );
  };
  Stepper.Item = ({
    title,
    renderDescription,
    renderAction,
    __status = EStepItemStatus.Pending,
  }: {
    title?: string;
    renderDescription?: (args: { status: string }) => ReactNode;
    renderAction?: (args: { status: string }) => ReactNode;
    __status?: string;
  }) => (
    <div>
      <div>{title}</div>
      {renderDescription?.({ status: __status })}
      {renderAction?.({ status: __status })}
    </div>
  );

  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Button,
    EStepItemStatus,
    Page,
    SizableText: Box,
    Stepper,
    XStack: Box,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getSkipBundleGPGVerification: jest.fn(() => Promise.resolve(false)),
    },
    serviceAppUpdate: {
      onDownloadProgressHeartbeat: jest.fn(() => Promise.resolve()),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: mockPushModal,
    popStack: mockPopStack,
  }),
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  useDownloadProgress: () => 0,
}));

jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  showIntercom: jest.fn(() => Promise.resolve()),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('../../../components/AppUpdate', () => ({
  useAppUpdateInfo: () => ({ data: mockState.data }),
  useDownloadPackage: () => ({
    downloadPackage: mockDownloadPackage,
    downloadASC: mockDownloadASC,
    showUpdateInCompleteDialog: mockShowUpdateInCompleteDialog,
    installPackage: mockInstallPackage,
  }),
}));

jest.mock('../../../components/HyperlinkText', () => ({
  HyperlinkText: ({ translationId }: { translationId: string }) => (
    <span>{translationId}</span>
  ),
}));

jest.mock('../hooks/useForceUpdateContactSupport', () => ({
  useForceUpdateContactSupport: () => ({
    isForceUpdate: mockState.isForceUpdate,
    handleContactSupport: mockHandleContactSupport,
  }),
}));

import DownloadVerify from './DownloadVerify';

describe('DownloadVerify self-healing UI retry flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.isForceUpdate = false;
    mockState.data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.ready,
    };
  });

  function renderPage(isForceUpdate = false) {
    mockState.isForceUpdate = isForceUpdate;
    return render(
      <DownloadVerify
        route={{ params: { isForceUpdate } } as any}
        navigation={{} as any}
      />,
    );
  }

  test.each([
    [EAppUpdateStatus.verifyASCFailed],
    [EAppUpdateStatus.verifyPackageFailed],
  ])(
    '%s renders both inline Retry and Contact Support buttons and enables footer Retry even under force update',
    async (status) => {
      mockState.data = {
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.force,
        status,
        updateError: {
          code: EUpdateErrorCode.integrityFailed,
          step: 'verifyPackage',
        },
      };

      const view = renderPage(true);

      const inlineRetry = view.getByTestId(AppUpdateTestIDs.retryBtn);
      const contactBtn = view.getByTestId(AppUpdateTestIDs.contactUsBtn);
      const footerConfirm = view.getByTestId(
        'footer-confirm-btn',
      ) as HTMLButtonElement;

      expect(inlineRetry).toBeTruthy();
      expect(contactBtn).toBeTruthy();
      expect(footerConfirm.disabled).toBe(false);
      expect(footerConfirm.textContent).toBe(ETranslations.global_retry);

      await act(async () => {
        fireEvent.click(inlineRetry);
      });
      expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });

      mockDownloadPackage.mockClear();
      await act(async () => {
        fireEvent.click(footerConfirm);
      });
      expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });
    },
  );

  test.each([
    [
      EAppUpdateStatus.updateIncomplete,
      undefined,
      ETranslations.update_update_incomplete_package_missing_desc,
    ],
    [
      EAppUpdateStatus.failed,
      { code: EUpdateErrorCode.installLocation, step: 'install' as const },
      ETranslations.app_update_move_to_applications__desc,
    ],
    [
      EAppUpdateStatus.failed,
      { code: EUpdateErrorCode.installFailed, step: 'install' as const },
      ETranslations.global_update_failed,
    ],
  ])(
    '%s renders actionable Retry UI and never leaves footer button disabled',
    async (status, updateError, expectedText) => {
      mockState.data = {
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.force,
        status,
        updateError,
      };

      const view = renderPage(true);

      expect(view.getByText(expectedText)).toBeTruthy();
      const footerConfirm = view.getByTestId(
        'footer-confirm-btn',
      ) as HTMLButtonElement;
      expect(footerConfirm.disabled).toBe(false);
      expect(footerConfirm.textContent).toBe(ETranslations.global_retry);

      await act(async () => {
        fireEvent.click(view.getByTestId(AppUpdateTestIDs.retryBtn));
      });
      expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });
    },
  );

  test('downloadASCFailed footer Retry resumes downloadASC without re-downloading full package', async () => {
    mockState.data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.downloadASCFailed,
    };

    const view = renderPage(false);
    const footerConfirm = view.getByTestId(
      'footer-confirm-btn',
    ) as HTMLButtonElement;

    expect(footerConfirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(footerConfirm);
    });
    expect(mockDownloadASC).toHaveBeenCalledTimes(1);
    expect(mockDownloadPackage).not.toHaveBeenCalled();
  });

  test('manualInstall status enables footer Manual Update button instead of keeping it disabled', async () => {
    mockState.data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.manualInstall,
    };

    const view = renderPage(false);
    const footerConfirm = view.getByTestId(
      'footer-confirm-btn',
    ) as HTMLButtonElement;

    expect(footerConfirm.disabled).toBe(false);
    expect(footerConfirm.textContent).toBe(ETranslations.update_manual_update);

    await act(async () => {
      fireEvent.click(footerConfirm);
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  test('install failure immediately resets installing loading state and invokes incomplete dialog on missing package', async () => {
    mockInstallPackage.mockImplementationOnce(
      async (_onSuccess: () => void, onFail: () => void) => {
        onFail();
      },
    );
    mockState.data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.ready,
    };

    const view = renderPage(false);
    const footerConfirm = view.getByTestId(
      'footer-confirm-btn',
    ) as HTMLButtonElement;

    expect(footerConfirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(footerConfirm);
    });

    expect(mockShowUpdateInCompleteDialog).toHaveBeenCalledTimes(1);
    expect(footerConfirm.disabled).toBe(false);
  });
});
