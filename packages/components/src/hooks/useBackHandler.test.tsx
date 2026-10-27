/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { claimEscapePress, useBackHandler } from './useBackHandler';

// A press on an element in the page: down then up, bubbling to the window
const pressEscape = (target: EventTarget = globalThis.document.body) => {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    target.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
    );
  });
};

const openDialog = () => {
  let isDialogOpen = true;
  return jest.fn(() => {
    if (!isDialogOpen) {
      return false;
    }
    isDialogOpen = false;
    return true;
  });
};

// A dialog listens on keydown, the web modal under it on keyup: one press
// must close only the dialog
describe('useBackHandler on web', () => {
  beforeAll(() => {
    // jest-setup stubs the window's addEventListener. Put back a working one
    // that, like the app's preload (apps/ext/src/assets/preload-html-head.js),
    // takes no options, so a capture flag is dropped
    const addListener = EventTarget.prototype.addEventListener.bind(globalThis);
    globalThis.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => addListener(type, listener)) as typeof globalThis.addEventListener;
  });

  it('leaves a press a dialog claimed to the dialog alone', () => {
    const closeDialog = openDialog();
    const closeModal = jest.fn(() => true);
    renderHook(() => useBackHandler(closeDialog, true, true, true));
    renderHook(() => useBackHandler(closeModal, true, false));

    pressEscape();
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeModal).not.toHaveBeenCalled();

    pressEscape();
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('closes the modal from a text input once the dialog above it closed', () => {
    const closeDialog = openDialog();
    const closeModal = jest.fn(() => true);
    renderHook(() => useBackHandler(closeDialog, true, true, true));
    renderHook(() => useBackHandler(closeModal, true, false));

    pressEscape();
    expect(closeModal).not.toHaveBeenCalled();

    // react-native-web's TextInput stops its keydown before the window
    const input = globalThis.document.createElement('input');
    input.addEventListener('keydown', (event) => event.stopPropagation());
    globalThis.document.body.appendChild(input);
    pressEscape(input);
    expect(closeModal).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('passes the press on when the keydown handler does not claim it', () => {
    const keyDownHandler = jest.fn(() => true);
    const closeModal = jest.fn(() => true);
    renderHook(() => useBackHandler(keyDownHandler));
    renderHook(() => useBackHandler(closeModal, true, false));

    pressEscape();
    expect(keyDownHandler).toHaveBeenCalledTimes(1);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('leaves a press a text field claimed to the field alone', () => {
    const closeList = jest.fn();
    const closeModal = jest.fn(() => true);
    renderHook(() => useBackHandler(closeModal, true, false));

    // A popover's search field answers the press itself
    const input = globalThis.document.createElement('input');
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      claimEscapePress();
      closeList();
    });
    globalThis.document.body.appendChild(input);
    pressEscape(input);
    expect(closeList).toHaveBeenCalledTimes(1);
    expect(closeModal).not.toHaveBeenCalled();
    input.remove();

    pressEscape();
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const closeModal = jest.fn(() => true);
    renderHook(() => useBackHandler(closeModal, true, false));
    act(() => {
      globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    });
    expect(closeModal).not.toHaveBeenCalled();
  });
});
