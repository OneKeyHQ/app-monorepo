/** @jest-environment jsdom */
import path from 'path';

import type { overlayStore as OverlayStore } from '@onekeyfe/react-native-native-overlay';

type IObserveVisibleContent = (options: {
  entryId: string;
  element: HTMLElement;
  contentRoot: HTMLElement;
  isAnimating: () => boolean;
  onVisible: () => void;
}) => () => void;

const packageDir = path.dirname(
  require.resolve('@onekeyfe/react-native-native-overlay/package.json'),
);
const animationFrameApi: {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
} = globalThis;

// Exercise both Metro source and the published JS consumed by Web/Desktop.
describe.each([
  ['src', 'ts'],
  ['lib/module', 'js'],
])('overlay visibility (%s)', (directory, extension) => {
  const { overlayStore } = jest.requireActual<{
    overlayStore: typeof OverlayStore;
  }>(path.join(packageDir, directory, `OverlayStore.${extension}`));
  const { observeVisibleContent } = jest.requireActual<{
    observeVisibleContent: IObserveVisibleContent;
  }>(
    path.join(packageDir, directory, `web/observeVisibleContent.${extension}`),
  );
  let element: HTMLDivElement;
  let content: HTMLDivElement;
  let top: number;
  let frameId: number;
  let animating: boolean;
  let stop: () => void;
  let onVisible: jest.Mock;
  const frames = new Map<number, FrameRequestCallback>();
  const entryId = 'visibility-test';

  beforeEach(() => {
    top = globalThis.innerHeight;
    frameId = 0;
    animating = true;
    onVisible = jest.fn();
    frames.clear();
    jest
      .spyOn(animationFrameApi, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frameId += 1;
        frames.set(frameId, callback);
        return frameId;
      });
    jest
      .spyOn(animationFrameApi, 'cancelAnimationFrame')
      .mockImplementation((id) => {
        frames.delete(id);
      });
    element = document.createElement('div');
    content = document.createElement('div');
    element.append(content);
    document.body.append(element);
    jest.spyOn(content, 'getBoundingClientRect').mockImplementation(() => ({
      top,
      bottom: top + 200,
      left: 0,
      right: 300,
      x: 0,
      y: top,
      width: 300,
      height: 200,
      toJSON: () => ({}),
    }));
    overlayStore.request({
      id: entryId,
      scope: 'page',
      hostKey: 'visibility-host',
      ownerKey: 'visibility-page',
      level: 'modal',
    });
    stop = observeVisibleContent({
      entryId,
      element,
      contentRoot: element,
      isAnimating: () => animating,
      onVisible,
    });
  });

  afterEach(() => {
    stop();
    overlayStore.dismiss(entryId, 'programmatic');
    overlayStore.finalize(entryId);
    overlayStore.setPageVisible('visibility-page', true);
    element.remove();
    jest.restoreAllMocks();
  });

  function nextFrame() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  }

  it('waits for the first on-screen frame, without waiting for entrance completion', () => {
    nextFrame();
    expect(onVisible).not.toHaveBeenCalled();
    top -= 1;
    nextFrame();
    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(animating).toBe(true);
    stop();
    nextFrame();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('does not count a sheet closed before entering the viewport', () => {
    nextFrame();
    overlayStore.dismiss(entryId, 'programmatic');
    top = 100;
    nextFrame();
    expect(onVisible).not.toHaveBeenCalled();
  });

  it('cancels pending frames on unmount', () => {
    stop();
    top = 100;
    nextFrame();
    expect(frames.size).toBe(0);
    expect(onVisible).not.toHaveBeenCalled();
  });

  it('waits for a transparent card to start fading in', () => {
    top = 100;
    element.style.opacity = '0';
    nextFrame();
    expect(onVisible).not.toHaveBeenCalled();
    element.style.opacity = '0.1';
    nextFrame();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('pauses while the owning page is hidden and resumes after it becomes visible', () => {
    overlayStore.setPageVisible('visibility-page', false);
    top = 100;
    nextFrame();
    expect(onVisible).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    animating = false;
    overlayStore.setPageVisible('visibility-page', true);
    nextFrame();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('does not count content hidden by an ancestor', () => {
    top = 100;
    element.style.visibility = 'hidden';
    nextFrame();
    expect(onVisible).not.toHaveBeenCalled();
    element.style.visibility = 'visible';
    nextFrame();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });
});
