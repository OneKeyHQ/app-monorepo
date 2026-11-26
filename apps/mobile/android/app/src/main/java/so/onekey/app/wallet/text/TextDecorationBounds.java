package so.onekey.app.wallet.text;

import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.text.Layout;
import android.util.SparseArray;

import java.util.Arrays;

public final class TextDecorationBounds {
    // Like React Android's decoration paint and path, these are used on the UI thread.
    private static final Path SELECTION = new Path();
    private static final Rect CLIP_BOUNDS = new Rect();
    private static final float[] WHOLE_LINE = new float[2];
    private static final float[] EMPTY = new float[0];
    private static final Paint DASH_PAINT = new Paint();
    private static final Path DASH_PATH = new Path();
    private static final SparseArray<DashPathEffect> DASH_EFFECTS = new SparseArray<>();

    private TextDecorationBounds() {}

    public static float[] forLine(Layout layout, int spanStart, int spanEnd, int line) {
        int lineStart = layout.getLineStart(line);
        int lineEnd = layout.getLineVisibleEnd(line);
        int start = Math.max(spanStart, lineStart);
        int end = Math.min(spanEnd, lineEnd);
        if (start >= end) {
            return EMPTY;
        }

        float left = layout.getLineLeft(line);
        float right = layout.getLineRight(line);
        if (start == lineStart && end == lineEnd) {
            WHOLE_LINE[0] = left;
            WHOLE_LINE[1] = right;
            return WHOLE_LINE;
        }

        // Android's selection path has one rectangle per intersecting bidi run.
        layout.getSelectionPath(start, end, SELECTION);
        float[] points = SELECTION.approximate(0.5f);
        int top = layout.getLineTop(line);
        int size = 0;
        for (int next = 3; next < points.length; next += 3) {
            int previous = next - 3;
            // Read only the top edge of each rectangle, never a jump between contours.
            if (points[previous] == points[next]
                    || points[previous + 2] != top || points[next + 2] != top) {
                continue;
            }
            float from = Math.max(left, Math.min(points[previous + 1], points[next + 1]));
            float to = Math.min(right, Math.max(points[previous + 1], points[next + 1]));
            if (from < to) {
                points[size++] = from;
                points[size++] = to;
            }
        }
        return Arrays.copyOf(points, coalesceIntervals(points, size));
    }

    private static int coalesceIntervals(float[] intervals, int size) {
        // Selection rectangles can arrive in either direction. Sort each pair by its left edge.
        for (int i = 2; i < size; i += 2) {
            float from = intervals[i];
            float to = intervals[i + 1];
            int position = i;
            while (position > 0 && intervals[position - 2] > from) {
                intervals[position] = intervals[position - 2];
                intervals[position + 1] = intervals[position - 1];
                position -= 2;
            }
            intervals[position] = from;
            intervals[position + 1] = to;
        }

        int merged = Math.min(size, 2);
        for (int i = 2; i < size; i += 2) {
            float from = intervals[i];
            float to = intervals[i + 1];
            if (from <= intervals[merged - 1]) {
                intervals[merged - 1] = Math.max(intervals[merged - 1], to);
            } else {
                intervals[merged++] = from;
                intervals[merged++] = to;
            }
        }
        return merged;
    }

    public static boolean drawDashedUnderline(Canvas canvas, Paint paint, Layout layout,
            int line, float from, float to, float y) {
        if (y <= layout.getLineBaseline(line)) {
            return false;
        }

        float density = layout.getPaint().density;
        int densityKey = Float.floatToIntBits(density);
        DashPathEffect effect = DASH_EFFECTS.get(densityKey);
        if (effect == null) {
            effect = new DashPathEffect(new float[] {3f * density, 2f * density}, 0f);
            DASH_EFFECTS.put(densityKey, effect);
        }
        float thickness = 0.5f * density;
        // Exclude extra interline spacing when Android exposes the unspaced bottom.
        int bottom = layout.getLineBottom(line);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            bottom = Math.min(bottom, layout.getLineBottom(line, false));
        }
        // Skia's subpixel hairline can cover pixels below the edge when
        // centered less than half a physical pixel from it.
        float center = bottom - Math.max(thickness / 2f, 0.5f);

        DASH_PAINT.set(paint);
        DASH_PAINT.setStrokeWidth(thickness);
        DASH_PAINT.setStrokeCap(Paint.Cap.BUTT);
        DASH_PAINT.setPathEffect(effect);
        DASH_PATH.rewind();
        DASH_PATH.moveTo(from, center);
        DASH_PATH.lineTo(to, center);
        canvas.drawPath(DASH_PATH, DASH_PAINT);
        return true;
    }

    public static void drawClippedWave(Canvas canvas, Path path, Paint paint, float from, float to) {
        if (!canvas.getClipBounds(CLIP_BOUNDS)) {
            return;
        }
        int saveCount = canvas.save();
        try {
            // The last cubic can extend past the interval's end.
            canvas.clipRect(from, CLIP_BOUNDS.top, to, CLIP_BOUNDS.bottom);
            canvas.drawPath(path, paint);
        } finally {
            canvas.restoreToCount(saveCount);
        }
    }
}
