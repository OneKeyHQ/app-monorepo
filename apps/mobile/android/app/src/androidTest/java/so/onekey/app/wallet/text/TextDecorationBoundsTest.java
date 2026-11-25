package so.onekey.app.wallet.text;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import org.junit.Test;

public class TextDecorationBoundsTest {
    @Test
    public void partialLtrRunOnWrappedRtlLine() {
        TextPaint paint = textPaint();
        String text = "שלום USDT";
        int latinStart = text.indexOf("USDT");
        int width = (int) Math.ceil(Math.max(paint.measureText("שלום"), paint.measureText("USDT"))) + 4;
        Layout layout = layout(text, paint, width);

        assertEquals(2, layout.getLineCount());
        assertEquals(latinStart, layout.getLineStart(1));
        assertEquals(Layout.DIR_RIGHT_TO_LEFT, layout.getParagraphDirection(1));
        assertFalse(layout.isRtlCharAt(latinStart));

        float left = layout.getLineLeft(1);
        assertArrayEquals(
                new float[] {left, left + paint.measureText("US")},
                TextDecorationBounds.forLine(layout, 1, latinStart + 2, 1),
                0.5f);
        assertArrayEquals(
                new float[] {left, layout.getLineRight(1)},
                TextDecorationBounds.forLine(layout, 0, text.length(), 1),
                0f);
    }

    @Test
    public void partialSpanKeepsDisjointBidiRunsApart() {
        String text = "abc אבג DEF";
        Layout layout = layout(text, textPaint(), 400);
        float[] intervals = TextDecorationBounds.forLine(layout, 0, text.indexOf('א') + 1, 0);

        assertEquals(4, intervals.length);
        assertEquals(layout.getLineLeft(0), intervals[0], 0.5f);
        assertTrue(intervals[0] < intervals[1]);
        assertTrue(intervals[1] < intervals[2]);
        assertTrue(intervals[2] < intervals[3]);
        assertTrue(intervals[3] < layout.getLineRight(0));
    }

    private static TextPaint textPaint() {
        TextPaint paint = new TextPaint();
        paint.setTextSize(42);
        return paint;
    }

    private static Layout layout(String text, TextPaint paint, int width) {
        return StaticLayout.Builder.obtain(text, 0, text.length(), paint, width)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setIncludePad(false)
                .build();
    }
}
