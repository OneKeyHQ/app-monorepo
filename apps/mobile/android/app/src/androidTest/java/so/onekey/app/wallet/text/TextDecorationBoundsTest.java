package so.onekey.app.wallet.text;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.facebook.react.views.text.TextDecorationStyle;
import com.facebook.react.views.text.TextDecorationStyleKt;

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

    @Test
    public void touchingBidiRunsShareOneDashPattern() {
        String text = "abc אבג DEF";
        Layout layout = layout(text, textPaint(), 400);
        int end = text.indexOf('D') + 1;

        assertArrayEquals(
                new float[] {layout.getPrimaryHorizontal(1), layout.getPrimaryHorizontal(end)},
                TextDecorationBounds.forLine(layout, 1, end, 0),
                0.5f);
    }

    @Test
    public void wavyDecorationLeavesTheGapUndecorated() {
        String text = "abc אבג DEF";
        TextPaint paint = textPaint();
        int end = text.indexOf('א') + 1;
        for (float density : new float[] {1f, 1.5f, 2f, 3f}) {
            paint.density = density;
            Layout layout = layout(text, paint, 400);
            float[] intervals = TextDecorationBounds.forLine(layout, 0, end, 0);
            assertEquals(4, intervals.length);

            Bitmap bitmap = Bitmap.createBitmap(
                    layout.getWidth(), layout.getHeight() + 16, Bitmap.Config.ARGB_8888);
            TextDecorationStyleKt.drawSpannedDecoration(
                    0, end, new Canvas(bitmap), layout, Color.RED, TextDecorationStyle.WAVY,
                    (stroke, baseline, thickness) -> baseline + 4f);

            assertTrue(hasPaint(bitmap, (int) Math.ceil(intervals[0]), (int) intervals[1]));
            assertTrue(hasPaint(bitmap, (int) Math.ceil(intervals[2]), (int) intervals[3]));
            assertFalse(hasPaint(bitmap, (int) Math.ceil(intervals[1]), (int) intervals[2]));
        }
    }

    private static boolean hasPaint(Bitmap bitmap, int from, int to) {
        for (int x = from; x < to; x++) {
            for (int y = 0; y < bitmap.getHeight(); y++) {
                if (Color.alpha(bitmap.getPixel(x, y)) != 0) {
                    return true;
                }
            }
        }
        return false;
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
