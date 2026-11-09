/**
 * @jest-environment jsdom
 */
import { createRef } from 'react';

import { act, render } from '@testing-library/react';

import { LottieView } from './index.web';

import type { ILottieViewHandle } from './type';

const source = {};

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  goToAndStop: jest.fn(),
};

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: unknown) => [props, {}],
}));

// The test attaches the player itself to control when it becomes available.
let mockLottieRef: { current: unknown } | undefined;

jest.mock('lottie-react', () => ({
  __esModule: true,
  default: ({ lottieRef }: { lottieRef: { current: unknown } }) => {
    mockLottieRef = lottieRef;
    return null;
  },
}));

async function renderWithoutPlayer() {
  const ref = createRef<ILottieViewHandle>();
  render(<LottieView ref={ref} source={source} loop={false} />);
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  return ref;
}

function attachPlayer() {
  expect(mockLottieRef).toBeDefined();
  if (mockLottieRef) {
    mockLottieRef.current = mockPlayer;
  }
}

describe('LottieView web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('plays once the player attaches after play was requested', async () => {
    const ref = await renderWithoutPlayer();

    ref.current?.play();
    expect(mockPlayer.play).not.toHaveBeenCalled();

    attachPlayer();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    // lottie-react reassigns the ref when it re-renders.
    attachPlayer();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test('pause cancels a play request made before the player attaches', async () => {
    const ref = await renderWithoutPlayer();

    ref.current?.play();
    ref.current?.pause();

    attachPlayer();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  test('reset cancels a play request made before the player attaches', async () => {
    const ref = await renderWithoutPlayer();

    ref.current?.play();
    ref.current?.reset();

    attachPlayer();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  test('plays immediately when the player is already attached', async () => {
    const ref = await renderWithoutPlayer();
    attachPlayer();

    ref.current?.play();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });
});
