/** @jest-environment jsdom */

import CustomInjectedE2EWorkflowModal from '.';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockPop = jest.fn();
const mockPush = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockStopE2E = jest.fn();
const mockStopE2EGeneration = jest.fn();
const mockValidateE2E = jest.fn().mockResolvedValue(undefined);
const mockOpenDappDirectory = jest.fn().mockResolvedValue(undefined);
const mockToastError = jest.fn();
let mockE2ERunning = false;
let mockE2EGenerating = false;
let mockWorkflowActionsListener: (() => void) | undefined;
const mockRouteParams: {
  e2eOutcome?: {
    passed: boolean;
    text: string;
    errorLog?: string;
  };
  protocolId: string;
  protocolName: string;
  recordingPhase?: 'preparing' | 'recording' | 'stopping' | 'saving';
  sessionId: string;
} = {
  protocolId: 'defillama:ssv-network',
  protocolName: 'SSV Network',
  sessionId: 'session-1',
};

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop, push: mockPush }),
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedE2EWorkflowRuntime', () => ({
  getCustomInjectedE2EWorkflowActions: () => ({
    e2eGenerating: mockE2EGenerating,
    e2eRunning: mockE2ERunning,
    protocolId: 'defillama:ssv-network',
    sessionId: 'session-1',
    startRecording: mockStartRecording,
    stopE2E: mockStopE2E,
    stopE2EGeneration: mockStopE2EGeneration,
    stopRecording: mockStopRecording,
    validateE2E: mockValidateE2E,
  }),
  subscribeCustomInjectedE2EWorkflowActions: (listener: () => void) => {
    mockWorkflowActionsListener = listener;
    return () => {
      if (mockWorkflowActionsListener === listener) {
        mockWorkflowActionsListener = undefined;
      }
    };
  },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    backgroundColor,
    children,
    color,
    headerRight,
    opacity,
    testID,
    title,
  }: {
    backgroundColor?: string;
    children?: React.ReactNode;
    color?: string;
    headerRight?: () => React.ReactNode;
    opacity?: number;
    testID?: string;
    title?: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      {
        'data-background-color': backgroundColor,
        'data-color': color,
        'data-opacity': opacity,
        'data-testid': testID,
      },
      title,
      headerRight?.(),
      children,
    );
  const Page = Object.assign(Container, {
    Body: Container,
    Footer: Container,
    Header: Container,
  });

  return {
    Button: ({
      children,
      color,
      disabled,
      iconColor,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      color?: string;
      disabled?: boolean;
      iconColor?: string;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-color': color,
          'data-icon-color': iconColor,
          'data-testid': testID,
          disabled,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
    Icon: ({ color, name }: { color?: string; name: string }) =>
      React.createElement('span', {
        'data-icon-color': color,
        'data-icon-name': name,
      }),
    Page,
    Progress: ({ testID, value }: { testID?: string; value: number }) =>
      React.createElement('div', {
        'data-testid': testID,
        'data-value': value,
      }),
    SizableText: Container,
    Spinner: ({ testID }: { testID?: string }) =>
      React.createElement('span', { 'data-testid': testID }, 'Loading'),
    Stack: Container,
    Toast: {
      error: (...args: unknown[]) => {
        mockToastError(...args);
      },
    },
    Tooltip: ({ renderTrigger }: { renderTrigger: React.ReactNode }) =>
      renderTrigger,
    XStack: Container,
    YStack: Container,
  };
});

describe('CustomInjectedE2EWorkflowModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockE2ERunning = false;
    mockE2EGenerating = false;
    mockWorkflowActionsListener = undefined;
    mockRouteParams.e2eOutcome = undefined;
    mockRouteParams.recordingPhase = undefined;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState: jest.fn().mockResolvedValue({
            recording: {
              finishedAt: '2026-08-04T00:00:00.000Z',
              relativeFile:
                'packages/connect-button-workbench/dapps/defillama/ssv-network/recording.json',
              sha256: 'a'.repeat(64),
              stepCount: 3,
            },
            e2e: {
              current: true,
              recordingSha256: 'a'.repeat(64),
              relativeFile:
                'packages/connect-button-workbench/dapps/defillama/ssv-network/e2e.mjs',
            },
            adapter: {
              relativeFile:
                'packages/connect-button-workbench/dapps/defillama/ssv-network/adapter.ts',
            },
            canValidate: true,
          }),
          getCustomInjectedDappDirectory: jest
            .fn()
            .mockResolvedValue(
              '/workspace/packages/connect-button-workbench/dapps/defillama/ssv-network',
            ),
          openCustomInjectedDappDirectory: mockOpenDappDirectory,
        },
      },
    });
  });

  test('renders each workflow icon inside its description and runs validation', async () => {
    render(<CustomInjectedE2EWorkflowModal />);

    await screen.findByTestId('custom-injected-e2e-step-generate');
    expect(screen.getByText('E2E workflow')).not.toBeNull();
    expect(screen.getByText('SSV Network')).not.toBeNull();
    expect(
      screen.getByText(
        'Only the latest recording and generated artifacts are kept.',
      ),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-step-record').textContent,
    ).toContain('01Record');
    expect(
      screen.getByTestId('custom-injected-e2e-step-generate').textContent,
    ).toContain('02Generate E2E');
    expect(
      screen.getByTestId('custom-injected-e2e-step-validate').textContent,
    ).toContain('03Validate E2E');
    expect(
      screen.getByTestId('custom-injected-e2e-step-adapter').textContent,
    ).toContain('OPTAdapter');
    const recordDescription = screen.getByTestId(
      'custom-injected-e2e-step-record-description',
    );
    expect(
      recordDescription.querySelector('[data-icon-name="RecordCircleOutline"]'),
    ).not.toBeNull();
    const generateDescription = screen.getByTestId(
      'custom-injected-e2e-step-generate-description',
    );
    expect(
      generateDescription.querySelector(
        '[data-icon-name="CodeBracketsOutline"]',
      ),
    ).not.toBeNull();
    const validationDescription = screen.getByTestId(
      'custom-injected-e2e-step-validate-description',
    );
    expect(
      validationDescription.querySelector(
        '[data-icon-name="PlayCircleOutline"]',
      ),
    ).not.toBeNull();
    await waitFor(() =>
      expect(recordDescription.textContent).toContain(
        'recording.jsonrecorded.',
      ),
    );
    expect(
      screen
        .getByTestId('custom-injected-e2e-progress')
        .getAttribute('data-value'),
    ).toBe('67');
    const recordStatusIcon = screen.getByTestId(
      'custom-injected-e2e-step-record-status-icon',
    );
    expect(recordStatusIcon.getAttribute('data-background-color')).toBe(
      '$bgInfo',
    );
    expect(
      recordStatusIcon
        .querySelector('[data-icon-name="RecordCircleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconInfo');
    expect(generateDescription.textContent).toContain('e2e.mjsgenerated.');
    expect(validationDescription.textContent).toContain(
      'E2Eready to validate.',
    );
    expect(
      screen
        .getByTestId('custom-injected-e2e-step-validate')
        .getAttribute('data-background-color'),
    ).toBe('$bgInfoSubdued');
    const validateStatusIcon = screen.getByTestId(
      'custom-injected-e2e-step-validate-status-icon',
    );
    expect(validateStatusIcon.getAttribute('data-background-color')).toBe(
      '$bgSubdued',
    );
    expect(validateStatusIcon.getAttribute('data-opacity')).toBe('0.5');
    const adapterStatusIcon = screen.getByTestId(
      'custom-injected-e2e-step-adapter-status-icon',
    );
    expect(adapterStatusIcon.getAttribute('data-background-color')).toBe(
      '$bgAccent',
    );
    expect(adapterStatusIcon.getAttribute('data-opacity')).toBe('1');
    expect(
      adapterStatusIcon
        .querySelector('[data-icon-name="PuzzleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconOnColor');
    expect(
      screen.getByTestId('custom-injected-e2e-workflow-record').dataset.color,
    ).toBe('$textInfo');
    expect(screen.getByRole('button', { name: 'Validate' }).dataset.color).toBe(
      '$textSuccess',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(mockPop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockValidateE2E).toHaveBeenCalledTimes(1));
  });

  test('shows a live stop action while validation is running', async () => {
    render(<CustomInjectedE2EWorkflowModal />);
    await screen.findByTestId('custom-injected-e2e-workflow-validate');

    act(() => {
      mockE2ERunning = true;
      mockWorkflowActionsListener?.();
    });

    expect(
      screen.getByTestId('custom-injected-e2e-step-validate').textContent,
    ).toContain('E2Evalidating…');
    expect(
      screen.getByTestId('custom-injected-e2e-workflow-stop-spinner'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-e2e-workflow-record')
        .hasAttribute('disabled'),
    ).toBe(true);
    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(stopButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(stopButton);
    expect(mockStopE2E).toHaveBeenCalledTimes(1);
    expect(mockPop).not.toHaveBeenCalled();
  });

  test('shows a live stop action while generation is running', async () => {
    render(<CustomInjectedE2EWorkflowModal />);
    await screen.findByTestId('custom-injected-e2e-step-generate');

    act(() => {
      mockE2EGenerating = true;
      mockWorkflowActionsListener?.();
    });

    expect(
      screen.getByTestId('custom-injected-e2e-step-generate').textContent,
    ).toContain('e2e.mjsgenerating and validating…');
    expect(
      screen.getByTestId(
        'custom-injected-e2e-workflow-generation-stop-spinner',
      ),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-e2e-workflow-record')
        .hasAttribute('disabled'),
    ).toBe(true);
    const stopButton = screen.getByTestId(
      'custom-injected-e2e-workflow-generation-stop',
    );
    expect(stopButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(stopButton);
    expect(mockStopE2EGeneration).toHaveBeenCalledTimes(1);
    expect(mockPop).not.toHaveBeenCalled();
  });

  test('shows incomplete descriptions for missing workflow artifacts', async () => {
    Object.defineProperty(
      globalThis.desktopApiProxy.webview,
      'getCustomInjectedE2EState',
      {
        configurable: true,
        value: jest.fn().mockResolvedValue({
          recording: null,
          e2e: null,
          adapter: null,
          canValidate: false,
        }),
      },
    );

    render(<CustomInjectedE2EWorkflowModal />);

    await screen.findByTestId('custom-injected-e2e-workflow-panel');
    expect(
      screen.getByTestId('custom-injected-e2e-step-record-description')
        .textContent,
    ).toContain('recording.jsonnot recorded.');
    expect(
      screen.getByTestId('custom-injected-e2e-step-generate-description')
        .textContent,
    ).toContain('e2e.mjsnot generated.');
    const adapterRow = screen.getByTestId('custom-injected-e2e-step-adapter');
    expect(adapterRow.textContent).toContain('adapter.tsnot generated.');
    expect(
      adapterRow.querySelector('[data-icon-name="PuzzleOutline"]'),
    ).not.toBeNull();
    const adapterStatusIcon = screen.getByTestId(
      'custom-injected-e2e-step-adapter-status-icon',
    );
    expect(adapterStatusIcon.getAttribute('data-background-color')).toBe(
      '$bgSubdued',
    );
    expect(adapterStatusIcon.getAttribute('data-opacity')).toBe('0.5');
    expect(
      screen
        .getByTestId('custom-injected-e2e-progress')
        .getAttribute('data-value'),
    ).toBe('0');
  });

  test('asks for a re-record when deterministic generation did not produce a current E2E', async () => {
    Object.defineProperty(
      globalThis.desktopApiProxy.webview,
      'getCustomInjectedE2EState',
      {
        configurable: true,
        value: jest.fn().mockResolvedValue({
          recording: {
            finishedAt: '2026-08-05T00:00:00.000Z',
            relativeFile:
              'packages/connect-button-workbench/dapps/defillama/ssv-network/recording.json',
            sha256: 'b'.repeat(64),
            stepCount: 1,
          },
          e2e: {
            current: false,
            recordingSha256: 'a'.repeat(64),
            relativeFile:
              'packages/connect-button-workbench/dapps/defillama/ssv-network/e2e.mjs',
          },
          adapter: null,
          canValidate: false,
        }),
      },
    );

    render(<CustomInjectedE2EWorkflowModal />);

    await screen.findByText('requires re-recording.');
    expect(
      screen
        .getByTestId('custom-injected-e2e-step-generate')
        .querySelector('[data-icon-name="CodeBracketsOutline"]'),
    ).not.toBeNull();
  });

  test('restores the persisted validation result', async () => {
    Object.defineProperty(
      globalThis.desktopApiProxy.webview,
      'getCustomInjectedE2EState',
      {
        configurable: true,
        value: jest.fn().mockResolvedValue({
          recording: {
            finishedAt: '2026-08-04T00:00:00.000Z',
            relativeFile: 'recording.json',
            sha256: 'a'.repeat(64),
            stepCount: 3,
          },
          e2e: {
            current: true,
            recordingSha256: 'a'.repeat(64),
            relativeFile: 'e2e.mjs',
          },
          adapter: null,
          validation: {
            current: true,
            passed: true,
            recordingSha256: 'a'.repeat(64),
            relativeFile: 'e2e-result.json',
          },
          canValidate: true,
        }),
      },
    );

    render(<CustomInjectedE2EWorkflowModal />);

    expect(await screen.findByText('passed.')).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-step-validate-description')
        .textContent,
    ).toContain('E2Epassed.');
    expect(
      screen
        .getByTestId('custom-injected-e2e-progress')
        .getAttribute('data-value'),
    ).toBe('100');
    expect(screen.getByRole('button', { name: 'Run again' })).not.toBeNull();
  });

  test('shows the full DApp path beside its Open button in the footer', async () => {
    render(<CustomInjectedE2EWorkflowModal />);

    expect(
      await screen.findByText(
        '/workspace/packages/connect-button-workbench/dapps/defillama/ssv-network',
      ),
    ).not.toBeNull();
    const directoryBar = screen.getByTestId(
      'custom-injected-e2e-directory-bar',
    );
    expect(
      directoryBar.querySelector(
        '[data-testid="custom-injected-e2e-directory-path"]',
      ),
    ).not.toBeNull();
    expect(
      directoryBar.querySelector(
        '[data-testid="custom-injected-e2e-open-directory"]',
      ),
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId('custom-injected-e2e-open-directory'));
    await waitFor(() =>
      expect(mockOpenDappDirectory).toHaveBeenCalledWith(
        'session-1',
        'defillama:ssv-network',
      ),
    );
  });

  test('opens error details without rendering the log in the workflow', async () => {
    const errorLog = [
      'OneKey Desktop E2E validation',
      'Exit code: 4',
      '--- stderr ---',
      '{"passed":false}',
    ].join('\n');
    mockRouteParams.e2eOutcome = {
      passed: false,
      text: 'Failed · clean-session-1',
      errorLog,
    };

    render(<CustomInjectedE2EWorkflowModal />);

    await screen.findByTestId('custom-injected-e2e-step-generate');
    expect(screen.getByText('failed.')).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-step-validate-description')
        .textContent,
    ).toContain('E2Efailed.');
    expect(
      screen
        .getByTestId('custom-injected-e2e-step-validate')
        .getAttribute('data-background-color'),
    ).toBe('$bgInfoSubdued');
    expect(screen.queryByTestId('workflow-Result')).toBeNull();
    expect(screen.queryByTestId('custom-injected-e2e-error-log')).toBeNull();
    expect(screen.queryByText('Exit code: 4')).toBeNull();

    fireEvent.click(screen.getByTestId('custom-injected-e2e-view-error'));
    expect(mockPush).toHaveBeenCalledWith('CustomInjectedE2EErrorDetail', {
      errorLog,
      protocolName: 'SSV Network',
    });
  });
});
