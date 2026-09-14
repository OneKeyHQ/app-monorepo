import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Dialog NativeSheet animation diagnostics', () => {
  const contentSource = readFileSync(
    join(__dirname, 'Content.native.tsx'),
    'utf8',
  );
  const dialogSource = readFileSync(join(__dirname, 'index.tsx'), 'utf8');
  const footerSource = readFileSync(join(__dirname, 'Footer.tsx'), 'utf8');
  const nativeSheetPresentationSource = readFileSync(
    join(__dirname, '../../hocs/NativeSheetPresentation/index.native.tsx'),
    'utf8',
  );

  it('does not apply the JS position-duration warning to native presentation', () => {
    expect(contentSource).toContain(
      'platformEnv.isDev && !nativeSheetPresentation',
    );
  });

  it('requires an explicit NativeSheet opt-in', () => {
    expect(dialogSource).toContain('nativeSheet = false');
    expect(dialogSource).toContain(
      'nativeSheet && media.md && NATIVE_SHEET_PRESENTATION_SUPPORTED',
    );
  });

  it('keeps the original full-width dialog body and grabber', () => {
    const nativePresentation = dialogSource.slice(
      dialogSource.indexOf('if (useNativeSheetPresentation)'),
      dialogSource.indexOf('if (media.md)'),
    );

    expect(nativePresentation).toContain('showHandle={false}');
    expect(dialogSource).toContain('<SheetGrabber />');
    expect(nativePresentation).not.toContain('mx="$5"');
    expect(nativePresentation).not.toContain('backgroundColor="transparent"');
  });

  it('leaves arbitrary Dialog content in NativeSheet auto-height mode', () => {
    const nativePresentation = dialogSource.slice(
      dialogSource.indexOf('if (useNativeSheetPresentation)'),
      dialogSource.indexOf('if (media.md)'),
    );

    expect(nativePresentation).toContain('<NativeSheetPresentation');
    expect(nativePresentation).not.toMatch(/\bheight=/);
    expect(nativeSheetPresentationSource).toContain('<NativeSheet');
    expect(nativeSheetPresentationSource).toContain('{...props}');
  });

  it('applies footer design spacing and platform safe area exactly once', () => {
    expect(footerSource).toContain('<XStack p="$5" pt="$0"');
    expect(dialogSource).toContain(
      'useNativeSheetPresentation ? undefined : safeKeyboardAnimationStyle',
    );
  });

  it('uses the resolved backdrop token instead of the theme name', () => {
    expect(dialogSource).not.toContain('useThemeName');
    expect(dialogSource).not.toContain('dimAmount={');
    expect(nativeSheetPresentationSource).toContain('theme.bgBackdrop.val');
    expect(nativeSheetPresentationSource).toContain('theme.bg.val');
  });
});
