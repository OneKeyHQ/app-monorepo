package so.onekey.app.wallet.marketwidget;

import android.net.Uri;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeMap;

import javax.net.ssl.HttpsURLConnection;

import so.onekey.app.wallet.BuildConfig;

final class MarketWidgetClient {
    static Uri endpoint(MarketWidgetData.Asset asset) {
        Uri.Builder endpoint = Uri.parse("https://utility.onekeycn.com").buildUpon();
        if ("stock".equals(asset.kind)) {
            endpoint.path("/utility/v1/stocks").appendPath(asset.stockId);
        } else if ("asset".equals(asset.kind)) {
            endpoint.path("/utility/v1/market/asset/detail").appendQueryParameter("assetId", asset.assetId);
        } else {
            // Empty is the API's canonical native-token address on BTC, EVM and Solana.
            String requestAddress = !asset.requestTokenAddress.isEmpty()
                ? asset.requestTokenAddress : asset.contractAddress;
            endpoint.path("/utility/v2/market/token/detail")
                .appendQueryParameter("networkId", asset.chainId)
                .appendQueryParameter("tokenAddress", requestAddress);
        }
        endpoint.appendQueryParameter("currency", "usd");
        return endpoint.build();
    }

    static MarketWidgetData.Quote fetch(MarketWidgetData.Asset asset, String locale) throws Exception {
        long startedAt = System.currentTimeMillis();
        return decode(asset, request(endpoint(asset), locale), startedAt);
    }

    private static JSONObject request(Uri uri, String locale) throws Exception {
        long started = android.os.SystemClock.elapsedRealtime();
        String requestId = UUID.randomUUID().toString();
        String path = uri.getPath();
        String operation = path != null && path.contains("/kline") ? "chart"
            : path != null && path.contains("/trending") ? "ranking" : "quote";
        int status = 0;
        HttpsURLConnection connection = (HttpsURLConnection) new URL(uri.toString()).openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(8_000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "OneKeyWallet/" + BuildConfig.VERSION_NAME);
        connection.setRequestProperty("X-Onekey-Request-Platform", "android");
        connection.setRequestProperty("X-Onekey-Request-Platform-Name", "OneKey Market Widget");
        connection.setRequestProperty("X-Onekey-Request-Device-Name", "OneKey Market Widget");
        connection.setRequestProperty("X-Onekey-Request-Currency", "usd");
        connection.setRequestProperty("X-Onekey-Request-Locale", locale);
        connection.setRequestProperty("X-Onekey-Request-Version", BuildConfig.VERSION_NAME);
        connection.setRequestProperty("X-Onekey-Request-Build-Number", Integer.toString(BuildConfig.VERSION_CODE));
        connection.setRequestProperty("X-Onekey-Request-ID", requestId);
        connection.setRequestProperty("X-Amzn-Trace-Id", requestId);
        MarketWidgetLog.event("request.started", "requestId", requestId, "operation", operation);
        try {
            status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("Market response unavailable");
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new IOException("Market refresh cancelled");
                    if (bytes.size() + count > 512 * 1024) throw new IOException("Market response too large");
                    bytes.write(buffer, 0, count);
                }
                JSONObject response = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
                MarketWidgetLog.event("request.completed", "requestId", requestId, "operation", operation,
                    "httpStatus", status, "apiCode", response.optInt("code", -1),
                    "durationMs", android.os.SystemClock.elapsedRealtime() - started);
                return response;
            }
        } catch (Exception error) {
            MarketWidgetLog.failure("request.failed", error, "requestId", requestId, "operation", operation,
                "httpStatus", status, "durationMs", android.os.SystemClock.elapsedRealtime() - started);
            throw error;
        } finally {
            connection.disconnect();
        }
    }

    static MarketWidgetData.Quote decode(MarketWidgetData.Asset asset, JSONObject envelope, long fetchedAt)
        throws Exception {
        if (envelope.getInt("code") != 0) throw new IOException("Market response failed");
        JSONObject data = envelope.getJSONObject("data");
        if ("stock".equals(asset.kind)) return decodeStock(asset, data, fetchedAt);
        JSONObject quote;
        JSONObject identity;
        if ("asset".equals(asset.kind)) {
            identity = data.getJSONObject("asset");
            if (!asset.assetId.equals(identity.getString("assetId"))) throw new IOException("Market identity mismatch");
            quote = data.getJSONObject("market");
        } else {
            quote = data.getJSONObject("token");
            identity = quote;
            String returnedNetwork = quote.optString("networkId", "");
            if (!returnedNetwork.isEmpty() && !asset.chainId.equals(returnedNetwork)) {
                throw new IOException("Market network mismatch");
            }
            String returnedAddress = quote.optString("address", "");
            String requestedAddress = asset.requestTokenAddress.isEmpty()
                ? asset.contractAddress : asset.requestTokenAddress;
            boolean matchingAddress = !requestedAddress.isEmpty()
                && sameAddress(asset.chainId, requestedAddress, returnedAddress);
            boolean matchingNative = asset.isNative && asset.chainId.equals(returnedNetwork)
                && Boolean.TRUE.equals(quote.opt("isNative"));
            if ((asset.isNative && quote.has("isNative") && !Boolean.TRUE.equals(quote.opt("isNative")))
                || (!matchingAddress && !matchingNative)) {
                throw new IOException("Market token mismatch");
            }
        }
        BigDecimal price = MarketWidgetData.number(quote.opt("price"));
        if (price == null || price.signum() < 0) throw new IOException("Market price unavailable");
        return new MarketWidgetData.Quote(price, MarketWidgetData.number(quote.opt("priceChange24hPercent")),
            identity.optString("symbol", asset.symbol), identity.optString("name", asset.name), fetchedAt,
            identity.optString("logoUrl", asset.iconUrl));
    }

    private static MarketWidgetData.Quote decodeStock(MarketWidgetData.Asset asset, JSONObject data, long fetchedAt)
        throws Exception {
        if (!asset.stockId.equalsIgnoreCase(data.getString("stockId")) || !"USD".equals(data.getString("currency"))) {
            throw new IOException("Stock identity mismatch");
        }
        BigDecimal price = MarketWidgetData.number(data.opt("price"));
        if (price == null || price.signum() < 0) throw new IOException("Stock price unavailable");
        long updatedAt = 0;
        try {
            updatedAt = java.time.Instant.parse(data.optString("priceUpdatedAt", "")).toEpochMilli();
        } catch (java.time.format.DateTimeParseException ignored) {
            // A missing feed timestamp must not be replaced with a false trade time.
        }
        if (updatedAt < 0 || updatedAt > fetchedAt + 60_000) updatedAt = 0;
        JSONObject status = data.optJSONObject("marketStatus");
        Boolean closed = status != null && status.opt("isOpen") instanceof Boolean
            ? !status.getBoolean("isOpen") : null;
        return new MarketWidgetData.Quote(price, MarketWidgetData.number(data.opt("priceChange24hPercent")),
            data.optString("symbol", asset.symbol), data.optString("name", asset.name), fetchedAt,
            data.optString("logoUrl", asset.iconUrl), decodeStockSparkline(data.optJSONArray("sparkline")), updatedAt, closed);
    }

    static List<BigDecimal> decodeStockSparkline(JSONArray samples) {
        if (samples == null || samples.length() < 2 || samples.length() > 10_000) return null;
        List<BigDecimal> values = new ArrayList<>();
        for (int index = 0; index < samples.length(); index++) {
            BigDecimal value = MarketWidgetData.number(samples.opt(index));
            if (value == null || value.signum() <= 0) return null;
            values.add(value);
        }
        int count = Math.min(values.size(), 96);
        List<BigDecimal> result = new ArrayList<>();
        for (int index = 0; index < count; index++) result.add(values.get(index * (values.size() - 1) / (count - 1)));
        return result;
    }

    static List<MarketWidgetData.Asset> fetchHot(String locale) throws Exception {
        return decodeHot(request(Uri.parse("https://utility.onekeycn.com/utility/v2/market/trending"), locale));
    }

    static List<MarketWidgetData.Asset> decodeHot(JSONObject envelope) throws Exception {
        if (envelope.getInt("code") != 0) throw new IOException("Hot coins unavailable");
        JSONArray items = envelope.getJSONArray("data");
        List<MarketWidgetData.Asset> result = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        for (int index = 0; index < Math.min(items.length(), MarketWidgetData.MAX_ASSETS); index++) {
            JSONObject item = items.getJSONObject(index);
            if (item.has("stockId") || item.has("perpsCoin")) continue;
            try {
                MarketWidgetData.Asset asset = new MarketWidgetData.Asset(new JSONObject()
                    .put("kind", "token").put("chainId", item.getString("network"))
                    .put("contractAddress", item.optString("address", ""))
                    .put("requestTokenAddress", item.optString("address", ""))
                    .put("isNative", item.optBoolean("isNative", false))
                    .put("symbol", item.optString("symbol", ""))
                    .put("name", item.optString("name", ""))
                    .put("iconUrl", item.optString("logoUrl", "")));
                if (keys.add(asset.key())) result.add(asset);
            } catch (org.json.JSONException ignored) {
                // A malformed entry must not replace a different valid market identity.
            }
        }
        if (result.isEmpty()) throw new IOException("Hot coins unavailable");
        return result;
    }

    static MarketWidgetData.History fetchHistory(MarketWidgetData.Asset asset, String locale) throws Exception {
        if ("stock".equals(asset.kind)) throw new IOException("Stock chart is included in its quote");
        long now = System.currentTimeMillis();
        Uri detail = endpoint(asset);
        Uri uri = detail.buildUpon().path(detail.getPath().replace("/detail", "/kline"))
            .appendQueryParameter("interval", "1H")
            .appendQueryParameter("timeFrom", Long.toString(now / 1000 - 86400))
            .appendQueryParameter("timeTo", Long.toString(now / 1000)).build();
        JSONObject envelope = request(uri, locale);
        if (envelope.getInt("code") != 0) throw new IOException("Chart unavailable");
        return decodeHistory(envelope.getJSONObject("data").getJSONArray("points"), now);
    }

    static MarketWidgetData.History decodeHistory(JSONArray points, long fetchedAt) throws Exception {
        if (points.length() > 300 || fetchedAt <= 0) throw new IOException("Invalid chart");
        TreeMap<Long, BigDecimal> ordered = new TreeMap<>();
        long now = fetchedAt / 1000;
        for (int index = 0; index < points.length(); index++) {
            JSONObject point = points.getJSONObject(index);
            BigDecimal price = MarketWidgetData.number(point.opt("c"));
            long time = point.optLong("t", 0);
            // The service rounds the first candle down to the minute/hour boundary.
            if (price != null && price.signum() >= 0 && time >= now - 90000 && time <= now + 60) {
                ordered.put(time, price);
            }
        }
        if (ordered.size() < 12 || ordered.lastKey() - ordered.firstKey() < 18 * 3600) {
            throw new IOException("Insufficient 24-hour chart data");
        }
        return new MarketWidgetData.History(new ArrayList<>(ordered.values()),
            new ArrayList<>(ordered.keySet()), fetchedAt);
    }

    private static boolean sameAddress(String network, String requested, String returned) {
        return network.startsWith("evm--") ? requested.equalsIgnoreCase(returned) : requested.equals(returned);
    }

    private MarketWidgetClient() {}
}
