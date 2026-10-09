import { assertOverlayProps } from './assertOverlayProps';

describe('native overlay migration contract', () => {
  it.each([
    ['nativeSheet', true],
    ['nativeSheet', false],
    ['sheetOverlayProps', {}],
    ['isOverTopAllViews', true],
    ['modal', false],
    ['forceMount', true],
  ])('rejects removed %s options supplied through spreads', (name, value) => {
    expect(() => assertOverlayProps('Popover', { [name]: value })).toThrow(
      `${name} is no longer supported`,
    );
  });

  it.each(['zIndex', 'portalProps', 'transition', 'animation', 'modal'])(
    'rejects legacy sheetProps.%s instead of silently ignoring it',
    (name) => {
      expect(() =>
        assertOverlayProps('Dialog.show', { sheetProps: { [name]: 1 } }),
      ).toThrow(`sheetProps.${name} is no longer supported`);
    },
  );

  it.each(['zIndex', 'portalProps'])(
    'rejects floating panel %s layering',
    (name) => {
      expect(() =>
        assertOverlayProps('Select', { floatingPanelProps: { [name]: 1 } }),
      ).toThrow(`floatingPanelProps.${name} is no longer supported`);
    },
  );

  it('accepts supported overlay options and undefined optional legacy fields', () => {
    expect(() =>
      assertOverlayProps('ActionList', {
        nativeSheet: undefined,
        overlayLevel: 'secure',
        sheetProps: {
          snapPointsMode: 'percent',
          snapPoints: [80],
          disableDrag: true,
          dismissOnSnapToBottom: false,
          dismissOnOverlayPress: true,
          onAnimationComplete: () => undefined,
        },
        floatingPanelProps: { width: 400, maxHeight: 500 },
      }),
    ).not.toThrow();
  });
});
