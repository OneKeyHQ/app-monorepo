import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

type IJotaiStateBroadcast = Pick<
  IGlobalStatesSyncBroadcastParams,
  'name' | 'payload'
>;

type IJotaiHydrationState = 'buffering' | 'ready' | 'waitingForRetry';

let hydrationState: IJotaiHydrationState = 'buffering';
let hydrationGeneration = 0;
let pendingBroadcasts: IJotaiStateBroadcast[] = [];

function applyJotaiStateBroadcast({
  name,
  payload,
}: IJotaiStateBroadcast): Promise<void> {
  return jotaiUpdateFromUiByBgBroadcast({
    $$isFromBgStatesSyncBroadcast: true,
    name,
    payload,
  });
}

/**
 * Keeps bg broadcasts newer than the startup snapshot from being overwritten
 * while native main hydrates its isolated Jotai store.
 */
export function applyOrQueueJotaiStateBroadcast(
  broadcast: IJotaiStateBroadcast,
) {
  if (hydrationState === 'buffering') {
    pendingBroadcasts.push(broadcast);
    return;
  }
  if (hydrationState === 'waitingForRetry') {
    // Bg remains canonical; the retry snapshot includes changes made while the
    // startup error surface is visible, so no unbounded queue is needed here.
    return;
  }
  void applyJotaiStateBroadcast(broadcast);
}

export async function runJotaiMainHydration(
  initializeFromBackground: () => Promise<void>,
) {
  const generation = (hydrationGeneration += 1);
  hydrationState = 'buffering';
  // Bg commits an atom before broadcasting it. The new snapshot therefore
  // covers every broadcast received before this hydration attempt starts.
  pendingBroadcasts = [];

  try {
    await initializeFromBackground();

    // Keep buffering while replay awaits each update. Broadcasts received
    // during an await are appended and drained by the next loop iteration.
    while (pendingBroadcasts.length > 0) {
      if (generation !== hydrationGeneration) {
        return;
      }
      const broadcasts = pendingBroadcasts.splice(0);
      for (const broadcast of broadcasts) {
        if (generation !== hydrationGeneration) {
          return;
        }
        await applyJotaiStateBroadcast(broadcast);
      }
    }

    if (generation === hydrationGeneration) {
      hydrationState = 'ready';
    }
  } catch (error) {
    if (generation === hydrationGeneration) {
      pendingBroadcasts = [];
      hydrationState = 'waitingForRetry';
    }
    throw error;
  }
}
