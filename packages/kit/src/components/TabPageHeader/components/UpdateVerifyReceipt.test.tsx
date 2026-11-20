/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

import { UpdateVerifyReceipt } from './UpdateVerifyReceipt';

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Divider: () => null,
    Icon: () => null,
    Spinner: () => null,
    SizableText: ({
      children,
      color,
    }: {
      children?: ReactNode;
      color?: string;
    }) => <span data-color={color}>{children}</span>,
    XStack: Container,
    YStack: Container,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat('en-US', options).format(value),
  }),
}));

test.each([undefined, 200 * 1024 * 1024])(
  'uses Node byte counts when API fileSize is %s',
  (fileSize) => {
    const view = render(
      <UpdateVerifyReceipt
        data={{
          status: EAppUpdateStatus.downloadPackage,
          updateStrategy: EUpdateStrategy.manual,
          updateAt: 0,
          fileSize,
        }}
        progress={{
          percent: 25,
          total: 80 * 1024 * 1024,
          transferred: 20 * 1024 * 1024,
        }}
        reducedMotion={false}
      />,
    );
    expect(view.getByText('20/80 MB')).toBeTruthy();
  },
);

test('shows percentage while the Node total is unknown', () => {
  const view = render(
    <UpdateVerifyReceipt
      data={{
        status: EAppUpdateStatus.downloadPackage,
        updateStrategy: EUpdateStrategy.manual,
        updateAt: 0,
        fileSize: 200 * 1024 * 1024,
      }}
      progress={{ percent: 25, total: 0, transferred: 0 }}
      reducedMotion={false}
    />,
  );
  expect(view.getByText('25%')).toBeTruthy();
});

test.each([EAppUpdateStatus.downloadASC, EAppUpdateStatus.ready])(
  'retains the completed size without progress events at %s',
  (status) => {
    const view = render(
      <UpdateVerifyReceipt
        data={{
          status,
          updateStrategy: EUpdateStrategy.manual,
          updateAt: 0,
          fileSize: 80 * 1024 * 1024,
        }}
        progress={{ percent: 0, total: 0, transferred: 0 }}
        reducedMotion={false}
      />,
    );
    expect(view.getByText('80 MB')).toBeTruthy();
  },
);

test('prefers Node size to API fileSize after download completes', () => {
  const view = render(
    <UpdateVerifyReceipt
      data={{
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.manual,
        updateAt: 0,
        fileSize: 200 * 1024 * 1024,
      }}
      progress={{
        percent: 100,
        total: 80 * 1024 * 1024,
        transferred: 80 * 1024 * 1024,
      }}
      reducedMotion={false}
    />,
  );
  expect(view.getByText('80 MB')).toBeTruthy();
  expect(view.queryByText('200 MB')).toBeNull();
});

test('marks failed verification results with the critical text color', () => {
  const view = render(
    <UpdateVerifyReceipt
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        status: EAppUpdateStatus.verifyASCFailed,
        updateStrategy: EUpdateStrategy.manual,
        updateError: {
          code: EUpdateErrorCode.integrityFailed,
          step: 'verifyASC',
        },
      }}
      progress={{
        percent: 100,
        total: 80 * 1024 * 1024,
        transferred: 80 * 1024 * 1024,
      }}
      reducedMotion={false}
    />,
  );
  expect(
    view.getByText(ETranslations.global_unknown).getAttribute('data-color'),
  ).toBe('$textCritical');
});
