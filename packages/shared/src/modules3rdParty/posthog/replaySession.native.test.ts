import { OneKeyLocalError } from '../../errors';
import { EAppSyncStorageKeys } from '../../storage/syncStorageKeys';

const mockStore = new Map<string, unknown>();
const mockSetObject = jest.fn((key: string, value: unknown) => {
  mockStore.set(key, JSON.parse(JSON.stringify(value)));
});

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: (key: string) => mockStore.get(key),
      setObject: (key: string, value: unknown) => mockSetObject(key, value),
    },
  },
}));

type ISessionModule = typeof import('./replaySession.native');

const KEY = EAppSyncStorageKeys.onekey_replay_session_v1;
const T0 = 1_760_000_000_000;
const MINUTE = 60 * 1000;

function loadModule(): ISessionModule {
  let loaded: ISessionModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('./replaySession.native') as ISessionModule;
  });
  return loaded as ISessionModule;
}

describe('replaySession.native', () => {
  beforeEach(() => {
    mockStore.clear();
    mockSetObject.mockClear();
  });

  it('generates lowercase UUIDv7 ids carrying the timestamp', () => {
    const session = loadModule();
    const id = session.generateReplaySessionId(T0);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(session.getReplaySessionStartMs(id)).toBe(T0);
    expect(session.generateReplaySessionId(T0)).not.toBe(id);
  });

  it('rejects non-v7 ids as session starts', () => {
    const session = loadModule();
    expect(
      session.getReplaySessionStartMs('01890a5d-ac96-474b-bcce-0000deadbeef'),
    ).toBeUndefined();
    expect(session.getReplaySessionStartMs('garbage')).toBeUndefined();
  });

  it('creates and persists a session on first use', () => {
    const session = loadModule();
    const { sessionId, previousSessionId } = session.touchReplaySession(T0);
    expect(previousSessionId).toBeUndefined();
    expect(session.getReplaySessionId()).toBe(sessionId);
    expect(mockStore.get(KEY)).toEqual({ sid: sessionId, at: T0 });
  });

  it('resumes the persisted session on a cold start inside the idle window', () => {
    const first = loadModule();
    const { sessionId } = first.touchReplaySession(T0);
    first.markReplaySessionBackground(T0 + 5 * MINUTE);
    mockSetObject.mockClear();

    const second = loadModule();
    expect(second.touchReplaySession(T0 + 20 * MINUTE).sessionId).toBe(
      sessionId,
    );
    expect(mockSetObject).not.toHaveBeenCalled();
  });

  it('rotates on a cold start after 30 minutes away', () => {
    const first = loadModule();
    const { sessionId } = first.touchReplaySession(T0);
    first.markReplaySessionBackground(T0 + MINUTE);

    const second = loadModule();
    const next = second.touchReplaySession(T0 + 31 * MINUTE);
    expect(next.sessionId).not.toBe(sessionId);
    expect(mockStore.get(KEY)).toEqual({
      sid: next.sessionId,
      at: T0 + 31 * MINUTE,
    });
  });

  it('rotates on a cold start when the clock went backwards', () => {
    const first = loadModule();
    const { sessionId } = first.touchReplaySession(T0);
    first.markReplaySessionBackground(T0 + MINUTE);

    const second = loadModule();
    expect(second.touchReplaySession(T0 - MINUTE).sessionId).not.toBe(
      sessionId,
    );
  });

  it('ignores malformed stored records', () => {
    mockStore.set(KEY, { sid: 'not-a-uuid', at: T0 });
    const session = loadModule();
    expect(session.touchReplaySession(T0).sessionId).not.toBe('not-a-uuid');

    mockStore.set(KEY, { sid: 42 });
    const other = loadModule();
    expect(other.touchReplaySession(T0).sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never counts foreground time as idle', () => {
    const session = loadModule();
    const { sessionId } = session.touchReplaySession(T0);
    const later = session.touchReplaySession(T0 + 3 * 60 * MINUTE);
    expect(later).toEqual({ sessionId, previousSessionId: sessionId });
  });

  it('rotates after 30 minutes in the background', () => {
    const session = loadModule();
    const { sessionId } = session.touchReplaySession(T0);

    session.markReplaySessionBackground(T0 + MINUTE);
    expect(mockStore.get(KEY)).toEqual({ sid: sessionId, at: T0 + MINUTE });
    session.markReplaySessionForeground();
    expect(session.touchReplaySession(T0 + 20 * MINUTE).sessionId).toBe(
      sessionId,
    );

    session.markReplaySessionBackground(T0 + 21 * MINUTE);
    session.markReplaySessionForeground();
    const rotated = session.touchReplaySession(T0 + 52 * MINUTE);
    expect(rotated.previousSessionId).toBe(sessionId);
    expect(rotated.sessionId).not.toBe(sessionId);
  });

  it('keeps measuring idle time across touches made while in the background', () => {
    const session = loadModule();
    const { sessionId } = session.touchReplaySession(T0);
    session.markReplaySessionBackground(T0 + MINUTE);
    expect(session.touchReplaySession(T0 + 10 * MINUTE).sessionId).toBe(
      sessionId,
    );
    session.markReplaySessionForeground();
    expect(session.touchReplaySession(T0 + 40 * MINUTE).sessionId).not.toBe(
      sessionId,
    );
  });

  it('rotates once the session is older than 24 hours', () => {
    const session = loadModule();
    const { sessionId } = session.touchReplaySession(T0);
    expect(
      session.touchReplaySession(T0 + 24 * 60 * MINUTE - 1).sessionId,
    ).toBe(sessionId);
    expect(
      session.touchReplaySession(T0 + 24 * 60 * MINUTE).sessionId,
    ).not.toBe(sessionId);
  });

  it('survives storage failures', () => {
    mockSetObject.mockImplementationOnce(() => {
      throw new OneKeyLocalError('resetting');
    });
    const session = loadModule();
    expect(() => session.touchReplaySession(T0)).not.toThrow();
    expect(session.getReplaySessionId()).toBeDefined();
  });
});
