package so.onekey.app.wallet.text;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.facebook.react.views.text.TextDecorationStyle;
import com.facebook.react.views.text.TextDecorationStyleKt;

import org.junit.Test;

import java.lang.reflect.Method;

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

        Bitmap bitmap = drawDashedUnderline(layout, 1, latinStart + 2);
        int decoratedEnd = Math.round(left + paint.measureText("US"));
        int row = layout.getLineBottom(1) - 1;
        assertTrue(hasPaint(bitmap, (int) Math.ceil(left), decoratedEnd, row, row + 1));
        assertFalse(hasPaint(bitmap, decoratedEnd + 1, bitmap.getWidth(), row, row + 1));
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

        Bitmap bitmap = drawDashedUnderline(layout, 0, text.indexOf('א') + 1);
        assertTrue(hasPaint(bitmap, (int) Math.ceil(intervals[0]), (int) intervals[1]));
        assertTrue(hasPaint(bitmap, (int) Math.ceil(intervals[2]), (int) intervals[3]));
        assertFalse(hasPaint(bitmap, (int) Math.ceil(intervals[1]), (int) intervals[2]));
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

    @Test
    public void dashedUnderlineUsesDensityScaledPatternAtLineBottom() {
        String text = "Underline\nNext line";
        for (float density : new float[] {1f, 1.5f, 2f, 3f}) {
            TextPaint paint = textPaint();
            paint.density = density;
            Layout layout = StaticLayout.Builder.obtain(text, 0, text.length(), paint, 400)
                    .setIncludePad(false)
                    .setLineSpacing(12f, 1f)
                    .build();
            int bottom = layout.getLineBottom(0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                bottom -= 12;
            }
            Bitmap bitmap = drawDashedUnderline(layout, 0, text.indexOf('\n'));
            assertFalse(hasPaint(bitmap, 0, bitmap.getWidth(), 0, bottom - 2));
            assertFalse("density=" + density + ", line bottom=" + bottom
                            + ", coverage below bottom=" + Color.alpha(bitmap.getPixel(1, bottom)),
                    hasPaint(bitmap, 0, bitmap.getWidth(), bottom, bitmap.getHeight()));

            // Read the coverage of two full periods, including fractional pixels.
            for (int x = 0; x < (int) (10 * density); x++) {
                float period = 5f * density;
                float dashStart = (float) Math.floor(x / period) * period;
                float coverage = Math.max(0f, Math.min(x + 1f, dashStart + 3f * density) - x);
                coverage += Math.max(0f, x + 1f - (dashStart + period));
                float opacity = (Color.alpha(bitmap.getPixel(x, bottom - 1))
                        + Color.alpha(bitmap.getPixel(x, bottom - 2))) / 255f;
                assertEquals("density=" + density + ", x=" + x,
                        coverage * 0.5f * density, opacity, 0.12f);
            }
        }
    }

    @Test
    public void keepsOriginalStrikethroughAndOtherUnderlineStyles() throws Exception {
        Method originalDraw = TextDecorationStyleKt.class.getDeclaredMethod("drawDecorationLine",
                Canvas.class, Paint.class, float.class, float.class, float.class, float.class,
                float.class, TextDecorationStyle.class, Path.class);
        originalDraw.setAccessible(true);
        String text = "Decoration";
        TextPaint paint = textPaint();
        paint.density = 2f;
        Layout layout = layout(text, paint, 400);
        for (TextDecorationStyle style : TextDecorationStyle.values()) {
            Bitmap expected = Bitmap.createBitmap(400, layout.getHeight(), Bitmap.Config.ARGB_8888);
            Bitmap actual = Bitmap.createBitmap(400, layout.getHeight(), Bitmap.Config.ARGB_8888);
            TextDecorationStyleKt.drawSpannedDecoration(
                    0, text.length(), new Canvas(actual), layout, Color.RED, style,
                    (stroke, baseline, thickness) -> {
                        float y = baseline + (style == TextDecorationStyle.DASHED ? -8f : 4f);
                        try {
                            originalDraw.invoke(null, new Canvas(expected), stroke,
                                    layout.getLineLeft(0), layout.getLineRight(0),
                                    y, thickness, paint.density, style, new Path());
                        } catch (ReflectiveOperationException error) {
                            throw new AssertionError(error);
                        }
                        return y;
                    });
            assertTrue("Expected to draw " + style, hasPaint(expected, 0, expected.getWidth()));
            assertTrue("Expected original " + style + " drawing", expected.sameAs(actual));
        }
    }

    private static Bitmap drawDashedUnderline(Layout layout, int start, int end) {
        Bitmap bitmap = Bitmap.createBitmap(
                layout.getWidth(), layout.getHeight(), Bitmap.Config.ARGB_8888);
        TextDecorationStyleKt.drawSpannedDecoration(
                start, end, new Canvas(bitmap), layout, Color.RED, TextDecorationStyle.DASHED,
                (stroke, baseline, thickness) -> baseline + thickness + 1f);
        return bitmap;
    }

    private static boolean hasPaint(Bitmap bitmap, int from, int to) {
        return hasPaint(bitmap, from, to, 0, bitmap.getHeight());
    }

    private static boolean hasPaint(Bitmap bitmap, int from, int to, int top, int bottom) {
        for (int x = from; x < to; x++) {
            for (int y = top; y < bottom; y++) {
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
