package so.onekey.app.wallet.text;

import android.graphics.Path;
import android.text.Layout;

import java.util.Arrays;

public final class TextDecorationBounds {
    // Like React Android's decoration paint and path, these are used on the UI thread.
    private static final Path SELECTION = new Path();
    private static final float[] WHOLE_LINE = new float[2];
    private static final float[] EMPTY = new float[0];

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
        return Arrays.copyOf(points, size);
    }
}
