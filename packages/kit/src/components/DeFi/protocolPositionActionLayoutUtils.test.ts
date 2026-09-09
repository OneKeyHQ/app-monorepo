import { resolveProtocolPositionActionDialogLayout } from './protocolPositionActionLayoutUtils';

describe('protocolPositionActionLayoutUtils', () => {
  it('uses taller bounded scroll regions on regular-width dialogs', () => {
    const compactLayout = resolveProtocolPositionActionDialogLayout({
      gtMd: false,
    });
    const regularLayout = resolveProtocolPositionActionDialogLayout({
      gtMd: true,
    });

    expect(regularLayout.bodyMaxHeight).toBeGreaterThan(
      compactLayout.bodyMaxHeight,
    );
    expect(regularLayout.feedbackMaxHeight).toBeGreaterThan(
      compactLayout.feedbackMaxHeight,
    );
  });

  it('keeps feedback bounded below the editable action body', () => {
    const compactLayout = resolveProtocolPositionActionDialogLayout({
      gtMd: false,
    });
    const regularLayout = resolveProtocolPositionActionDialogLayout({
      gtMd: true,
    });

    expect(compactLayout.feedbackMaxHeight).toBeLessThan(
      compactLayout.bodyMaxHeight,
    );
    expect(regularLayout.feedbackMaxHeight).toBeLessThan(
      regularLayout.bodyMaxHeight,
    );
    expect(compactLayout.feedbackMaxHeight).toBeGreaterThanOrEqual(128);
  });
});
