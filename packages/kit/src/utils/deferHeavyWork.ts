import platformEnv from '@onekeyhq/shared/src/platformEnv';

function nextFrame() {
  // eslint-disable-next-line no-restricted-globals
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined;
  if (raf) {
    return new Promise<void>((resolve) => {
      raf(() => resolve());
    });
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function nextFrames(frames: number) {
  const count = Math.max(0, frames);
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await nextFrame();
  }
}

function runAfterInteractions(): Promise<void> {
  if (!platformEnv.isNative) {
    return Promise.resolve();
  }
  try {
    // Avoid static import to keep web/extension bundles safer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { InteractionManager } = require('react-native') as {
      InteractionManager?: {
        runAfterInteractions: (fn: () => void) => { cancel?: () => void };
      };
    };
    if (!InteractionManager?.runAfterInteractions) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
  } catch {
    return Promise.resolve();
  }
}

export async function deferHeavyWorkUntilUIIdle({
  minFrames = 2,
  includeInteractions = true,
}: {
  minFrames?: number;
  includeInteractions?: boolean;
} = {}) {
  // Ensure at least one/two frames get a chance to paint before heavy work.
  await nextFrames(minFrames);
  if (includeInteractions) {
    await runAfterInteractions();
  }
  // One more frame to let post-interaction layout flush.
  await nextFrames(1);
}

