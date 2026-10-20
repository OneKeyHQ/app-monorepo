import {
  memo,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CSSProperties } from 'react';

import { createPortal } from 'react-dom';

import { DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';

import {
  getAccountSelectorMirrorInspectorSnapshot,
  subscribeAccountSelectorMirrorInspector,
} from './AccountSelectorMirrorInspectorObserver';
import { AccountSelectorMirrorInspectorTestIDs } from './AccountSelectorMirrorInspectorTestIDs';

import type {
  IAccountSelectorMirrorInspectorStatus,
  IAccountSelectorMirrorValidationReport,
} from './AccountSelectorMirrorInspectorValidation';

export type IAccountSelectorMirrorInspectorProps = {
  onClose: () => void;
};

const statusColors: Record<IAccountSelectorMirrorInspectorStatus, string> = {
  fail: '#f85149',
  notApplicable: '#8b949e',
  notObserved: '#58a6ff',
  pass: '#3fb950',
  pending: '#d29922',
  superseded: '#8b949e',
};

const compactButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#c9d1d9',
  cursor: 'pointer',
  font: 'inherit',
  padding: '4px 6px',
};

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}

function shortenValue(value: string | undefined, head = 8, tail = 6) {
  if (!value) return '—';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function StatusLabel({
  label,
  status,
}: {
  label: string;
  status: IAccountSelectorMirrorInspectorStatus;
}) {
  return (
    <span style={{ color: statusColors[status], whiteSpace: 'nowrap' }}>
      {label}: {status}
    </span>
  );
}

function InspectorFindingList({
  addressRevealed,
  report,
}: {
  addressRevealed: boolean;
  report: IAccountSelectorMirrorValidationReport;
}) {
  return (
    <div
      data-testid={AccountSelectorMirrorInspectorTestIDs.findings(
        report.instanceId,
        report.num,
      )}
      style={{
        background: '#0d1117',
        borderRadius: 4,
        marginTop: 6,
        padding: 6,
      }}
    >
      {report.findings.length ? (
        report.findings.map((finding, index) => {
          const shouldMaskAddress =
            finding.field.toLowerCase().includes('address') && !addressRevealed;
          const expected = shouldMaskAddress
            ? shortenValue(
                typeof finding.expected === 'string'
                  ? finding.expected
                  : undefined,
              )
            : formatValue(finding.expected);
          const actual = shouldMaskAddress
            ? shortenValue(
                typeof finding.actual === 'string' ? finding.actual : undefined,
              )
            : formatValue(finding.actual);
          return (
            <div
              key={`${finding.field}:${index}`}
              style={{
                borderLeft: `2px solid ${statusColors[finding.status]}`,
                marginBottom: 6,
                overflowWrap: 'anywhere',
                paddingLeft: 6,
              }}
            >
              <div style={{ color: statusColors[finding.status] }}>
                {finding.field} · {finding.status}
              </div>
              <div>expected: {expected}</div>
              <div>actual: {actual}</div>
              <div style={{ color: '#8b949e' }}>{finding.reason}</div>
            </div>
          );
        })
      ) : (
        <div style={{ color: '#8b949e' }}>No field-level findings.</div>
      )}
    </div>
  );
}

function InspectorSlot({
  report,
}: {
  report: IAccountSelectorMirrorValidationReport;
}) {
  const [areFindingsExpanded, setAreFindingsExpanded] = useState(false);
  const [isAddressRevealed, setIsAddressRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const address = report.actual.active?.address;
  const handleCopy = useCallback(async () => {
    if (!address || !globalThis.navigator?.clipboard?.writeText) return;
    await globalThis.navigator.clipboard.writeText(address);
    setIsCopied(true);
    globalThis.setTimeout(() => setIsCopied(false), 1200);
  }, [address]);

  return (
    <div
      data-status={report.overallStatus}
      data-testid={AccountSelectorMirrorInspectorTestIDs.slot(
        report.instanceId,
        report.num,
      )}
      style={{
        border: `1px solid ${statusColors[report.overallStatus]}55`,
        borderRadius: 6,
        marginTop: 6,
        padding: 7,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ color: statusColors[report.overallStatus] }}>
          num={report.num} · {report.overallStatus}
        </strong>
        <span style={{ color: '#8b949e' }}>
          ready={String(report.actual.active?.ready ?? false)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '3px 10px',
          marginTop: 4,
        }}
      >
        <StatusLabel label="Context" status={report.contextStatus} />
        <StatusLabel label="Persisted" status={report.persistenceStatus} />
        <StatusLabel label="Consumer" status={report.consumerStatus} />
      </div>
      <div
        style={{
          display: 'grid',
          gap: '2px 8px',
          gridTemplateColumns: '62px minmax(0, 1fr)',
          marginTop: 6,
          overflowWrap: 'anywhere',
        }}
      >
        <span style={{ color: '#8b949e' }}>network</span>
        <span>
          S {formatValue(report.actual.selected?.networkId)} · A{' '}
          {formatValue(report.actual.active?.networkId)}
        </span>
        <span style={{ color: '#8b949e' }}>derive</span>
        <span>
          S {formatValue(report.actual.selected?.deriveType)} · A{' '}
          {formatValue(report.actual.active?.deriveType)}
        </span>
        <span style={{ color: '#8b949e' }}>wallet</span>
        <span>{shortenValue(report.actual.selected?.walletId)}</span>
        <span style={{ color: '#8b949e' }}>account</span>
        <span>
          {shortenValue(
            report.actual.selected?.indexedAccountId ??
              report.actual.selected?.othersWalletAccountId,
          )}
        </span>
        <span style={{ color: '#8b949e' }}>address</span>
        <span>
          {isAddressRevealed ? formatValue(address) : shortenValue(address)}{' '}
          {address ? (
            <>
              <button
                data-testid={AccountSelectorMirrorInspectorTestIDs.revealAddress(
                  report.instanceId,
                  report.num,
                )}
                onClick={() => setIsAddressRevealed((value) => !value)}
                style={compactButtonStyle}
                type="button"
              >
                {isAddressRevealed ? 'hide' : 'reveal'}
              </button>
              <button
                data-testid={AccountSelectorMirrorInspectorTestIDs.copyAddress(
                  report.instanceId,
                  report.num,
                )}
                onClick={() => void handleCopy()}
                style={compactButtonStyle}
                type="button"
              >
                {isCopied ? 'copied' : 'copy'}
              </button>
            </>
          ) : null}
        </span>
        <span style={{ color: '#8b949e' }}>transition</span>
        <span>
          #{formatValue(report.transition.transitionId)} · reload{' '}
          {formatValue(report.transition.activeReloadId)} ·{' '}
          {formatValue(report.transition.selectedReason)}
        </span>
      </div>
      <button
        aria-expanded={areFindingsExpanded}
        data-testid={AccountSelectorMirrorInspectorTestIDs.findingsToggle(
          report.instanceId,
          report.num,
        )}
        onClick={() => setAreFindingsExpanded((value) => !value)}
        style={{
          ...compactButtonStyle,
          color: report.findings.some((finding) => finding.status === 'fail')
            ? statusColors.fail
            : '#8b949e',
          paddingLeft: 0,
        }}
        type="button"
      >
        {areFindingsExpanded ? 'Hide' : 'Show'} findings (
        {report.findings.length})
      </button>
      {areFindingsExpanded ? (
        <InspectorFindingList
          addressRevealed={isAddressRevealed}
          report={report}
        />
      ) : null}
    </div>
  );
}

function BasicAccountSelectorMirrorInspector({
  onClose,
}: IAccountSelectorMirrorInspectorProps) {
  const snapshot = useSyncExternalStore(
    subscribeAccountSelectorMirrorInspector,
    getAccountSelectorMirrorInspectorSnapshot,
    getAccountSelectorMirrorInspectorSnapshot,
  );
  const [isCollapsed, setIsCollapsed] = useState(true);
  const reportsByInstance = useMemo(() => {
    const result = new Map<number, IAccountSelectorMirrorValidationReport[]>();
    for (const report of snapshot.reports) {
      const reports = result.get(report.instanceId) ?? [];
      reports.push(report);
      result.set(report.instanceId, reports);
    }
    return [...result.entries()];
  }, [snapshot.reports]);

  return createPortal(
    <div
      data-testid={AccountSelectorMirrorInspectorTestIDs.root}
      style={{
        background: 'rgba(13, 17, 23, 0.97)',
        border: '1px solid rgba(139, 148, 158, 0.5)',
        borderRadius: 8,
        bottom: 12,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        color: '#c9d1d9',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        maxHeight: isCollapsed ? 44 : '72vh',
        overflow: 'hidden',
        pointerEvents: 'auto',
        position: 'fixed',
        right: 12,
        width: 'min(520px, calc(100vw - 24px))',
        zIndex: DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: '#161b22',
          display: 'flex',
          flexShrink: 0,
          height: 42,
          padding: '0 6px 0 10px',
        }}
      >
        <strong style={{ color: '#58a6ff', marginRight: 8 }}>
          Account Selector Mirrors
        </strong>
        <span
          data-testid={AccountSelectorMirrorInspectorTestIDs.summary}
          style={{
            color: snapshot.summary.failed ? '#f85149' : '#8b949e',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          M {snapshot.summary.mountedMirrors} · V{' '}
          {snapshot.summary.fullyVerified} · P {snapshot.summary.pending} · C{' '}
          {snapshot.summary.contextOnly} · F {snapshot.summary.failed}
        </span>
        <button
          aria-label={isCollapsed ? 'Expand inspector' : 'Collapse inspector'}
          data-testid={AccountSelectorMirrorInspectorTestIDs.toggle}
          onClick={() => setIsCollapsed((value) => !value)}
          style={compactButtonStyle}
          type="button"
        >
          {isCollapsed ? '+' : '−'}
        </button>
        <button
          aria-label="Close inspector"
          data-testid={AccountSelectorMirrorInspectorTestIDs.close}
          onClick={onClose}
          style={compactButtonStyle}
          type="button"
        >
          ×
        </button>
      </div>
      {isCollapsed ? null : (
        <div
          data-testid={AccountSelectorMirrorInspectorTestIDs.list}
          style={{ minHeight: 0, overflow: 'auto', padding: '2px 8px 10px' }}
        >
          {reportsByInstance.length ? (
            reportsByInstance.map(([instanceId, reports]) => {
              const first = reports[0];
              return (
                <div
                  data-testid={AccountSelectorMirrorInspectorTestIDs.instance(
                    instanceId,
                  )}
                  key={instanceId}
                  style={{
                    borderBottom: '1px solid rgba(139, 148, 158, 0.25)',
                    padding: '8px 0',
                  }}
                >
                  <div style={{ overflowWrap: 'anywhere' }}>
                    <strong>
                      {first.perfDebugName || first.probeName} #{instanceId}
                    </strong>
                    <div style={{ color: '#8b949e' }}>
                      {first.sceneName}
                      {first.sceneUrl ? ` · ${first.sceneUrl}` : ''} · enabled [
                      {first.enabledNum.join(', ')}]
                    </div>
                  </div>
                  {reports.map((report) => (
                    <InspectorSlot
                      key={`${report.instanceId}:${report.num}`}
                      report={report}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            <div style={{ color: '#8b949e', padding: 12 }}>
              Waiting for mounted AccountSelectorProviderMirror instances…
            </div>
          )}
        </div>
      )}
    </div>,
    globalThis.document.body,
  );
}

export const AccountSelectorMirrorInspector = memo(
  BasicAccountSelectorMirrorInspector,
);

export default AccountSelectorMirrorInspector;
