package so.onekey.app.wallet.marketwidget;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

@RunWith(AndroidJUnit4.class)
public final class MarketWidgetContractTest {
    private static final String STORE_NAME = "onekey_public_market_widgets_v1";
    private Context context;
    private Context storageContext;
    private String preferencesPrefix;

    @Before
    public void setUp() {
        // Instrumentation runs as the target UID; isolate its files by name within that sandbox.
        storageContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        preferencesPrefix = "market_widget_contract_test_" + UUID.randomUUID() + "_";
        context = new ContextWrapper(storageContext) {
            @Override
            public SharedPreferences getSharedPreferences(String name, int mode) {
                return storageContext.getSharedPreferences(preferencesPrefix + name, mode);
            }

            @Override
            public Context getApplicationContext() {
                return this;
            }
        };
        assertTrue(context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).edit().clear().commit());
    }

    @After
    public void tearDown() {
        context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).edit().clear().commit();
        storageContext.deleteSharedPreferences(preferencesPrefix + STORE_NAME);
    }

    @Test
    public void emptyWatchlistUsesDefaultsButCorruptionDoesNot() throws Exception {
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[]}");
        assertTrue(MarketWidgetStore.configuration(context).assets.isEmpty());
        assertEquals("btc", MarketWidgetStore.assets(context, 1, true).get(0).assetId);
        assertEquals(3, MarketWidgetStore.assets(context, 2, false).size());
        context.getSharedPreferences("onekey_public_market_widgets_v1", Context.MODE_PRIVATE)
            .edit().putString("configuration", "broken").commit();
        assertFalse(MarketWidgetStore.configuration(context).valid);
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
    }

    @Test
    public void eachInstanceKeepsItsSelectionAndRemovalDoesNotChangeTheAsset() throws Exception {
        MarketWidgetData.Configuration defaults = MarketWidgetData.defaults();
        MarketWidgetStore.setConfiguration(context, defaults.json());
        MarketWidgetStore.select(context, 1, defaults.assets.get(0).key());
        MarketWidgetStore.select(context, 2, defaults.assets.get(1).key());
        assertEquals("btc", MarketWidgetStore.assets(context, 1, true).get(0).assetId);
        assertEquals("eth", MarketWidgetStore.assets(context, 2, true).get(0).assetId);
        MarketWidgetStore.setConfiguration(context,
            "{\"schemaVersion\":1,\"assets\":[{\"kind\":\"asset\",\"assetId\":\"sol\"}]}");
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
        assertTrue(MarketWidgetStore.assets(context, 2, true).isEmpty());
        assertEquals("sol", MarketWidgetStore.assets(context, 3, true).get(0).assetId);
    }

    @Test
    public void savingAfterWatchlistChangeRejectsRemovedAssetsAndPreservesValidIdentity() throws Exception {
        MarketWidgetData.Configuration defaults = MarketWidgetData.defaults();
        String bitcoin = defaults.assets.get(0).key();
        String ethereum = defaults.assets.get(1).key();
        MarketWidgetStore.select(context, 1, bitcoin);
        MarketWidgetStore.setConfiguration(context,
            "{\"schemaVersion\":1,\"assets\":[{\"kind\":\"asset\",\"assetId\":\"sol\"},"
                + "{\"kind\":\"asset\",\"assetId\":\"eth\"}]}");
        try {
            MarketWidgetStore.select(context, 1, bitcoin);
            fail("A choice removed while configuring must not be saved");
        } catch (IllegalArgumentException expected) {
            // The native store validates against the latest configuration atomically.
        }
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
        MarketWidgetStore.select(context, 1, ethereum);
        assertEquals("eth", MarketWidgetStore.assets(context, 1, true).get(0).assetId);
    }

    @Test
    public void tokenIdentityPreservesChainAndCaseAndKeepsRequestAddressOutOfDeepLink() throws Exception {
        MarketWidgetData.Asset first = token("sol--101", "AbcDEF");
        MarketWidgetData.Asset second = token("sol--101", "abcdef");
        MarketWidgetData.Asset otherChain = token("evm--1", "AbcDEF");
        assertNotEquals(first.key(), second.key());
        assertNotEquals(first.key(), otherChain.key());
        assertEquals("AbcDEF", first.deepLink().getQueryParameter("contractAddress"));
        MarketWidgetData.Asset nativeToken = new MarketWidgetData.Asset(new JSONObject()
            .put("kind", "token").put("chainId", "sol--101").put("contractAddress", "")
            .put("isNative", true).put("requestTokenAddress", "native-request-address"));
        assertEquals("", nativeToken.deepLink().getQueryParameter("contractAddress"));
        assertEquals("true", nativeToken.deepLink().getQueryParameter("isNative"));
        assertNull(nativeToken.deepLink().getQueryParameter("requestTokenAddress"));
        MarketWidgetData.Asset sui = new MarketWidgetData.Asset(new JSONObject()
            .put("kind", "token").put("chainId", "sui--mainnet")
            .put("contractAddress", "0x2::sui::SUI").put("isNative", true)
            .put("requestTokenAddress", "0x2::sui::SUI"));
        assertEquals("0x2::sui::SUI", sui.deepLink().getQueryParameter("contractAddress"));
    }

    @Test
    public void parsesActualAssetAndTokenEnvelopesWithoutInventingMissingPrices() throws Exception {
        MarketWidgetData.Asset asset = MarketWidgetData.defaults().assets.get(0);
        JSONObject envelope = new JSONObject("{\"code\":0,\"data\":{\"asset\":{\"assetId\":\"btc\","
            + "\"symbol\":\"BTC\",\"name\":\"Bitcoin\"},\"market\":{\"price\":\"104500.12\","
            + "\"priceChange24hPercent\":\"-1.25\"}}}");
        MarketWidgetData.Quote quote = MarketWidgetClient.decode(asset, envelope, 12345L);
        assertEquals(new BigDecimal("104500.12"), quote.price);
        assertEquals(new BigDecimal("-1.25"), quote.change);
        assertEquals(12345L, quote.fetchedAt);
        JSONObject tokenEnvelope = new JSONObject("{\"code\":0,\"data\":{\"token\":{\"networkId\":\"evm--1\","
            + "\"address\":\"0xabc\",\"price\":\"0.0000000321\",\"symbol\":\"TKN\"}}}");
        assertEquals(new BigDecimal("0.0000000321"),
            MarketWidgetClient.decode(token("evm--1", "0xAbC"), tokenEnvelope, 12345L).price);
        tokenEnvelope.getJSONObject("data").getJSONObject("token").remove("price");
        expectDecodeFailure(token("evm--1", "0xabc"), tokenEnvelope);
        envelope.getJSONObject("data").getJSONObject("asset").put("assetId", "eth");
        expectDecodeFailure(asset, envelope);
        envelope.put("code", 500);
        expectDecodeFailure(asset, envelope);
    }

    @Test
    public void nativeAssetCannotReceiveAnotherTokenPriceOnTheSameChain() throws Exception {
        MarketWidgetData.Asset eth = new MarketWidgetData.Asset(new JSONObject()
            .put("kind", "token").put("chainId", "evm--1").put("contractAddress", "")
            .put("isNative", true).put("requestTokenAddress", "0xeeee"));
        JSONObject envelope = new JSONObject("{\"code\":0,\"data\":{\"token\":{\"networkId\":\"evm--1\","
            + "\"address\":\"0xOtherToken\",\"isNative\":false,\"price\":\"1.00\"}}}");
        expectDecodeFailure(eth, envelope);
        envelope.getJSONObject("data").getJSONObject("token").remove("isNative");
        expectDecodeFailure(eth, envelope);
        envelope.getJSONObject("data").getJSONObject("token").put("address", "").put("isNative", true);
        assertEquals(new BigDecimal("1.00"), MarketWidgetClient.decode(eth, envelope, 12345L).price);
    }

    @Test
    public void canonicalEmptyNativeAddressesAreRequestedAndVerifiedByNetwork() throws Exception {
        for (String network : new String[]{"btc--0", "evm--1", "sol--101"}) {
            MarketWidgetData.Asset asset = new MarketWidgetData.Asset(new JSONObject()
                .put("kind", "token").put("chainId", network).put("contractAddress", "")
                .put("isNative", true).put("requestTokenAddress", ""));
            assertEquals("", MarketWidgetClient.endpoint(asset).getQueryParameter("tokenAddress"));
            assertEquals(network, MarketWidgetClient.endpoint(asset).getQueryParameter("networkId"));
            assertEquals("usd", MarketWidgetClient.endpoint(asset).getQueryParameter("currency"));
            JSONObject token = new JSONObject().put("networkId", network).put("address", "")
                .put("isNative", true).put("price", "123.45");
            JSONObject envelope = new JSONObject().put("code", 0)
                .put("data", new JSONObject().put("token", token));
            assertEquals(new BigDecimal("123.45"), MarketWidgetClient.decode(asset, envelope, 12345L).price);
            token.put("networkId", "wrong-network");
            expectDecodeFailure(asset, envelope);
            token.put("networkId", network).put("isNative", false);
            expectDecodeFailure(asset, envelope);
        }
    }

    @Test
    public void failedRefreshRetainsQuoteAndConfigurationChangePrunesOldData() throws Exception {
        MarketWidgetData.Asset asset = MarketWidgetData.defaults().assets.get(0);
        MarketWidgetData.Quote quote = new MarketWidgetData.Quote(new BigDecimal("123"), null, "BTC", "Bitcoin", 12345L);
        MarketWidgetStore.saveQuote(context, asset, quote);
        MarketWidgetStore.markFailed(context, asset);
        assertTrue(MarketWidgetStore.failed(context, asset));
        assertEquals(12345L, MarketWidgetStore.quote(context, asset).fetchedAt);
        MarketWidgetStore.setConfiguration(context,
            "{\"schemaVersion\":1,\"assets\":[{\"kind\":\"asset\",\"assetId\":\"sol\"}]}");
        MarketWidgetStore.saveQuote(context, asset, quote);
        assertNull(MarketWidgetStore.quote(context, asset));
    }

    @Test
    public void subCentPricesAndInvalidNumbersAreNotRoundedIntoZeroQuotes() {
        assertEquals("$0.0000000321", MarketWidgetProvider.price(new BigDecimal("0.0000000321"), Locale.US));
        assertEquals("<$0.000000000001", MarketWidgetProvider.price(new BigDecimal("1e-20"), Locale.US));
        assertNull(MarketWidgetData.number("NaN"));
        assertNull(MarketWidgetData.number("Infinity"));
        assertNull(MarketWidgetData.number("1e9999999"));
        assertNull(MarketWidgetData.number(true));
    }

    private static MarketWidgetData.Asset token(String network, String address) throws Exception {
        return new MarketWidgetData.Asset(new JSONObject().put("kind", "token")
            .put("chainId", network).put("contractAddress", address).put("symbol", ""));
    }

    private static void expectDecodeFailure(MarketWidgetData.Asset asset, JSONObject envelope) throws Exception {
        try {
            MarketWidgetClient.decode(asset, envelope, 12345L);
            fail("Invalid market data must not become a quote");
        } catch (java.io.IOException expected) {
            // Expected data validation failure.
        }
    }
}
