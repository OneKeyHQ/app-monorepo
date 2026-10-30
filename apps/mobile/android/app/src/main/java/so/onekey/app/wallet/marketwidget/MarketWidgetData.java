package so.onekey.app.wallet.marketwidget;

import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Public market data only. This contract must never contain wallet or account data. */
final class MarketWidgetData {
    static final int MAX_ASSETS = 20;
    static final int MAX_CONFIGURATION_BYTES = 64 * 1024;

    static final class Asset {
        final String kind;
        final String assetId;
        final String chainId;
        final String contractAddress;
        final String requestTokenAddress;
        final boolean isNative;
        final String symbol;
        final String name;
        final String iconUrl;

        Asset(JSONObject value) throws JSONException {
            kind = value.getString("kind");
            if (!"asset".equals(kind) && !"token".equals(kind)) {
                throw new JSONException("Unsupported market identity");
            }
            assetId = "asset".equals(kind) ? identity(value, "assetId", 200, false) : "";
            chainId = "token".equals(kind) ? identity(value, "chainId", 100, false) : "";
            isNative = "token".equals(kind) && value.optBoolean("isNative", false);
            contractAddress = "token".equals(kind)
                ? identity(value, "contractAddress", 256, isNative) : "";
            requestTokenAddress = "token".equals(kind)
                ? identity(value, "requestTokenAddress", 256, true) : "";
            symbol = displayString(value.optString("symbol", ""), 40);
            name = displayString(value.optString("name", ""), 100);
            iconUrl = imageUrl(value.optString("iconUrl", ""));
        }

        String key() {
            // Preserve address case: Solana and other non-EVM identities are case sensitive.
            String identity = kind + "\n" + assetId + "\n" + chainId + "\n"
                + isNative + "\n" + contractAddress;
            try {
                byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(identity.getBytes(StandardCharsets.UTF_8));
                StringBuilder result = new StringBuilder();
                for (byte item : hash) result.append(String.format(Locale.US, "%02x", item & 255));
                return result.toString();
            } catch (java.security.NoSuchAlgorithmException error) {
                throw new IllegalStateException(error);
            }
        }

        String label() {
            if (!symbol.isEmpty()) return symbol;
            if (!assetId.isEmpty()) return assetId;
            if (isNative) return chainId;
            return contractAddress.length() > 12
                ? contractAddress.substring(0, 6) + "…" + contractAddress.substring(contractAddress.length() - 4)
                : contractAddress;
        }

        Uri deepLink() {
            Uri.Builder builder = new Uri.Builder().scheme("onekey-wallet").authority("market_widget");
            if ("asset".equals(kind)) {
                builder.appendQueryParameter("assetId", assetId);
            } else {
                builder.appendQueryParameter("chainId", chainId)
                    .appendQueryParameter("contractAddress", contractAddress)
                    .appendQueryParameter("isNative", Boolean.toString(isNative));
            }
            return builder.build();
        }

        JSONObject json() throws JSONException {
            JSONObject value = new JSONObject().put("kind", kind).put("symbol", symbol).put("name", name).put("iconUrl", iconUrl);
            if ("asset".equals(kind)) return value.put("assetId", assetId);
            return value.put("chainId", chainId).put("contractAddress", contractAddress)
                .put("requestTokenAddress", requestTokenAddress).put("isNative", isNative);
        }
    }

    static final class Configuration {
        final List<Asset> assets;
        final boolean greenUp;
        final String locale;
        final boolean valid;
        final boolean privacyMasked;

        Configuration(String raw) throws JSONException {
            this(raw, true);
        }

        private Configuration(String raw, boolean valid) throws JSONException {
            this.valid = valid;
            if (raw.getBytes(StandardCharsets.UTF_8).length > MAX_CONFIGURATION_BYTES) {
                throw new JSONException("Market widget configuration is too large");
            }
            JSONObject value = new JSONObject(raw);
            Object version = value.opt("schemaVersion");
            if (!(version instanceof Number) || ((Number) version).doubleValue() != 1) {
                throw new JSONException("Unsupported schema version");
            }
            JSONArray items = value.getJSONArray("assets");
            if (items.length() > MAX_ASSETS) throw new JSONException("Too many widget assets");
            assets = new ArrayList<>();
            Set<String> identities = new HashSet<>();
            for (int index = 0; index < items.length(); index++) {
                Asset asset = new Asset(items.getJSONObject(index));
                if (identities.add(asset.key())) assets.add(asset);
            }
            greenUp = value.optBoolean("greenUp", true);
            privacyMasked = value.optBoolean("privacyMasked", false);
            String language = value.optString("locale", "en-US").replace('_', '-');
            locale = language.matches("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}") ? language : "en-US";
        }

        String json() throws JSONException {
            JSONArray items = new JSONArray();
            for (Asset asset : assets) items.put(asset.json());
            return new JSONObject().put("schemaVersion", 1).put("assets", items)
                .put("greenUp", greenUp).put("locale", locale).put("privacyMasked", privacyMasked).toString();
        }

        boolean sameContent(Configuration other) throws JSONException {
            return valid && other.valid && json().equals(other.json());
        }

        static Configuration invalid() {
            try {
                return new Configuration("{\"schemaVersion\":1,\"assets\":[]}", false);
            } catch (JSONException error) {
                throw new IllegalStateException(error);
            }
        }
    }

    static final class Quote {
        final BigDecimal price;
        final BigDecimal change;
        final String symbol;
        final String name;
        final long fetchedAt;
        final String iconUrl;

        Quote(BigDecimal price, BigDecimal change, String symbol, String name, long fetchedAt) {
            this(price, change, symbol, name, fetchedAt, "");
        }

        Quote(BigDecimal price, BigDecimal change, String symbol, String name, long fetchedAt, String iconUrl) {
            this.iconUrl = imageUrl(iconUrl);
            this.price = price;
            this.change = change;
            this.symbol = displayString(symbol, 40);
            this.name = displayString(name, 100);
            this.fetchedAt = fetchedAt;
        }

        JSONObject json() throws JSONException {
            return new JSONObject().put("price", price.toPlainString())
                .put("change", change == null ? JSONObject.NULL : change.toPlainString())
                .put("symbol", symbol).put("name", name).put("fetchedAt", fetchedAt).put("iconUrl", iconUrl);
        }

        static Quote cached(String raw) {
            try {
                JSONObject value = new JSONObject(raw);
                BigDecimal price = number(value.opt("price"));
                long time = value.getLong("fetchedAt");
                if (price == null || price.signum() < 0 || time <= 0) return null;
                return new Quote(price, number(value.opt("change")), value.optString("symbol"),
                    value.optString("name"), time, value.optString("iconUrl", ""));
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    static final class History {
        final List<BigDecimal> prices;
        final List<Long> times;
        final long fetchedAt;

        History(List<BigDecimal> prices, List<Long> times, long fetchedAt) {
            this.prices = prices;
            this.times = times;
            this.fetchedAt = fetchedAt;
        }

        JSONObject json() throws JSONException {
            JSONArray points = new JSONArray();
            for (int index = 0; index < prices.size(); index++) {
                points.put(new JSONObject().put("t", times.get(index)).put("c", prices.get(index).toPlainString()));
            }
            return new JSONObject().put("points", points).put("fetchedAt", fetchedAt);
        }

        static History cached(String raw) {
            try {
                JSONObject value = new JSONObject(raw);
                return MarketWidgetClient.decodeHistory(value.getJSONArray("points"), value.getLong("fetchedAt"));
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    static String imageUrl(String raw) {
        if (raw.length() > 2048) return "";
        Uri uri = Uri.parse(raw);
        return "https".equals(uri.getScheme()) && uri.getHost() != null
            && uri.getUserInfo() == null ? raw : "";
    }

    static BigDecimal number(Object value) {
        if (!(value instanceof String) && !(value instanceof Number)) return null;
        String raw = value.toString();
        if (raw.length() > 100) return null;
        try {
            BigDecimal number = new BigDecimal(raw);
            return Math.abs(number.scale()) <= 100 && number.precision() <= 100 ? number : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    static Configuration defaults() {
        try {
            return new Configuration("{\"schemaVersion\":1,\"greenUp\":true,\"locale\":\"en-US\",\"assets\":["
                + "{\"kind\":\"asset\",\"assetId\":\"btc\",\"symbol\":\"BTC\",\"name\":\"Bitcoin\"},"
                + "{\"kind\":\"asset\",\"assetId\":\"eth\",\"symbol\":\"ETH\",\"name\":\"Ethereum\"},"
                + "{\"kind\":\"asset\",\"assetId\":\"sol\",\"symbol\":\"SOL\",\"name\":\"Solana\"}]}");
        } catch (JSONException error) {
            throw new IllegalStateException(error);
        }
    }

    private static String identity(JSONObject value, String field, int limit, boolean allowEmpty) throws JSONException {
        Object raw = value.opt(field);
        if (raw != null && raw != JSONObject.NULL && !(raw instanceof String)) {
            throw new JSONException("Invalid market identity field: " + field);
        }
        String text = value.optString(field, "").trim();
        if ((!allowEmpty && text.isEmpty()) || text.length() > limit
            || text.codePoints().anyMatch(Character::isISOControl)) {
            throw new JSONException("Invalid market identity field: " + field);
        }
        return text;
    }

    private static String displayString(String value, int limit) {
        String text = value.replaceAll("[\\p{Cntrl}]", "").trim();
        return text.substring(0, Math.min(text.length(), limit));
    }
}
