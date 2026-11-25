package so.onekey.app.wallet.text;

import android.text.Layout;

public final class TextDecorationBounds {
    private TextDecorationBounds() {}

    // A continued span starts or ends at the logical boundary, which is reversed in RTL.
    public static float start(Layout layout, int line) {
        return layout.getParagraphDirection(line) == Layout.DIR_RIGHT_TO_LEFT
                ? layout.getLineRight(line) : layout.getLineLeft(line);
    }

    public static float end(Layout layout, int line) {
        return layout.getParagraphDirection(line) == Layout.DIR_RIGHT_TO_LEFT
                ? layout.getLineLeft(line) : layout.getLineRight(line);
    }
}
