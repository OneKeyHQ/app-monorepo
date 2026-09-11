/* eslint-disable onekey/no-raw-error */
import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';
import { isIOSWebEmbedDocumentUrl } from '@onekeyhq/shared/src/consts/webEmbedConsts';

import { writeMobileLockdownE2EReport } from './mobileLockdownReleaseCheck';

function requirePublicKaspaResult(condition: unknown): asserts condition {
  if (!condition) throw new Error('Unexpected unsigned Kaspa E2E result.');
}

function boundedElapsedMs(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  return Number.isFinite(elapsed)
    ? Math.min(60_000, Math.max(0, Math.floor(elapsed)))
    : 0;
}

function classifyRequestFailure(error: unknown) {
  try {
    // Match only the existing background-to-main RPC timeout. Never invoke an
    // error getter, serialize its payload, or expose an arbitrary SDK message.
    const message =
      error !== null &&
      (typeof error === 'object' || typeof error === 'function')
        ? Object.getOwnPropertyDescriptor(error, 'message')
        : undefined;
    return message &&
      Object.hasOwn(message, 'value') &&
      message.value === 'WebEmbed bridge call timeout (30s)'
      ? 'rpc-timeout'
      : 'request-rejected';
  } catch {
    return 'unknown';
  }
}

function publicKaspaRecord(
  value: unknown,
  keys: string[],
  optionalKeys: string[] = [],
) {
  requirePublicKaspaResult(
    typeof value === 'object' && value !== null && !Array.isArray(value),
  );
  const record = value as Record<string, unknown>;
  requirePublicKaspaResult(
    keys.every((key) => Object.hasOwn(record, key)) &&
      Object.keys(record).every(
        (key) => keys.includes(key) || optionalKeys.includes(key),
      ),
  );
  return record;
}

function readPublicKaspaCommit(value: unknown) {
  const commit = publicKaspaRecord(value, [
    'commitAddress',
    'commitScriptHex',
    'commitScriptPubKey',
  ]);
  const { commitAddress, commitScriptHex, commitScriptPubKey } = commit;
  requirePublicKaspaResult(
    typeof commitAddress === 'string' &&
      /^kaspa:[a-z0-9]+$/.test(commitAddress),
  );
  requirePublicKaspaResult(
    typeof commitScriptHex === 'string' &&
      /^(?:[a-f0-9]{2})+$/.test(commitScriptHex),
  );
  requirePublicKaspaResult(
    typeof commitScriptPubKey === 'string' &&
      /^(?:[a-f0-9]{2})+$/.test(commitScriptPubKey),
  );
  return { commitAddress, commitScriptHex, commitScriptPubKey };
}

function readPublicKaspaReveal(value: string, commitScriptPubKey: string) {
  const raw = publicKaspaRecord(JSON.parse(value), [
    'id',
    'version',
    'inputs',
    'outputs',
    'mass',
    'lockTime',
    'subnetworkId',
    'gas',
    'payload',
  ]);
  requirePublicKaspaResult(
    raw.version === 0 &&
      raw.lockTime === '0' &&
      raw.gas === '0' &&
      raw.payload === '' &&
      raw.subnetworkId === '0000000000000000000000000000000000000000',
  );
  requirePublicKaspaResult(
    Array.isArray(raw.inputs) && raw.inputs.length === 1,
  );
  requirePublicKaspaResult(
    Array.isArray(raw.outputs) && raw.outputs.length === 1,
  );
  const input = publicKaspaRecord(raw.inputs[0], [
    'transactionId',
    'index',
    'sequence',
    'sigOpCount',
    'signatureScript',
    'utxo',
  ]);
  // The pinned WASM getter returns undefined for an empty signature, and the
  // JSON bridge may omit that normalized key. Require the explicit empty raw
  // SafeJSON field before permitting either normalized empty representation.
  requirePublicKaspaResult(
    input.transactionId === 'ab'.repeat(32) &&
      input.index === 0 &&
      input.signatureScript === '',
  );
  const utxo = publicKaspaRecord(input.utxo, [
    'address',
    'amount',
    'scriptPublicKey',
    'blockDaaScore',
    'isCoinbase',
  ]);
  requirePublicKaspaResult(
    utxo.address === null &&
      utxo.amount === '130000000' &&
      utxo.scriptPublicKey === `0000${commitScriptPubKey}` &&
      utxo.blockDaaScore === '123456' &&
      utxo.isCoinbase === false,
  );
  const output = publicKaspaRecord(raw.outputs[0], [
    'value',
    'scriptPublicKey',
  ]);
  const { id, mass } = raw;
  const { sequence, sigOpCount } = input;
  const { value: amount, scriptPublicKey } = output;
  requirePublicKaspaResult(typeof id === 'string' && /^[a-f0-9]{64}$/.test(id));
  requirePublicKaspaResult(typeof mass === 'string' && /^\d+$/.test(mass));
  requirePublicKaspaResult(
    typeof sequence === 'string' && /^\d+$/.test(sequence),
  );
  requirePublicKaspaResult(
    typeof sigOpCount === 'number' && Number.isInteger(sigOpCount),
  );
  requirePublicKaspaResult(typeof amount === 'string' && /^\d+$/.test(amount));
  requirePublicKaspaResult(
    typeof scriptPublicKey === 'string' &&
      /^(?:[a-f0-9]{2})+$/.test(scriptPublicKey),
  );
  return { id, mass, sequence, sigOpCount, amount, scriptPublicKey };
}

function readPublicKaspaTransaction(
  value: unknown,
  raw: ReturnType<typeof readPublicKaspaReveal>,
) {
  // The API's historical declaration uses numeric lockTime/gas, while its
  // actual JSON bridge returns strings. Validate the wire result directly.
  const tx = publicKaspaRecord(value, [
    'version',
    'inputs',
    'outputs',
    'mass',
    'lockTime',
    'subnetworkId',
    'gas',
    'payload',
  ]);
  requirePublicKaspaResult(
    tx.version === 0 &&
      tx.lockTime === '0' &&
      tx.gas === '0' &&
      tx.payload === '' &&
      tx.subnetworkId === '0000000000000000000000000000000000000000',
  );
  requirePublicKaspaResult(Array.isArray(tx.inputs) && tx.inputs.length === 1);
  requirePublicKaspaResult(
    Array.isArray(tx.outputs) && tx.outputs.length === 1,
  );
  const input = publicKaspaRecord(
    tx.inputs[0],
    ['previousOutpoint', 'sequence', 'sigOpCount'],
    ['signatureScript'],
  );
  const outpoint = publicKaspaRecord(input.previousOutpoint, [
    'transactionId',
    'index',
  ]);
  requirePublicKaspaResult(
    outpoint.transactionId === 'ab'.repeat(32) &&
      outpoint.index === 0 &&
      (input.signatureScript === '' || input.signatureScript === undefined),
  );
  const { sequence, sigOpCount } = input;
  requirePublicKaspaResult(
    typeof sequence === 'string' && /^\d+$/.test(sequence),
  );
  requirePublicKaspaResult(
    typeof sigOpCount === 'number' &&
      Number.isInteger(sigOpCount) &&
      sigOpCount >= 0 &&
      sigOpCount <= 255,
  );
  const output = publicKaspaRecord(tx.outputs[0], [
    'amount',
    'scriptPublicKey',
  ]);
  const { amount } = output;
  requirePublicKaspaResult(typeof amount === 'string' && /^\d+$/.test(amount));
  const change = BigInt(amount);
  requirePublicKaspaResult(change >= 20_000_000n && change < 130_000_000n);
  let scriptVersion: string | number = 'serialized';
  let script: unknown = output.scriptPublicKey;
  if (typeof script !== 'string') {
    const scriptPublicKey = publicKaspaRecord(script, [
      'version',
      'scriptPublicKey',
    ]);
    requirePublicKaspaResult(
      typeof scriptPublicKey.version === 'number' &&
        Number.isInteger(scriptPublicKey.version) &&
        scriptPublicKey.version >= 0 &&
        scriptPublicKey.version <= 65_535,
    );
    scriptVersion = scriptPublicKey.version;
    script = scriptPublicKey.scriptPublicKey;
  }
  requirePublicKaspaResult(
    typeof script === 'string' && /^(?:[a-f0-9]{2})+$/.test(script),
  );
  const { mass } = tx;
  requirePublicKaspaResult(typeof mass === 'string' && /^\d+$/.test(mass));
  requirePublicKaspaResult(
    sequence === raw.sequence &&
      sigOpCount === raw.sigOpCount &&
      amount === raw.amount &&
      mass === raw.mass &&
      raw.scriptPublicKey ===
        (typeof scriptVersion === 'number'
          ? `${scriptVersion.toString(16).padStart(4, '0')}${script}`
          : script),
  );
  // Compare the validated wire fields directly; never serialize transactions
  // for hashing, signing, diagnostics, or comparison.
  return [raw.id, sequence, sigOpCount, amount, scriptVersion, script, mass];
}

export async function requestMobileLockdownWebEmbedMount() {
  const runId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  if (!runId || !/^[a-f0-9]{32}$/.test(runId) || __DEV__) {
    throw new Error('WebEmbed E2E requires an explicit Release test build.');
  }
  let providerReady = false;
  try {
    const { appEventBus, EAppEventBusNames } =
      await import('@onekeyhq/shared/src/eventBus/appEventBus');
    const deadline = Date.now() + 15_000;
    // The test starts during native bootstrap, before the lazily mounted UI
    // provider subscribes. Wait for its actual listener before issuing a mount
    // request; the background probe still requires the real page's RPC reply.
    while (
      appEventBus.listenerCount(EAppEventBusNames.LoadWebEmbedWebView) === 0
    ) {
      if (Date.now() >= deadline) {
        throw new Error('WebEmbed E2E UI provider did not become ready.');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    providerReady = true;
    appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
    writeMobileLockdownE2EReport(
      `[MobileLockdownWebEmbedMountE2E] ${JSON.stringify({ runId, runtime: 'main', status: 'requested', providerReady })}`,
      false,
    );
  } catch {
    writeMobileLockdownE2EReport(
      `[MobileLockdownWebEmbedMountE2E] ${JSON.stringify({ runId, runtime: 'main', status: 'failed', providerReady })}`,
      true,
    );
  }
}

// Called only from background, after the native profile launch acknowledgement.
export async function runMobileLockdownWebEmbedReleaseCheck() {
  const runId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  if (!runId || !/^[a-f0-9]{32}$/.test(runId) || __DEV__) {
    throw new Error('WebEmbed E2E requires an explicit Release test build.');
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  let passed = false;
  let intrinsics = false;
  let kaspaUnsigned = false;
  let kaspaRuns = 0;
  let fileBridge = false;
  let bridgeSource: 'file' | 'bundled-https' | 'bundled-scheme' | undefined;
  const startedAt = Date.now();
  let stage = 'bridge-import';
  const progress: { phase: 'load' | 'request' | 'result' } = { phase: 'load' };
  let failure:
    | 'total-deadline'
    | 'result-invalid'
    | 'unknown'
    | ReturnType<typeof classifyRequestFailure> = 'result-invalid';
  let requestStartedAt: number | undefined;
  let rpcElapsedMs: number | undefined;
  const startRequest = (requestStage: string) => {
    stage = requestStage;
    progress.phase = 'request';
    requestStartedAt = Date.now();
    rpcElapsedMs = undefined;
  };
  const finishRequest = (resultStage: string) => {
    stage = resultStage;
    progress.phase = 'result';
    if (requestStartedAt !== undefined) {
      rpcElapsedMs = boundedElapsedMs(requestStartedAt);
    }
  };
  try {
    const call = async () => {
      const { default: webembedApiProxy } =
        await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy');
      if (expired) return false;
      startRequest('bridge-request');
      const result = await webembedApiProxy.test.test1(runId);
      if (expired) return false;
      finishRequest('origin');
      const prefix = `${runId}: `;
      if (!result.startsWith(prefix)) return false;
      const url = new URL(result.slice(prefix.length));
      fileBridge =
        !process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER &&
        url.protocol === 'file:';
      if (fileBridge) bridgeSource = 'file';
      if (
        process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER &&
        url.origin === 'https://appassets.androidplatform.net' &&
        url.pathname === '/web-embed/index.html' &&
        !url.search &&
        !url.username &&
        !url.password
      ) {
        bridgeSource = 'bundled-https';
      }
      if (
        process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER &&
        isIOSWebEmbedDocumentUrl(result.slice(prefix.length))
      ) {
        bridgeSource = 'bundled-scheme';
      }
      if (!bridgeSource) return false;
      startRequest('intrinsics-request');
      const state = await webembedApiProxy.test.getRuntimeSecurityState();
      if (expired) return false;
      finishRequest('intrinsics');
      intrinsics =
        state.hardenType === 'function' &&
        state.objectFrozen &&
        state.arrayFrozen &&
        state.functionFrozen &&
        state.promiseFrozen;
      if (!intrinsics) return false;
      const api: Pick<
        IKaspaSdkApi,
        | 'buildCommitTxInfo'
        | 'createKRC20RevealTxJSON'
        | 'deserializeFromSafeJSON'
      > = webembedApiProxy.chainKaspa;
      // Reuse the public, unfunded smoke-web-embed fixture through the existing
      // background-to-WebEmbed API. No account lookup, signing or network call.
      const accountAddress =
        'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9';
      let previous: (string | number)[] | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        startRequest('kaspa-commit-request');
        const commitResult = await api.buildCommitTxInfo({
          accountAddress,
          transferDataString:
            '{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}',
          isTestnet: false,
        });
        if (expired) return false;
        finishRequest('kaspa-commit-result');
        const commit = readPublicKaspaCommit(commitResult);
        startRequest('kaspa-reveal-request');
        const reveal = await api.createKRC20RevealTxJSON({
          accountAddress,
          isTestnet: false,
          encodedTx: {
            utxoIds: [],
            inputs: [
              {
                address: commit.commitAddress,
                txid: 'ab'.repeat(32),
                scriptPubKey: commit.commitScriptPubKey,
                blockDaaScore: 123_456,
                vout: 0,
                satoshis: '130000000',
                scriptPublicKeyVersion: 0,
              },
            ],
            outputs: [],
            mass: 0,
            hasMaxSend: false,
            changeAddress: accountAddress,
            feeInfo: { price: '1', limit: '0' },
          },
        });
        if (expired) return false;
        finishRequest('kaspa-reveal-result');
        requirePublicKaspaResult(
          typeof reveal === 'string' && reveal.length > 0,
        );
        stage = 'kaspa-raw-unsigned';
        const raw = readPublicKaspaReveal(reveal, commit.commitScriptPubKey);
        startRequest('kaspa-deserialize-request');
        const transaction: unknown = await api.deserializeFromSafeJSON(reveal);
        if (expired) return false;
        finishRequest('kaspa-unsigned');
        const comparable = [
          commit.commitAddress,
          commit.commitScriptHex,
          commit.commitScriptPubKey,
          ...readPublicKaspaTransaction(transaction, raw),
        ];
        if (previous) {
          stage = 'kaspa-repeat';
          requirePublicKaspaResult(
            previous.length === comparable.length &&
              previous.every((value, index) => value === comparable[index]),
          );
        }
        previous = comparable;
        kaspaRuns += 1;
      }
      kaspaUnsigned = true;
      return true;
    };
    passed = await Promise.race([
      call(),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => {
          expired = true;
          failure = 'total-deadline';
          resolve(false);
        }, 60_000);
      }),
    ]);
  } catch (error) {
    // Requests and validation used to share a stage, hiding whether the page
    // replied. Keep only fixed classifications and bounded local durations.
    if (progress.phase === 'request') failure = classifyRequestFailure(error);
    else if (progress.phase === 'load') failure = 'unknown';
  } finally {
    expired = true;
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (progress.phase === 'request' && requestStartedAt !== undefined) {
    rpcElapsedMs = boundedElapsedMs(requestStartedAt);
  }
  writeMobileLockdownE2EReport(
    `[MobileLockdownWebEmbedE2E] ${JSON.stringify({ runId, runtime: 'background', status: passed ? 'passed' : 'failed', fileBridge, bridgeSource, intrinsics, kaspaUnsigned, kaspaRuns, ...(!passed ? { stage, failure, elapsedMs: boundedElapsedMs(startedAt), rpcElapsedMs } : {}) })}`,
    !passed,
  );
}

// These diagnostics are imported only inside the explicit Release E2E guards.
// Each Hermes heap owns its own session; no trace state crosses SharedRPC.
type ITraceOperation =
  | 'bridge'
  | 'intrinsics'
  | 'commit'
  | 'reveal'
  | 'deserialize';
type ITraceStage =
  | 'sending'
  | 'sent'
  | 'received'
  | 'request-sending'
  | 'request-returned'
  | 'response-writing'
  | 'response-written'
  | 'response-received'
  | 'resolving'
  | 'rejecting'
  | 'rpc-timeout'
  | 'caught-error'
  | 'bridge-change';
type ITraceSnapshot = {
  bridge:
    | import('@onekeyfe/cross-inpage-provider-core').JsBridgeBase
    | null
    | undefined;
  generation: number;
  ready: boolean;
  platform: 'ios' | 'android';
};
type ITraceView = { injectJavaScript: (script: string) => void };
function isTraceView(value: unknown): value is ITraceView {
  return (
    value !== null &&
    typeof value === 'object' &&
    'injectJavaScript' in value &&
    typeof value.injectJavaScript === 'function'
  );
}
function getTraceView(bridge: ITraceSnapshot['bridge']) {
  if (!bridge || !('webviewRef' in bridge)) return undefined;
  const ref = bridge.webviewRef;
  if (!ref || typeof ref !== 'object' || !('current' in ref)) return undefined;
  return isTraceView(ref.current) ? ref.current : undefined;
}
type ITraceCall = {
  operation: ITraceOperation;
  round: number;
  startedAt: number;
};
type ITraceSession = {
  runId: string;
  runtime: 'main' | 'background';
  startedAt: number;
  index: number;
  count: number;
  active: boolean;
  calls: Map<string, ITraceCall>;
  commit?: ReturnType<typeof readPublicKaspaCommit>;
  reveal?: string;
  snapshot?: () => ITraceSnapshot;
  bridge?: ITraceSnapshot['bridge'];
  view?: ITraceView;
  disposeObserver?: () => void;
};
const traceSessions = new Map<'main' | 'background', ITraceSession>();
const traceOperations: ITraceOperation[] = [
  'bridge',
  'intrinsics',
  'commit',
  'reveal',
  'deserialize',
  'commit',
  'reveal',
  'deserialize',
];
const tracePageStages = new Set([
  'observer-installed',
  'observer-unavailable',
  'expected',
  'request-received',
  'reply-sending',
  'reply-sent',
  'reply-throw',
  'script-discovered',
  'script-loaded',
  'script-error',
  'page-error',
  'page-rejection',
  'observer-cleanup',
]);
const traceType = 'ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE';
const publicKaspaAddress =
  'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9';

function equalPublicFixture(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (
    !value ||
    !expected ||
    typeof value !== 'object' ||
    typeof expected !== 'object'
  )
    return false;
  if (Array.isArray(value) !== Array.isArray(expected)) return false;
  if (Object.getPrototypeOf(value) !== Object.getPrototypeOf(expected))
    return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every((key) => {
    const actual = Object.getOwnPropertyDescriptor(value, key);
    const wanted = Object.getOwnPropertyDescriptor(expected, key);
    return (
      !!actual &&
      !!wanted &&
      Object.hasOwn(actual, 'value') &&
      Object.hasOwn(wanted, 'value') &&
      equalPublicFixture(actual.value, wanted.value)
    );
  });
}

function expectedTraceRequest(
  session: ITraceSession,
  operation: ITraceOperation,
) {
  if (operation === 'bridge')
    return { module: 'test', method: 'test1', params: [session.runId] };
  if (operation === 'intrinsics')
    return { module: 'test', method: 'getRuntimeSecurityState', params: [] };
  if (operation === 'commit')
    return {
      module: 'chainKaspa',
      method: 'buildCommitTxInfo',
      params: [
        {
          accountAddress: publicKaspaAddress,
          transferDataString:
            '{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}',
          isTestnet: false,
        },
      ],
    };
  if (operation === 'reveal' && session.commit)
    return {
      module: 'chainKaspa',
      method: 'createKRC20RevealTxJSON',
      params: [
        {
          accountAddress: publicKaspaAddress,
          isTestnet: false,
          encodedTx: {
            utxoIds: [],
            inputs: [
              {
                address: session.commit.commitAddress,
                txid: 'ab'.repeat(32),
                scriptPubKey: session.commit.commitScriptPubKey,
                blockDaaScore: 123_456,
                vout: 0,
                satoshis: '130000000',
                scriptPublicKeyVersion: 0,
              },
            ],
            outputs: [],
            mass: 0,
            hasMaxSend: false,
            changeAddress: publicKaspaAddress,
            feeInfo: { price: '1', limit: '0' },
          },
        },
      ],
    };
  if (operation === 'deserialize' && session.reveal)
    return {
      module: 'chainKaspa',
      method: 'deserializeFromSafeJSON',
      params: [session.reveal],
    };
  return undefined;
}

function emitBridgeTrace(
  session: ITraceSession,
  call: ITraceCall | undefined,
  stage: string,
  page?: {
    operation: string;
    round: number;
    elapsedMs: number;
    asset?: string;
  },
) {
  if (!session.active || session.count >= 200) return;
  session.count += 1;
  const snapshot = session.snapshot?.();
  writeMobileLockdownE2EReport(
    `[MobileLockdownBridgeTraceE2E] ${JSON.stringify({
      runId: session.runId,
      runtime: page ? 'webview' : session.runtime,
      operation: page?.operation ?? call?.operation ?? 'observer',
      round: page?.round ?? call?.round ?? 0,
      stage,
      elapsedMs: page?.elapsedMs ?? boundedElapsedMs(session.startedAt),
      ...(call && !page
        ? { rpcElapsedMs: boundedElapsedMs(call.startedAt) }
        : {}),
      ...(snapshot
        ? {
            bridgePresent: !!snapshot.bridge,
            bridgeSame: snapshot.bridge === session.bridge,
            webViewPresent: !!getTraceView(snapshot.bridge),
            webViewSame: getTraceView(snapshot.bridge) === session.view,
            bridgeReady: snapshot.ready === true,
            generation:
              Number.isSafeInteger(snapshot.generation) &&
              snapshot.generation >= 0 &&
              snapshot.generation <= 1_000_000
                ? snapshot.generation
                : -1,
          }
        : {}),
      ...(page?.asset ? { asset: page.asset } : {}),
    })}`,
    false,
  );
}

function createPageTraceScript(runId: string) {
  // Static observer code; only the validated public run ID is interpolated.
  // No eval/Function, SDK initialization, network request or timer override.
  return `;(function(){
    'use strict';
    const runId=${JSON.stringify(runId)};
    const type='ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE';
    const key='__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__';
    const started=Date.now();
    let active=true, count=0, latest={operation:'observer',round:0};
    const expected=[]; const calls=new Map(); const cleanup=[];
    const post=window.ReactNativeWebView && window.ReactNativeWebView.postMessage;
    function emit(stage,call,asset){try{
      if(!active || count>=100 || typeof post!=='function')return;
      count+=1; const elapsed=Date.now()-started;
      Reflect.apply(post,window.ReactNativeWebView,[JSON.stringify({type,runId,stage,
        operation:(call||latest).operation,round:(call||latest).round,
        elapsedMs:Number.isFinite(elapsed)?Math.min(60000,Math.max(0,Math.floor(elapsed))):0,
        ...(asset?{asset}: {})})]);
    }catch(_) {}}
    function stop(){if(!active)return;active=false;
      for(const dispose of cleanup){try{dispose();}catch(_) {}}
      calls.clear();expected.length=0;
      if(window[key]===controller)delete window[key];
    }
    const controller={runId,expect(data,operation,round){
      if(!active || expected.length>=8)return;
      expected.push({data,operation,round});latest={operation,round};emit('expected',latest);
    },stop};
    function equal(a,b){if(a===b)return true;
      if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
      const keys=Reflect.ownKeys(b);if(Reflect.ownKeys(a).length!==keys.length)return false;
      return keys.every(k=>{const x=Object.getOwnPropertyDescriptor(a,k),y=Object.getOwnPropertyDescriptor(b,k);
        return x&&y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&equal(x.value,y.value);});
    }
    function parse(value){if(typeof value==='string'){try{return JSON.parse(value);}catch(_){return;}}return value;}
    function received(payload){try{
      if(!active || !payload || payload.type!=='REQUEST' || payload.scope!=='$private')return;
      const index=expected.findIndex(item=>equal(payload.data,item.data));
      if(index<0 || (typeof payload.id!=='number' && typeof payload.id!=='string'))return;
      const call=expected.splice(index,1)[0];calls.set(payload.id,call);latest=call;emit('request-received',call);
    }catch(_) {}}
    function assetOf(target){if(!target || target.tagName!=='SCRIPT')return;
      const prefix=window.location.href.split('#')[0].replace(/index\\.html$/,'');
      const src=String(target.src||'');if(!src.startsWith(prefix))return;
      const match=src.slice(prefix.length).match(/^static\\/js\\/(871|693)\\.[a-f0-9]+\\.chunk\\.js$/);
      return match?(match[1]==='871'?'kaspa-loader':'kaspa-sdk'):undefined;
    }
    function loaded(event){const asset=assetOf(event.target);if(asset)emit('script-loaded',undefined,asset);}
    function failed(event){const asset=assetOf(event.target);emit(asset?'script-error':'page-error',asset?undefined:{operation:'observer',round:0},asset);}
    function rejected(){emit('page-rejection',{operation:'observer',round:0});}
    try{
      const bridge=window.$onekey && window.$onekey.jsBridge;
      if(window[key] || !bridge || Object.isFrozen(bridge) || !Object.isExtensible(bridge) ||
         typeof bridge.on!=='function' || typeof bridge.removeListener!=='function' || typeof bridge.sendPayload!=='function'){
        emit('observer-unavailable');return;
      }
      const descriptor=Object.getOwnPropertyDescriptor(bridge,'sendPayload');
      if(descriptor && (!Object.hasOwn(descriptor,'value') || !descriptor.writable)){emit('observer-unavailable');return;}
      const original=bridge.sendPayload;
      const wrapper=function(){
        let call,replyId;try{const payload=parse(arguments[0]);if(payload&&payload.type==='RESPONSE'){replyId=payload.id;call=calls.get(replyId);}}catch(_){}
        if(call)emit('reply-sending',call);
        let result;try{result=Reflect.apply(original,this,arguments);}catch(error){if(call)emit('reply-throw',call);throw error;}
        if(call){emit('reply-sent',call);calls.delete(replyId);}return result;
      };
      Object.defineProperty(bridge,'sendPayload',descriptor?{...descriptor,value:wrapper}:{value:wrapper,writable:true,configurable:true});
      cleanup.push(()=>{if(Object.getOwnPropertyDescriptor(bridge,'sendPayload')?.value===wrapper){
        if(descriptor)Object.defineProperty(bridge,'sendPayload',descriptor);else delete bridge.sendPayload;}});
      bridge.on('message',received);cleanup.push(()=>bridge.removeListener('message',received));
      document.addEventListener('load',loaded,true);cleanup.push(()=>document.removeEventListener('load',loaded,true));
      window.addEventListener('error',failed,true);cleanup.push(()=>window.removeEventListener('error',failed,true));
      window.addEventListener('unhandledrejection',rejected);cleanup.push(()=>window.removeEventListener('unhandledrejection',rejected));
      const observer=new MutationObserver(records=>{try{for(const record of records)for(const node of record.addedNodes){
        const asset=assetOf(node);if(asset)emit('script-discovered',undefined,asset);
      }}catch(_) {}});
      observer.observe(document.documentElement,{childList:true,subtree:true});cleanup.push(()=>observer.disconnect());
      Object.defineProperty(window,key,{value:controller,writable:false,configurable:true});
      emit('observer-installed');const timer=setTimeout(stop,60000);cleanup.push(()=>clearTimeout(timer));
    }catch(_){emit('observer-unavailable');stop();}
  })();true;`;
}

function installPageTrace(session: ITraceSession) {
  const snapshot = session.snapshot?.();
  const bridge = snapshot?.bridge;
  const view = getTraceView(bridge);
  const origin =
    snapshot?.platform === 'ios'
      ? 'onekey-web-embed://bundle'
      : 'https://appassets.androidplatform.net';
  if (
    !bridge ||
    bridge.remoteInfo?.origin !== origin ||
    !bridge.globalOnMessageEnabled ||
    Object.isFrozen(bridge) ||
    !Object.isExtensible(bridge) ||
    !view
  ) {
    emitBridgeTrace(session, undefined, 'observer-unavailable');
    return;
  }
  const own = Object.getOwnPropertyDescriptor(bridge, 'receive');
  if (own && (!Object.hasOwn(own, 'value') || !own.writable)) {
    emitBridgeTrace(session, undefined, 'observer-unavailable');
    return;
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- preserve the original method and apply the caller's receiver
  const original = bridge.receive;
  const wrapper: typeof original = function (this: typeof bridge, ...args) {
    try {
      const [payload, sender] = args;
      if (
        this === bridge &&
        session.active &&
        session.snapshot?.().bridge === bridge &&
        getTraceView(bridge) === view &&
        sender?.origin === origin &&
        typeof payload === 'string' &&
        payload.length < 1024 &&
        payload.includes(traceType)
      ) {
        const message = JSON.parse(payload) as Record<string, unknown>;
        const required = [
          'type',
          'runId',
          'stage',
          'operation',
          'round',
          'elapsedMs',
        ];
        if (
          required.every((key) => Object.hasOwn(message, key)) &&
          Object.keys(message).every(
            (key) => required.includes(key) || key === 'asset',
          ) &&
          message.type === traceType &&
          message.runId === session.runId &&
          typeof message.stage === 'string' &&
          tracePageStages.has(message.stage) &&
          (message.operation === 'observer' ||
            traceOperations.includes(message.operation as ITraceOperation)) &&
          ((message.operation === 'observer' && message.round === 0) ||
            Array.from(session.calls.values()).some(
              (call) =>
                call.operation === message.operation &&
                call.round === message.round,
            )) &&
          Number.isInteger(message.round) &&
          Number(message.round) >= 0 &&
          Number(message.round) <= 2 &&
          Number.isInteger(message.elapsedMs) &&
          Number(message.elapsedMs) >= 0 &&
          Number(message.elapsedMs) <= 60_000 &&
          (message.asset === undefined ||
            message.asset === 'kaspa-loader' ||
            message.asset === 'kaspa-sdk')
        ) {
          emitBridgeTrace(session, undefined, message.stage, {
            operation: message.operation as string,
            round: message.round as number,
            elapsedMs: message.elapsedMs as number,
            asset: message.asset as string | undefined,
          });
          return;
        }
      }
    } catch {
      // Unsupported diagnostic envelopes continue through the original bridge.
    }
    return Reflect.apply(original, this, args);
  };
  Object.defineProperty(
    bridge,
    'receive',
    own
      ? { ...own, value: wrapper }
      : { value: wrapper, configurable: true, writable: true },
  );
  session.bridge = bridge;
  session.view = view;
  session.disposeObserver = () => {
    if (Object.getOwnPropertyDescriptor(bridge, 'receive')?.value === wrapper) {
      if (own) Object.defineProperty(bridge, 'receive', own);
      else Reflect.deleteProperty(bridge, 'receive');
    }
    // Page cleanup also has its own bounded timer; never inject into a replaced view.
    if (
      session.snapshot?.().bridge === bridge &&
      getTraceView(bridge) === view
    ) {
      view.injectJavaScript(
        `;if(window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__?.runId===${JSON.stringify(session.runId)})window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__.stop();true;`,
      );
    }
  };
  view.injectJavaScript(createPageTraceScript(session.runId));
}

export function traceMobileLockdownWebEmbedBridge(options: {
  runtime: 'main' | 'background';
  callId: string;
  stage: ITraceStage;
  data?: unknown;
  result?: unknown;
  snapshot?: () => ITraceSnapshot;
}) {
  // Diagnostics must never change business return values, exceptions or timing
  // contracts. All failure paths here are observational and carry fixed text.
  try {
    const runId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
    if (
      __DEV__ ||
      !runId ||
      !/^[a-f0-9]{32}$/.test(runId) ||
      !process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER
    )
      return;
    const { runtime, callId, stage, data, result, snapshot } = options;
    let session = traceSessions.get(runtime);
    if (!session) {
      if (
        !equalPublicFixture(data, {
          module: 'test',
          method: 'test1',
          params: [runId],
        })
      )
        return;
      session = {
        runId,
        runtime,
        startedAt: Date.now(),
        index: 0,
        count: 0,
        active: true,
        calls: new Map(),
        snapshot,
      };
      traceSessions.set(runtime, session);
      const current = session;
      setTimeout(() => {
        try {
          current.disposeObserver?.();
        } catch {
          // A disposed native view cannot change application error handling.
        } finally {
          current.active = false;
          current.calls.clear();
          current.commit = undefined;
          current.reveal = undefined;
          current.bridge = undefined;
          current.view = undefined;
          current.snapshot = undefined;
          current.disposeObserver = undefined;
        }
      }, 60_000);
    }
    if (!session.active || session.runId !== runId) return;
    if (stage === 'bridge-change') {
      emitBridgeTrace(session, undefined, stage);
      return;
    }
    if (!/^[1-9]\d{0,8}$/.test(callId)) return;
    let call = session.calls.get(callId);
    if ((stage === 'sending' || stage === 'received') && !call) {
      const operation = traceOperations[session.index];
      if (
        !operation ||
        !equalPublicFixture(data, expectedTraceRequest(session, operation))
      )
        return;
      call = {
        operation,
        round: Math.max(0, Math.floor((session.index - 2) / 3) + 1),
        startedAt: Date.now(),
      };
      session.index += 1;
      session.calls.set(callId, call);
      if (runtime === 'main') {
        if (session.index === 1) installPageTrace(session);
        if (
          session.bridge &&
          session.snapshot?.().bridge === session.bridge &&
          getTraceView(session.bridge) === session.view
        ) {
          // Only the fully matched public request reaches the passive observer.
          session.view?.injectJavaScript(
            `;if(window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__?.runId===${JSON.stringify(runId)})window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__.expect(${JSON.stringify(data)},${JSON.stringify(operation)},${call.round});true;`,
          );
        }
      }
    }
    if (!call) return;
    emitBridgeTrace(session, call, stage);
    if (stage === 'request-returned' || stage === 'response-received') {
      if (call.operation === 'commit')
        session.commit = readPublicKaspaCommit(result);
      if (
        call.operation === 'reveal' &&
        typeof result === 'string' &&
        session.commit
      ) {
        readPublicKaspaReveal(result, session.commit.commitScriptPubKey);
        session.reveal = result;
      }
    }
  } catch {
    // The underlying SharedRPC/JsBridge operation continues unchanged.
  }
}
