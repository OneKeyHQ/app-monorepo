import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const LEGACY_OVERLAY_PROPS = [
  'nativeSheet',
  'sheetOverlayProps',
  'isOverTopAllViews',
  'modal',
  'forceMount',
] as const;

const SHEET_OPTIONS = new Set([
  'snapPointsMode',
  'snapPoints',
  'disableDrag',
  'dismissOnSnapToBottom',
  'dismissOnOverlayPress',
  'onAnimationComplete',
]);

/** Reject removed JS overlay options, including callers using object spreads. */
export function assertOverlayProps(component: string, props: object): void {
  const options = props as Record<string, unknown>;
  const reject = (name: string) => {
    throw new OneKeyLocalError(
      `${component}: ${name} is no longer supported by native overlays. Use overlay levels and supported sheet options.`,
    );
  };
  for (const name of LEGACY_OVERLAY_PROPS) {
    if (options[name] !== undefined) {
      reject(name);
    }
  }
  const { sheetProps, floatingPanelProps } = options;
  if (sheetProps && typeof sheetProps === 'object') {
    for (const [name, value] of Object.entries(sheetProps)) {
      if (value !== undefined && !SHEET_OPTIONS.has(name)) {
        reject(`sheetProps.${name}`);
      }
    }
  }
  if (floatingPanelProps && typeof floatingPanelProps === 'object') {
    const panel = floatingPanelProps as Record<string, unknown>;
    for (const name of ['zIndex', 'portalProps']) {
      if (panel[name] !== undefined) {
        reject(`floatingPanelProps.${name}`);
      }
    }
  }
}
