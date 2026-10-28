package so.onekey.app.wallet.marketwidget;

import android.net.Uri;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import javax.net.ssl.HttpsURLConnection;

import so.onekey.app.wallet.BuildConfig;

final class MarketWidgetClient {
    static Uri endpoint(MarketWidgetData.Asset asset) {
        Uri.Builder endpoint = Uri.parse("https://utility.onekeycn.com").buildUpon();
        if ("asset".equals(asset.kind)) {
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
        HttpsURLConnection connection = (HttpsURLConnection) new URL(endpoint(asset).toString()).openConnection();
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
        String requestId = UUID.randomUUID().toString();
        connection.setRequestProperty("X-Onekey-Request-ID", requestId);
        connection.setRequestProperty("X-Amzn-Trace-Id", requestId);
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("Market response unavailable");
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new IOException("Market refresh cancelled");
                    if (bytes.size() + count > 512 * 1024) throw new IOException("Market response too large");
                    bytes.write(buffer, 0, count);
                }
                return decode(asset, new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())),
                    System.currentTimeMillis());
            }
        } finally {
            connection.disconnect();
        }
    }

    static MarketWidgetData.Quote decode(MarketWidgetData.Asset asset, JSONObject envelope, long fetchedAt)
        throws Exception {
        if (envelope.getInt("code") != 0) throw new IOException("Market response failed");
        JSONObject data = envelope.getJSONObject("data");
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
            identity.optString("symbol", asset.symbol), identity.optString("name", asset.name), fetchedAt);
    }

    private static boolean sameAddress(String network, String requested, String returned) {
        return network.startsWith("evm--") ? requested.equalsIgnoreCase(returned) : requested.equals(returned);
    }

    private MarketWidgetClient() {}
}
