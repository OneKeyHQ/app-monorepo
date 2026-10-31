package so.onekey.app.wallet.marketwidget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Shader;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URL;

import javax.net.ssl.HttpsURLConnection;

final class MarketWidgetImages {
    private static File file(Context context, MarketWidgetData.Asset asset) {
        return new File(new File(context.getCacheDir(), "market_widget_icons"), asset.key() + ".png");
    }

    static Bitmap cached(Context context, MarketWidgetData.Asset asset) {
        File file = file(context, asset);
        if (!file.exists() || file.length() > 64 * 1024) return null;
        return BitmapFactory.decodeFile(file.getAbsolutePath());
    }

    static void fetch(Context context, MarketWidgetData.Asset asset, String url) throws Exception {
        if (MarketWidgetData.imageUrl(url).isEmpty() || !MarketWidgetStore.contains(context, asset)) return;
        File file = file(context, asset);
        if (file.exists() && System.currentTimeMillis() - file.lastModified() < 7 * 24 * 3600_000L) {
            MarketWidgetLog.event("icon.cache_hit");
            return;
        }
        String requestId = java.util.UUID.randomUUID().toString();
        long started = android.os.SystemClock.elapsedRealtime();
        int status = 0;
        HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(6_000);
        connection.setReadTimeout(6_000);
        connection.setInstanceFollowRedirects(false);
        MarketWidgetLog.event("request.started", "requestId", requestId, "operation", "icon");
        try {
            status = connection.getResponseCode();
            if (status != 200) throw new IOException("Icon unavailable");
            byte[] raw;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted() || output.size() + count > 512 * 1024) {
                        throw new IOException("Icon unavailable");
                    }
                    output.write(buffer, 0, count);
                }
                raw = output.toByteArray();
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, options);
            if (options.outWidth < 1 || options.outHeight < 1 || options.outWidth > 4096 || options.outHeight > 4096) return;
            options.inJustDecodeBounds = false;
            options.inSampleSize = Math.max(1, Math.max(options.outWidth, options.outHeight) / 96);
            Bitmap decoded = BitmapFactory.decodeByteArray(raw, 0, raw.length, options);
            if (decoded == null) return;
            Bitmap scaled = Bitmap.createScaledBitmap(decoded, 96, 96, true);
            Bitmap rounded = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(rounded);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            canvas.drawCircle(48, 48, 48, paint);
            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            canvas.drawBitmap(scaled, 0, 0, paint);
            if (!MarketWidgetStore.contains(context, asset)) return;
            File parent = file.getParentFile();
            if (!parent.exists() && !parent.mkdirs()) return;
            File temporary = File.createTempFile("icon", ".png", parent);
            try {
                try (FileOutputStream output = new FileOutputStream(temporary)) {
                    rounded.compress(Bitmap.CompressFormat.PNG, 100, output);
                }
                if (!temporary.renameTo(file)) throw new IOException("Icon cache unavailable");
                MarketWidgetLog.event("icon.cached", "requestId", requestId);
                File[] cached = parent.listFiles((directory, name) -> name.endsWith(".png"));
                if (cached != null && cached.length > 80) {
                    java.util.Arrays.sort(cached, java.util.Comparator.comparingLong(File::lastModified));
                    for (int index = 0; index < cached.length - 80; index++) cached[index].delete();
                }
            } finally {
                temporary.delete();
            }
        } catch (Exception error) {
            MarketWidgetLog.failure("request.failed", error, "requestId", requestId, "operation", "icon", "httpStatus", status);
            throw error;
        } finally {
            MarketWidgetLog.event("request.finished", "requestId", requestId, "operation", "icon", "httpStatus", status,
                "durationMs", android.os.SystemClock.elapsedRealtime() - started);
            connection.disconnect();
        }
    }

    static Bitmap chart(MarketWidgetData.History history, int color, float density) {
        int width = Math.round(48 * density);
        int height = Math.round(20 * density);
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        if (history == null) return bitmap;
        BigDecimal minimum = history.prices.get(0);
        BigDecimal maximum = minimum;
        for (BigDecimal price : history.prices) {
            minimum = minimum.min(price);
            maximum = maximum.max(price);
        }
        double span = maximum.subtract(minimum).doubleValue();
        long start = history.times.get(0);
        long duration = history.times.get(history.times.size() - 1) - start;
        if (duration <= 0) return bitmap;
        float inset = 2 * density;
        Path path = new Path();
        for (int index = 0; index < history.prices.size(); index++) {
            float x = inset + (width - 2 * inset) * (history.times.get(index) - start) / duration;
            float y = span == 0 ? height / 2f : inset + (height - 2 * inset)
                * (1 - (float) (history.prices.get(index).subtract(minimum).doubleValue() / span));
            if (index == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        Canvas canvas = new Canvas(bitmap);
        Path area = new Path(path);
        area.lineTo(width - inset, height);
        area.lineTo(inset, height);
        area.close();
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setShader(new LinearGradient(0, inset, 0, height,
            Color.argb(64, Color.red(color), Color.green(color), Color.blue(color)),
            Color.TRANSPARENT, Shader.TileMode.CLAMP));
        canvas.drawPath(area, fill);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        paint.setAlpha(170);
        paint.setStrokeWidth(1.25f * density);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setStyle(Paint.Style.STROKE);
        canvas.drawPath(path, paint);
        return bitmap;
    }

    private MarketWidgetImages() {}
}
