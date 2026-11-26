package so.onekey.app.wallet.text;

import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.text.Layout;
import android.util.SparseArray;
import android.view.View;
import android.widget.TextView;

import com.facebook.react.uimanager.ReactStylesDiffMap;
import com.facebook.react.views.text.internal.span.CanvasEffectSpan;
import com.facebook.react.views.text.internal.span.ReactUnderlineSpan;

import so.onekey.app.wallet.R;

import java.util.Arrays;

public final class TextDecorationBounds {
    // Like React Android's decoration paint and path, these are used on the UI thread.
    private static final String DASH_TEXT_PROP = "onekeyDashText";
    private static DashTextStyle activeDashText;
    private static float activeDashTextBottom;
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

    public static void updateDashText(View view, ReactStylesDiffMap props) {
        if (props.hasKey(DASH_TEXT_PROP)) {
            String value = props.getString(DASH_TEXT_PROP);
            view.setTag(R.id.onekey_dash_text, DashTextStyle.parse(value));
            view.invalidate();
        }
    }

    public static void clearDashText(View view) {
        view.setTag(R.id.onekey_dash_text, null);
    }

    public static void drawTextSpan(CanvasEffectSpan span, int start, int end, Canvas canvas,
            Layout layout, TextView view, float drawingOffsetY) {
        DashTextStyle style = (DashTextStyle) view.getTag(R.id.onekey_dash_text);
        if (style == null || !(span instanceof ReactUnderlineSpan)) {
            span.onDraw(start, end, canvas, layout);
            return;
        }

        // The renderer runs synchronously on the UI thread.
        DashTextStyle previousStyle = activeDashText;
        float previousBottom = activeDashTextBottom;
        activeDashText = style;
        activeDashTextBottom = view.getHeight() - drawingOffsetY;
        try {
            span.onDraw(start, end, canvas, layout);
        } finally {
            activeDashText = previousStyle;
            activeDashTextBottom = previousBottom;
        }
    }

    public static boolean drawDashedUnderline(Canvas canvas, Paint paint, Layout layout,
            int line, float from, float to) {
        DashTextStyle style = activeDashText;
        if (style == null) {
            return false;
        }

        float density = layout.getPaint().density;
        int densityKey = Float.floatToIntBits(density);
        DashPathEffect effect = DASH_EFFECTS.get(densityKey);
        if (effect == null) {
            effect = new DashPathEffect(new float[] {3f * density, 2f * density}, 0f);
            DASH_EFFECTS.put(densityKey, effect);
        }

        int lineBottom = layout.getLineBottom(line);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            lineBottom = Math.min(lineBottom, layout.getLineBottom(line, false));
        }
        float thickness = style.thickness * density;
        int height = Math.max(1, Math.round(thickness));
        int bottom = (int) Math.floor(activeDashTextBottom);
        int top = style.overlay
                ? Math.min(lineBottom, bottom) - height
                : lineBottom + Math.round(style.spacing * density);
        // Yoga may round a subpixel padding to zero. Keep the thinnest rule visible.
        top = Math.min(top, bottom - 1);
        height = Math.min(height, bottom - top);

        DASH_PAINT.set(paint);
        DASH_PAINT.setStrokeWidth(height);
        if (thickness < 1f) {
            DASH_PAINT.setAlpha(Math.round(paint.getAlpha() * thickness));
        }
        DASH_PAINT.setStrokeCap(Paint.Cap.BUTT);
        DASH_PAINT.setPathEffect(effect);
        DASH_PATH.rewind();
        float center = top + height / 2f;
        DASH_PATH.moveTo(from, center);
        DASH_PATH.lineTo(to, center);
        canvas.drawPath(DASH_PATH, DASH_PAINT);
        return true;
    }

    private static final class DashTextStyle {
        private final float thickness;
        private final float spacing;
        private final boolean overlay;

        private DashTextStyle(float thickness, float spacing, boolean overlay) {
            this.thickness = thickness;
            this.spacing = spacing;
            this.overlay = overlay;
        }

        private static DashTextStyle parse(String value) {
            if (value == null) {
                return null;
            }
            String[] parts = value.split(",", -1);
            if (parts.length != 3) {
                return null;
            }
            try {
                float thickness = Float.parseFloat(parts[0]);
                float spacing = Float.parseFloat(parts[1]);
                if (thickness > 0f && Float.isFinite(thickness) && Float.isFinite(spacing)) {
                    return new DashTextStyle(thickness, spacing, parts[2].equals("overlay"));
                }
            } catch (NumberFormatException ignored) {
                // Leave React Android's decoration unchanged for malformed values.
            }
            return null;
        }
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
