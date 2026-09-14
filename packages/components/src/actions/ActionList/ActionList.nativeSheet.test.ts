import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ActionList NativeSheet presentation', () => {
  const actionListSource = readFileSync(
    join(__dirname, 'index.native.tsx'),
    'utf8',
  );
  const asyncLifecycleSource = readFileSync(
    join(__dirname, 'useAsyncItemsLifecycle.native.ts'),
    'utf8',
  );
  const popoverSource = readFileSync(
    join(__dirname, '../Popover/index.native.tsx'),
    'utf8',
  );
  const nativeSheetPresentationSource = readFileSync(
    join(__dirname, '../../hocs/NativeSheetPresentation/index.native.tsx'),
    'utf8',
  );

  it('measures resolved async items before opening the native presentation', () => {
    expect(actionListSource).toContain(
      'isOpen && (!renderItemsAsync || Boolean(asyncItems))',
    );
    expect(asyncLifecycleSource).toContain('commitPendingAsyncItems();');
  });

  it('keeps NativeSheet opt-in and preserves the JS sheet fallback', () => {
    expect(popoverSource).toContain('nativeSheet = false');
    expect(popoverSource).toContain('usingSheet && nativeSheet ?');
    expect(popoverSource).toContain('usingSheet && !nativeSheet ?');
    expect(popoverSource).toContain('<TMPopover.Sheet');
  });

  it('keeps tall content scrollable inside the locked sheet height', () => {
    expect(popoverSource).toMatch(
      /<ScrollView\s+[^>]*nestedScrollEnabled\s+[^>]*flexShrink=\{1\}\s+[^>]*minHeight=\{0\}/s,
    );
  });

  it('locks fit height from the full scroll content before presenting', () => {
    expect(popoverSource).toContain(
      'onContentSizeChange={handleSheetContentSizeChange}',
    );
    expect(popoverSource).toContain('open={nativeSheetOpen}');
    expect(popoverSource).toContain('height={nativeFitSheetHeight}');
    expect(popoverSource).toContain(
      'Math.min(sheetScrollContentHeight, sheetScrollViewMaxHeight)',
    );
    expect(popoverSource).toContain(
      'nativeSheetBottomSpacing - nativeSheetSystemBottomInset',
    );
    expect(popoverSource).toContain('maxHeight={nativeSheetDetentMaxHeight}');
    expect(popoverSource).toContain('getStableContentHeightForGeneration(');
    expect(popoverSource).toContain(
      'previousRenderContentRef.current !== renderContent',
    );
  });

  it('derives backdrop opacity from the resolved theme token', () => {
    expect(nativeSheetPresentationSource).toContain('useTheme()');
    expect(nativeSheetPresentationSource).toContain('theme.bgBackdrop.val');
    expect(popoverSource).not.toContain('dimAmount={');
    expect(popoverSource).toContain('backgroundColor="transparent"');
  });

  it('does not retain a pooled press event in the debounced item callback', () => {
    expect(actionListSource).not.toContain(
      'async (event: GestureResponderEvent)',
    );
    expect(actionListSource).not.toContain('event.stopPropagation();');
  });

  it('keeps the skeleton row at the same height as a resolved action row', () => {
    expect(actionListSource).toMatch(
      /function ActionListSkeletonItem\(\)[\s\S]*?height="\$11"/,
    );
  });
});
