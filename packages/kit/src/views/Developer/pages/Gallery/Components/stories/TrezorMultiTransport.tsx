/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @cspell/spellchecker */
import { useCallback, useMemo, useRef, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';

import {
  Button,
  Divider,
  Input,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { createTrezorConnector } from '@onekeyhq/shared/src/hardware/connector-loader/trezor';

import { Layout } from './utils/Layout';

import type { ConnectorDevice, IConnector } from '@onekeyfe/hwk-adapter-core';
import type { TrezorAdapter as IHwkTrezorAdapter } from '@onekeyfe/hwk-trezor-adapter';

/**
 * Dev harness to verify Trezor USB+BLE fusion without the onboarding flow.
 * It drives the fused connector directly and answers:
 *   - device_id obtainable on each transport? consistent across them?
 *   - THP credential reuse: same transport (USB→USB) and cross transport
 *     (USB→BLE / BLE→USB) — does a later connect autoconnect or re-pair?
 *   - every scan-stage field (USB descriptor / BLE advertisement) and every
 *     connect-stage Features field, dumped in full.
 *
 * Credentials are NOT warm-loaded, so the FIRST connect pairs and every
 * subsequent connect's autoconnect-vs-repair outcome is observable. The fused
 * connector now shares minted credentials across child transports, so a USB
 * pairing should let BLE autoconnect IF the device accepts cross-transport
 * credentials.
 *
 * NOTE: own connector instance — don't run alongside the real connect flow.
 */

interface ILog {
  at: string;
  text: string;
}

interface IAttempt {
  at: string;
  source?: string;
  connectId: string;
  deviceId?: string;
  label?: string;
  model?: string;
  fw?: string;
  paired?: boolean; // true = re-paired this connect; false = autoconnected
  features?: Record<string, unknown>;
  error?: string;
}

type ITrezorStoredCredential = {
  credential?: string;
} & Record<string, unknown>;

type ITrezorBleDebugBridge = {
  connect?: (connectId: string) => Promise<unknown>;
  disconnect?: (connectId: string) => Promise<unknown>;
};

const str = (v: unknown): string => {
  if (typeof v === 'string') {
    return v;
  }
  if (v === null || v === undefined) {
    return '';
  }
  return JSON.stringify(v);
};

const pretty = (v: unknown): string => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

// Simple localStorage persistence for THP pairing credentials, so a device
// paired once autoconnects across panel reloads / Reset (mirrors the product's
// simpleDb persistence, dev-only). Credentials are plain {credential,
// host_static_key, trezor_static_public_key, autoconnect} — JSON-safe.
const CRED_KEY = 'debug.trezor.thpCredentials';
const credentialKey = (credential: ITrezorStoredCredential): string =>
  typeof credential.credential === 'string'
    ? credential.credential
    : JSON.stringify(credential);
const isStoredCredential = (value: unknown): value is ITrezorStoredCredential =>
  !!value && typeof value === 'object';
const loadStoredCredentials = (): ITrezorStoredCredential[] => {
  try {
    const parsed: unknown = JSON.parse(
      globalThis.localStorage.getItem(CRED_KEY) || '[]',
    );
    return Array.isArray(parsed) ? parsed.filter(isStoredCredential) : [];
  } catch {
    return [];
  }
};
const saveStoredCredentials = (
  credentials: ITrezorStoredCredential[],
): void => {
  try {
    globalThis.localStorage.setItem(CRED_KEY, JSON.stringify(credentials));
  } catch {
    // ignore quota / unavailable
  }
};
const clearStoredCredentials = (): void => {
  try {
    globalThis.localStorage.removeItem(CRED_KEY);
  } catch {
    // ignore
  }
};

const getLastFeatures = (
  attempts: IAttempt[],
): Record<string, unknown> | undefined => {
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const features = attempts[i].features;
    if (features) {
      return features;
    }
  }
  return undefined;
};

const TrezorMultiTransportTester = () => {
  const connectorRef = useRef<IConnector | null>(null);
  const [devices, setDevices] = useState<ConnectorDevice[]>([]);
  const [attempts, setAttempts] = useState<IAttempt[]>([]);
  // Live sessions keyed by connectId (a connect establishes one; getFeatures /
  // disconnect act on it). Splitting connect from getFeatures isolates which
  // step fails, and explicit disconnect frees the device's THP channel.
  const [sessions, setSessions] = useState<
    Record<string, { sessionId: string; source?: string; paired?: boolean }>
  >({});
  const [logs, setLogs] = useState<ILog[]>([]);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState<{ connectId: string } | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pin, setPin] = useState<{ connectId: string } | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [fastId, setFastId] = useState('');

  // ---- Passphrase / account section (drives the SDK TrezorAdapter directly,
  // so it exercises the real getPassphraseState + passphraseState alignment
  // — not the connector-direct path the verification section above uses). ----
  const adapterRef = useRef<IHwkTrezorAdapter | null>(null);
  const [ppConnectId, setPpConnectId] = useState('');
  const [ppState, setPpState] = useState(''); // passphraseState(公钥state); 选填
  const [ppChain, setPpChain] = useState<'btc' | 'evm'>('btc');
  const [ppPath, setPpPath] = useState("m/44'/0'/0'/0/0");
  const [ppOut, setPpOut] = useState<string[]>([]);
  const [passphrasePrompt, setPassphrasePrompt] = useState<{
    connectId: string;
  } | null>(null);
  const [passphraseValue, setPassphraseValue] = useState('');

  const { copyText } = useClipboard();
  const pairingFiredRef = useRef(false);
  // Accumulated THP credentials, persisted to localStorage and warm-loaded
  // into every fresh connector.
  const storedCredentialsRef = useRef<ITrezorStoredCredential[]>(
    loadStoredCredentials(),
  );
  const logsRef = useRef<ILog[]>([]);
  logsRef.current = logs;
  const append = useCallback((text: string) => {
    console.log('[TrezorMTTest]', text);
    setLogs([
      ...logsRef.current,
      { at: new Date().toLocaleTimeString(), text },
    ]);
  }, []);

  const ensureConnector = useCallback(async (): Promise<IConnector> => {
    if (connectorRef.current) return connectorRef.current;
    append('createTrezorConnector() ...');
    const connector = await createTrezorConnector();
    connector.on('ui-request', (data: any) => {
      const type = data?.type;
      const payload = data?.payload ?? {};
      append(`ui-request: ${type} ${str(payload)}`);
      if (type === 'ui-request-trezor-thp-pairing') {
        pairingFiredRef.current = true;
        setPairing({ connectId: payload.connectId });
      } else if (type === 'ui-request-pin') {
        setPin({ connectId: payload.connectId });
      } else if (type === 'ui-request-passphrase') {
        setPassphrasePrompt({ connectId: payload.connectId });
      }
    });
    connector.on('device-trezor-thp-credentials-changed', (d: any) => {
      const incomingValue = (d as { credentials?: unknown })?.credentials;
      const incoming = Array.isArray(incomingValue)
        ? incomingValue.filter(isStoredCredential)
        : [];
      let changed = false;
      for (const c of incoming) {
        if (
          !storedCredentialsRef.current.some(
            (e) => credentialKey(e) === credentialKey(c),
          )
        ) {
          storedCredentialsRef.current = [...storedCredentialsRef.current, c];
          changed = true;
        }
      }
      if (changed) saveStoredCredentials(storedCredentialsRef.current);
      append(
        `credentials-changed from ${str(d?.connectId)} +${incoming.length} → stored ${
          storedCredentialsRef.current.length
        } (shared to all transports, persisted to localStorage)`,
      );
    });
    connector.on('device-disconnect', (d: any) =>
      append(`device-disconnect: ${str(d?.connectId)}`),
    );
    // Warm-load any persisted credentials so a previously-paired device
    // autoconnects on every transport.
    if (storedCredentialsRef.current.length && connector.setKnownCredentials) {
      void connector.setKnownCredentials(storedCredentialsRef.current);
      append(
        `warm-loaded ${storedCredentialsRef.current.length} stored credential(s) → both transports should autoconnect`,
      );
    }
    connectorRef.current = connector;
    return connector;
  }, [append]);

  const onScan = useCallback(async () => {
    setBusy(true);
    try {
      const connector = await ensureConnector();
      append('searchDevices() ...');
      const found = await connector.searchDevices();
      setDevices(found);
      append(
        `searchDevices -> ${found.length}: ${found
          .map((d) => `${d.connectionType ?? '?'}:${d.connectId}`)
          .join(', ')}`,
      );
    } catch (e: any) {
      append(`scan error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [append, ensureConnector]);

  // Step 1: establish a THP session ONLY (handshake/pairing). No getFeatures.
  const onConnect = useCallback(
    async (device: ConnectorDevice) => {
      setBusy(true);
      append(
        `connect ${device.connectionType}:${device.connectId} — watch: pairing prompt (re-pair) vs straight session (autoconnect)`,
      );
      pairingFiredRef.current = false;
      try {
        const connector = await ensureConnector();
        const session = await connector.connect(device.connectId);
        const paired = pairingFiredRef.current;
        append(
          `✅ session ${device.connectionType}:${device.connectId} ${
            paired ? '(RE-PAIRED)' : '(AUTOCONNECT, no pairing)'
          } sessionId=${session.sessionId}`,
        );
        setSessions((prev) => ({
          ...prev,
          [device.connectId]: {
            sessionId: session.sessionId,
            source: device.connectionType,
            paired,
          },
        }));
        setAttempts((prev) => [
          ...prev,
          {
            at: new Date().toLocaleTimeString(),
            source: device.connectionType,
            connectId: device.connectId,
            paired,
          },
        ]);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        append(`❌ connect error: ${msg}`);
        setAttempts((prev) => [
          ...prev,
          {
            at: new Date().toLocaleTimeString(),
            source: device.connectionType,
            connectId: device.connectId,
            error: msg,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [append, ensureConnector],
  );

  // Step 2: getFeatures on an established session; fills device_id into the
  // latest attempt for this device.
  const onGetFeatures = useCallback(
    async (device: ConnectorDevice) => {
      const sessionEntry = sessions[device.connectId];
      if (!sessionEntry) {
        append(`not connected: ${device.connectId}`);
        return;
      }
      setBusy(true);
      try {
        const connector = await ensureConnector();
        const features = (await connector.call(
          sessionEntry.sessionId,
          'getFeatures',
          {},
        )) as Record<string, unknown>;
        const deviceId = str(features.device_id);
        append(
          `features ${device.connectionType}:${device.connectId} -> device_id=${deviceId}`,
        );
        setAttempts((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i -= 1) {
            if (copy[i].connectId === device.connectId && !copy[i].error) {
              copy[i] = {
                ...copy[i],
                deviceId,
                label: str(features.label),
                model: str(features.model),
                fw: `${str(features.major_version)}.${str(
                  features.minor_version,
                )}.${str(features.patch_version)}`,
                features,
              };
              break;
            }
          }
          return copy;
        });
      } catch (e: any) {
        append(`❌ getFeatures error: ${e?.message ?? String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [append, ensureConnector, sessions],
  );

  // Step 3: disconnect — frees the device's THP channel (fixes ThpTransportBusy
  // churn between attempts).
  const onDisconnect = useCallback(
    async (device: ConnectorDevice) => {
      const sessionEntry = sessions[device.connectId];
      if (!sessionEntry) return;
      setBusy(true);
      try {
        const connector = await ensureConnector();
        await connector.disconnect(sessionEntry.sessionId);
        append(`disconnected ${device.connectId} (THP channel freed)`);
        setSessions((prev) => {
          const copy = { ...prev };
          delete copy[device.connectId];
          return copy;
        });
      } catch (e: any) {
        append(`❌ disconnect error: ${e?.message ?? String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [append, ensureConnector, sessions],
  );

  const submitPairing = useCallback(() => {
    const connector = connectorRef.current;
    if (!connector || !pairing) return;
    append(`uiResponse THP pairing tag=${pairingCode}`);
    connector.uiResponse({
      type: UI_RESPONSE.RECEIVE_TREZOR_THP_PAIRING,
      payload: { tag: pairingCode },
    });
    setPairing(null);
    setPairingCode('');
  }, [append, pairing, pairingCode]);

  const submitPin = useCallback(() => {
    const connector = connectorRef.current;
    if (!connector || !pin) return;
    append('uiResponse PIN');
    connector.uiResponse({ type: UI_RESPONSE.RECEIVE_PIN, payload: pinValue });
    setPin(null);
    setPinValue('');
  }, [append, pin, pinValue]);

  const onReset = useCallback(() => {
    connectorRef.current?.reset();
    connectorRef.current = null;
    adapterRef.current = null;
    setDevices([]);
    setAttempts([]);
    setSessions({});
    setPairing(null);
    setPin(null);
    setPassphrasePrompt(null);
    append('reset — fresh connector (kept stored credentials)');
  }, [append]);

  const onClearCreds = useCallback(() => {
    clearStoredCredentials();
    storedCredentialsRef.current = [];
    connectorRef.current?.reset();
    connectorRef.current = null;
    adapterRef.current = null;
    setSessions({});
    append(
      'cleared stored credentials (localStorage) + fresh connector — next connect re-pairs from scratch',
    );
  }, [append]);

  // Fast connect-by-id: hit the BLE bridge directly (no THP), times how long
  // establishing the BLE link to a stored connectId takes (uses the early-exit
  // reconnect scan under the hood).
  const onFastConnect = useCallback(async () => {
    const id =
      fastId.trim() ||
      devices.find((d) => d.connectionType === 'ble')?.connectId ||
      '';
    if (!id) {
      append('fast-connect: no id (scan first or paste a BLE connectId)');
      return;
    }
    const ble = (
      globalThis as {
        window?: {
          desktopApi?: { thirdPartyBle?: ITrezorBleDebugBridge };
        };
      }
    )?.window?.desktopApi?.thirdPartyBle;
    if (!ble?.connect || !ble.disconnect) {
      append('fast-connect: window.desktopApi.thirdPartyBle unavailable');
      return;
    }
    setBusy(true);
    const t0 = Date.now();
    try {
      append(`fast connect-by-id (BLE link, no THP): ${id} ...`);
      await ble.connect(id);
      append(`✅ BLE link up in ${Date.now() - t0}ms (connect-by-id)`);
      await ble.disconnect(id);
      append(`disconnected ${id} (total ${Date.now() - t0}ms)`);
    } catch (e: any) {
      append(
        `❌ fast-connect failed after ${Date.now() - t0}ms: ${
          e?.message ?? String(e)
        }`,
      );
    } finally {
      setBusy(false);
    }
  }, [append, devices, fastId]);

  // ---- Passphrase / account handlers (via SDK TrezorAdapter) ----
  const ppLog = useCallback(
    (line: string) => {
      append(`[pp] ${line}`);
      setPpOut((prev) =>
        [...prev, `${new Date().toLocaleTimeString()}  ${line}`].slice(-40),
      );
    },
    [append],
  );

  // Lazily wrap the page's fused connector in the SDK adapter (dynamic import,
  // mirrors the registry). The adapter owns getPassphraseState + the
  // (connectId,state)->session cache; passphrase/PIN/pairing prompts still fire on
  // the connector, so the existing ui-request listener handles them.
  const ensureAdapter = useCallback(async (): Promise<IHwkTrezorAdapter> => {
    if (adapterRef.current) return adapterRef.current;
    const connector = await ensureConnector();
    const { TrezorAdapter } = await import('@onekeyfe/hwk-trezor-adapter');
    adapterRef.current = new TrezorAdapter(connector);
    ppLog('TrezorAdapter ready (wraps fused connector)');
    return adapterRef.current;
  }, [ensureConnector, ppLog]);

  // The connector re-handshakes on connect(), so a connector-direct session and
  // an adapter session can't coexist on one device. Free the direct one first
  // (one-way handoff direct → adapter) to avoid ThpTransportBusy.
  const freeDirectSession = useCallback(
    async (connectId: string) => {
      const sessionEntry = sessions[connectId];
      if (!sessionEntry) return;
      try {
        await connectorRef.current?.disconnect(sessionEntry.sessionId);
      } catch {
        // already gone
      }
      setSessions((prev) => {
        const copy = { ...prev };
        delete copy[connectId];
        return copy;
      });
      ppLog(`freed connector-direct session ${connectId} → adapter takes over`);
    },
    [ppLog, sessions],
  );

  const ppTargetId = ppConnectId.trim() || devices[0]?.connectId || '';

  // 直接获取 passphraseState（discover）：派生(解锁) → 强制刷新 features → 决定。
  // 隐藏钱包返回公钥state(回填输入框)；标准钱包返回 null。
  const onGetPassphraseState = useCallback(async () => {
    if (!ppTargetId) {
      ppLog('no device — scan first or paste a connectId');
      return;
    }
    setBusy(true);
    try {
      const adapter = await ensureAdapter();
      await freeDirectSession(ppTargetId);
      ppLog(`getPassphraseState(${ppTargetId}) [discover] ...`);
      const res = await adapter.getPassphraseState(ppTargetId);
      if (res.success) {
        if (res.payload === null || res.payload === undefined) {
          setPpState('');
          ppLog('✅ passphraseState = null（标准钱包，无需 pin）');
        } else {
          setPpState(res.payload);
          ppLog(`✅ passphraseState = ${res.payload} (filled input)`);
        }
      } else {
        ppLog(`❌ ${res.payload.error} (code ${res.payload.code})`);
      }
    } catch (e: any) {
      ppLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [ensureAdapter, freeDirectSession, ppLog, ppTargetId]);

  // 模仿"连接创建账户"：钱包身份 = device_id（硬件）+ passphraseState（公钥state，每
  // passphrase 不同；标准钱包为 null）。带 state=校验该钱包；不带=discover。
  const onCreateAccount = useCallback(async () => {
    if (!ppTargetId) {
      ppLog('no device — scan first or paste a connectId');
      return;
    }
    setBusy(true);
    try {
      const adapter = await ensureAdapter();
      await freeDirectSession(ppTargetId);
      const want = ppState.trim() || undefined;
      ppLog(
        `创建账户(${ppTargetId}) — getChainFingerprint(device_id) + getPassphraseState(${
          want ? `verify ${want}` : 'discover'
        }) ...`,
      );
      const fp = await adapter.getChainFingerprint(ppTargetId, '', 'evm');
      const ps = await adapter.getPassphraseState(ppTargetId, want);
      if (!fp.success) {
        ppLog(`❌ device_id: ${fp.payload.error}`);
        return;
      }
      if (!ps.success) {
        ppLog(
          `❌ passphraseState: ${ps.payload.error} (code ${ps.payload.code})`,
        );
        return;
      }
      setPpState(ps.payload ?? '');
      ppLog(
        `✅ 账户身份 → device_id=${fp.payload}  passphraseState=${
          ps.payload ?? 'null（标准钱包）'
        }`,
      );
    } catch (e: any) {
      ppLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [ensureAdapter, freeDirectSession, ppLog, ppState, ppTargetId]);

  // 标准取地址：带上 passphraseState，adapter 取址前把 session 对齐到该钱包。
  const onGetAddress = useCallback(async () => {
    if (!ppTargetId) {
      ppLog('no device — scan first or paste a connectId');
      return;
    }
    setBusy(true);
    try {
      const adapter = await ensureAdapter();
      await freeDirectSession(ppTargetId);
      const passphraseState = ppState.trim() || undefined;
      ppLog(
        `${ppChain}GetAddress(${ppTargetId}) path=${ppPath} passphraseState=${
          passphraseState ?? '(none)'
        } ...`,
      );
      const res =
        ppChain === 'evm'
          ? await adapter.evmGetAddress(ppTargetId, '', {
              path: ppPath,
              showOnDevice: false,
              passphraseState,
            })
          : await adapter.btcGetAddress(ppTargetId, '', {
              path: ppPath,
              showOnDevice: false,
              passphraseState,
            });
      if (res.success) {
        ppLog(`✅ address = ${res.payload.address}`);
      } else {
        ppLog(`❌ ${res.payload.error} (code ${res.payload.code})`);
      }
    } catch (e: any) {
      ppLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [
    ensureAdapter,
    freeDirectSession,
    ppChain,
    ppLog,
    ppPath,
    ppState,
    ppTargetId,
  ]);

  const submitPassphrase = useCallback(
    (onDevice: boolean) => {
      const connector = connectorRef.current;
      if (!connector || !passphrasePrompt) return;
      // Redact: never log the passphrase itself, only its length.
      append(
        onDevice
          ? 'uiResponse passphrase: on-device'
          : `uiResponse passphrase (redacted, len=${passphraseValue.length})`,
      );
      connector.uiResponse({
        type: UI_RESPONSE.RECEIVE_PASSPHRASE,
        payload: onDevice
          ? { value: '', passphraseOnDevice: true }
          : { value: passphraseValue, passphraseOnDevice: false },
      });
      setPassphrasePrompt(null);
      setPassphraseValue('');
    },
    [append, passphrasePrompt, passphraseValue],
  );

  // ---- Verdict matrix derived from attempt history ----
  const verdict = useMemo(() => {
    const ok = attempts.filter((a) => !a.error);
    const usb = ok.filter((a) => a.source === 'usb');
    const ble = ok.filter((a) => a.source === 'ble');
    const idUsb = usb.find((a) => a.deviceId)?.deviceId;
    const idBle = ble.find((a) => a.deviceId)?.deviceId;
    const sameId = !!idUsb && idUsb === idBle;

    // Walk in order: track which sources have paired so far; an autoconnect
    // (paired===false) proves reuse — same-transport if its own source paired
    // earlier, cross-transport if a different source paired earlier.
    const pairedSources = new Set<string>();
    let sameReuseUsb = false;
    let sameReuseBle = false;
    let crossReuse = false;
    for (const a of ok) {
      const s = a.source ?? '?';
      if (a.paired === true) {
        pairedSources.add(s);
      } else if (a.paired === false) {
        if (pairedSources.has(s)) {
          if (s === 'usb') sameReuseUsb = true;
          if (s === 'ble') sameReuseBle = true;
        }
        if ([...pairedSources].some((p) => p !== s)) crossReuse = true;
      }
    }
    return {
      idUsb,
      idBle,
      sameId,
      sameReuseUsb,
      sameReuseBle,
      crossReuse,
      lastUsbFeatures: getLastFeatures(usb),
      lastBleFeatures: getLastFeatures(ble),
    };
  }, [attempts]);

  const usbScanRaw = devices.find((d) => d.connectionType === 'usb')?.raw;
  const bleScanRaw = devices.find((d) => d.connectionType === 'ble')?.raw;

  const onCopyAll = useCallback(() => {
    const report = [
      '===== TREZOR MULTI-TRANSPORT REPORT =====',
      `time: ${new Date().toISOString()}`,
      '',
      '----- VERDICT -----',
      `device_id USB:        ${verdict.idUsb ?? '—'}`,
      `device_id BLE:        ${verdict.idBle ?? '—'}`,
      `device_id same:       ${verdict.sameId}`,
      `reuse USB->USB:       ${verdict.sameReuseUsb}`,
      `reuse BLE->BLE:       ${verdict.sameReuseBle}`,
      `reuse cross USB<->BLE:${verdict.crossReuse}`,
      '',
      '----- SCANNED -----',
      ...devices.map(
        (d) =>
          `[${d.connectionType}] ${d.connectId} name=${d.name} rssi=${
            d.rssi ?? ''
          }`,
      ),
      '',
      '----- ATTEMPTS -----',
      ...attempts.map((a) =>
        a.error
          ? `${a.at} [${a.source}] ${a.connectId} ERR ${a.error}`
          : `${a.at} [${a.source}] ${a.connectId} device_id=${a.deviceId} ${
              a.paired ? 're-paired' : 'AUTOCONNECT'
            } (${a.model} ${a.fw})`,
      ),
      '',
      '----- USB scan raw -----',
      pretty(usbScanRaw),
      '',
      '----- BLE scan raw -----',
      pretty(bleScanRaw),
      '',
      '----- USB Features (full) -----',
      pretty(verdict.lastUsbFeatures),
      '',
      '----- BLE Features (full) -----',
      pretty(verdict.lastBleFeatures),
      '',
      '----- LOGS -----',
      ...logs.map((l) => `${l.at}  ${l.text}`),
    ].join('\n');
    copyText(report);
  }, [attempts, bleScanRaw, copyText, devices, logs, usbScanRaw, verdict]);

  const Row = ({ label, val }: { label: string; val: string | boolean }) => {
    const isBooleanValue = typeof val === 'boolean';
    let color = '$text';
    let displayValue: string | boolean = val;
    if (isBooleanValue) {
      color = val ? '$textSuccess' : '$textCritical';
      displayValue = val ? '✅ yes' : '— no/pending';
    }
    return (
      <XStack jc="space-between" gap="$2">
        <SizableText size="$bodySm" color="$textSubdued" flex={1}>
          {label}
        </SizableText>
        <SizableText size="$bodySmMedium" color={color}>
          {displayValue}
        </SizableText>
      </XStack>
    );
  };

  const Dump = ({ title, value }: { title: string; value: unknown }) =>
    value ? (
      <YStack gap="$1">
        <SizableText size="$bodySmMedium">{title}</SizableText>
        <ScrollView
          height={160}
          borderWidth={1}
          borderColor="$borderSubdued"
          p="$2"
        >
          <SizableText size="$bodySm" fontFamily="$monoRegular">
            {pretty(value)}
          </SizableText>
        </ScrollView>
      </YStack>
    ) : null;

  return (
    <YStack gap="$3" p="$4">
      <XStack gap="$3" flexWrap="wrap">
        <Button variant="primary" loading={busy} onPress={onScan}>
          1. Scan (USB+BLE)
        </Button>
        <Button
          icon="Copy3Outline"
          onPress={onCopyAll}
          disabled={!devices.length && !attempts.length ? !logs.length : null}
        >
          复制全部
        </Button>
        <Button onPress={onReset}>Reset connector</Button>
        <Button variant="destructive" onPress={onClearCreds}>
          清空存储凭证
        </Button>
      </XStack>

      <SizableText size="$bodySm" color="$textSubdued">
        流程：Scan → 连 USB（弹码配对）→ 再连 USB（应 autoconnect）→ 连 BLE （应
        autoconnect = 跨通道凭证通用）。逐条看下方 attempts 的 paired 状态。
      </SizableText>

      {/* Fast connect-by-id timing (BLE link only, no THP) */}
      <YStack
        gap="$2"
        p="$3"
        borderRadius="$2"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <SizableText size="$bodyMdMedium">
          按 id 直连测速（BLE 链路，不走 THP）
        </SizableText>
        <XStack gap="$2">
          <Input
            flex={1}
            value={fastId}
            onChangeText={setFastId}
            placeholder="BLE connectId（留空=用扫到的 BLE）"
          />
          <Button variant="primary" loading={busy} onPress={onFastConnect}>
            连一下计时
          </Button>
        </XStack>
      </YStack>

      {/* Passphrase / account section — drives the SDK TrezorAdapter */}
      <YStack
        gap="$2"
        p="$3"
        borderRadius="$2"
        borderWidth={1}
        borderColor="$borderInfoSubdued"
      >
        <SizableText size="$bodyMdMedium">
          Passphrase / 账户（走 TrezorAdapter，验证真实 getPassphraseState +
          取址对齐）
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          目标设备留空=用第一个扫到的。passphraseState
          选填：空=discover（派生→刷新 features→隐藏钱包返公钥state / 标准钱包返
          null）；填了=verify（命中也重新派生公钥state 校验，不符则重建/拒）。
          设备需开启 passphrase 保护才会弹输入框。
        </SizableText>
        <XStack gap="$2">
          <Input
            flex={1}
            value={ppConnectId}
            onChangeText={setPpConnectId}
            placeholder={`目标 connectId（留空=${devices[0]?.connectId ?? '扫一个'}）`}
          />
        </XStack>
        <XStack gap="$2" ai="center">
          <Input
            flex={1}
            value={ppState}
            onChangeText={setPpState}
            placeholder="passphraseState（公钥state，选填）"
          />
          <Button size="small" loading={busy} onPress={onGetPassphraseState}>
            获取 passphraseState
          </Button>
        </XStack>
        <XStack gap="$2" ai="center" flexWrap="wrap">
          <Button
            size="small"
            onPress={() => setPpChain(ppChain === 'btc' ? 'evm' : 'btc')}
          >
            链：{ppChain.toUpperCase()}（点击切换）
          </Button>
          <Input
            flex={1}
            value={ppPath}
            onChangeText={setPpPath}
            placeholder="derivation path"
          />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button variant="primary" loading={busy} onPress={onCreateAccount}>
            模仿创建账户
          </Button>
          <Button loading={busy} onPress={onGetAddress}>
            取{ppChain.toUpperCase()}地址
          </Button>
        </XStack>
        {ppOut.length ? (
          <ScrollView
            height={140}
            borderWidth={1}
            borderColor="$borderSubdued"
            p="$2"
          >
            {ppOut.map((l, i) => (
              <SizableText key={i} size="$bodySm" fontFamily="$monoRegular">
                {l}
              </SizableText>
            ))}
          </ScrollView>
        ) : null}
      </YStack>

      {/* Passphrase prompt (device has passphrase protection on) */}
      {passphrasePrompt ? (
        <YStack
          gap="$2"
          p="$3"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderInfoSubdued"
        >
          <SizableText size="$bodyMdMedium">
            Passphrase（{passphrasePrompt.connectId}）— 输入后建立对应隐藏钱包
          </SizableText>
          <XStack gap="$2">
            <Input
              flex={1}
              value={passphraseValue}
              onChangeText={setPassphraseValue}
              placeholder="passphrase"
              secureTextEntry
            />
            <Button variant="primary" onPress={() => submitPassphrase(false)}>
              Submit
            </Button>
            <Button onPress={() => submitPassphrase(true)}>在设备上输入</Button>
          </XStack>
        </YStack>
      ) : null}

      {/* Pairing prompt */}
      {pairing ? (
        <YStack
          gap="$2"
          p="$3"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderCaution"
        >
          <SizableText size="$bodyMdMedium">
            THP 配对：在设备上看到的码输进来（{pairing.connectId}）
          </SizableText>
          <XStack gap="$2">
            <Input
              flex={1}
              value={pairingCode}
              onChangeText={setPairingCode}
              placeholder="pairing code"
            />
            <Button variant="primary" onPress={submitPairing}>
              Submit
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {/* PIN prompt */}
      {pin ? (
        <YStack gap="$2" p="$3" borderRadius="$2" borderWidth={1}>
          <SizableText size="$bodyMdMedium">PIN（{pin.connectId}）</SizableText>
          <XStack gap="$2">
            <Input
              flex={1}
              value={pinValue}
              onChangeText={setPinValue}
              placeholder="pin"
            />
            <Button variant="primary" onPress={submitPin}>
              Submit
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {/* Verdict matrix */}
      {attempts.length ? (
        <YStack
          gap="$1"
          p="$3"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
        >
          <SizableText size="$headingSm">验证矩阵</SizableText>
          <Row label="device_id (USB)" val={verdict.idUsb ?? '—'} />
          <Row label="device_id (BLE)" val={verdict.idBle ?? '—'} />
          <Row label="device_id 跨通道一致" val={verdict.sameId} />
          <Row label="凭证复用 USB→USB（同通道）" val={verdict.sameReuseUsb} />
          <Row label="凭证复用 BLE→BLE（同通道）" val={verdict.sameReuseBle} />
          <Row label="凭证复用 跨通道（USB↔BLE）" val={verdict.crossReuse} />
        </YStack>
      ) : null}

      {/* Scanned devices */}
      {devices.length ? (
        <YStack gap="$2">
          <SizableText size="$headingSm">
            Scanned ({devices.length})
          </SizableText>
          {devices.map((d) => (
            <XStack key={d.connectId} gap="$2" ai="center" flexWrap="wrap">
              <YStack flex={1}>
                <SizableText size="$bodyMdMedium">
                  [{d.connectionType ?? '?'}] {d.name}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {d.connectId}
                  {d.rssi !== null && d.rssi !== undefined
                    ? `  rssi=${d.rssi}`
                    : ''}
                </SizableText>
              </YStack>
              {sessions[d.connectId] ? (
                <XStack gap="$2">
                  <Button
                    size="small"
                    variant="primary"
                    loading={busy}
                    onPress={() => onGetFeatures(d)}
                  >
                    Get Features
                  </Button>
                  <Button
                    size="small"
                    loading={busy}
                    onPress={() => onDisconnect(d)}
                  >
                    Disconnect
                  </Button>
                </XStack>
              ) : (
                <Button
                  size="small"
                  loading={busy}
                  onPress={() => onConnect(d)}
                >
                  Connect
                </Button>
              )}
            </XStack>
          ))}
        </YStack>
      ) : null}

      {/* Attempt history */}
      {attempts.length ? (
        <YStack
          gap="$1"
          p="$3"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
        >
          <SizableText size="$headingSm">
            Attempts ({attempts.length})
          </SizableText>
          {attempts.map((a, i) => (
            <SizableText key={i} size="$bodySm">
              {a.at} [{a.source}] {a.connectId} →{' '}
              {a.error ? (
                <SizableText color="$textCritical">ERR {a.error}</SizableText>
              ) : (
                <>
                  device_id={a.deviceId}{' '}
                  <SizableText
                    color={a.paired ? '$textCaution' : '$textSuccess'}
                  >
                    {a.paired ? 're-paired' : 'AUTOCONNECT'}
                  </SizableText>{' '}
                  ({a.model} {a.fw})
                </>
              )}
            </SizableText>
          ))}
        </YStack>
      ) : null}

      {/* Full fields */}
      <Dump
        title="USB scan-stage raw (full USB descriptor)"
        value={usbScanRaw}
      />
      <Dump
        title="BLE scan-stage raw (full advertisement)"
        value={bleScanRaw}
      />
      <Dump
        title="USB Features (full, post-handshake)"
        value={verdict.lastUsbFeatures}
      />
      <Dump
        title="BLE Features (full, post-handshake)"
        value={verdict.lastBleFeatures}
      />

      <Divider />
      <SizableText size="$headingSm">Logs</SizableText>
      <ScrollView
        height={240}
        borderWidth={1}
        borderColor="$borderSubdued"
        p="$2"
      >
        {logs.map((l, i) => (
          <SizableText key={i} size="$bodySm" fontFamily="$monoRegular">
            {l.at} {l.text}
          </SizableText>
        ))}
      </ScrollView>
    </YStack>
  );
};

const TrezorMultiTransportGallery = () => (
  <Layout
    componentName="TrezorMultiTransport"
    description="Dev harness: verify Trezor USB+BLE fusion — credential reuse (same & cross transport), device_id consistency, and full field dumps — by driving the fused connector directly."
    elements={[
      {
        title: 'Trezor USB + BLE fusion verification',
        element: <TrezorMultiTransportTester />,
      },
    ]}
  />
);

export default TrezorMultiTransportGallery;
