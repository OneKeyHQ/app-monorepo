export const MODIFIER_HINT_HOLD_MS = 1000;

export function isEditableFocused(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (activeElement instanceof HTMLElement) {
    if (activeElement.isContentEditable) {
      return true;
    }
    if (activeElement.closest('[contenteditable="true"]')) {
      return true;
    }
  }

  return false;
}

export function isPrimaryModifierKeyEvent(
  event: KeyboardEvent,
  isAppleDesktop: boolean,
): boolean {
  return isAppleDesktop ? event.key === 'Meta' : event.key === 'Control';
}

export function isPrimaryModifierHeld(
  event: KeyboardEvent,
  isAppleDesktop: boolean,
): boolean {
  return isAppleDesktop ? event.metaKey : event.ctrlKey;
}

export function shouldCancelModifierHintReveal(
  event: KeyboardEvent,
  isAppleDesktop: boolean,
): boolean {
  if (isPrimaryModifierKeyEvent(event, isAppleDesktop)) {
    return false;
  }
  return isPrimaryModifierHeld(event, isAppleDesktop);
}
