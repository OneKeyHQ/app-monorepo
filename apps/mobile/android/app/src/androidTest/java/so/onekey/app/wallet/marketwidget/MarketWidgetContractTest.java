package so.onekey.app.wallet.marketwidget;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.SharedPreferences;
import android.appwidget.AppWidgetManager;
import android.net.Uri;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import so.onekey.app.wallet.R;

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
    public void manualSlotsKeepOrderAndAreIsolatedFromOtherWidgetsAndCandidateChanges() throws Exception {
        MarketWidgetData.Configuration defaults = MarketWidgetData.defaults();
        MarketWidgetData.Asset btc = defaults.assets.get(0);
        MarketWidgetData.Asset eth = defaults.assets.get(1);
        MarketWidgetData.Asset sol = defaults.assets.get(2);
        MarketWidgetStore.saveHot(context, defaults.assets, System.currentTimeMillis());
        JSONObject list = new JSONObject().put("kind", "list").put("source", "hot")
            .put("assets", new JSONArray().put(sol.json()).put(btc.json()).put(eth.json()));
        MarketWidgetStore.saveSettings(context, 11, false, list.toString());
        MarketWidgetStore.saveSettings(context, 12, true, new JSONObject().put("kind", "single").put("source", "watchlist")
            .put("assets", new JSONArray().put(eth.json())).toString());
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[]}");
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(btc), System.currentTimeMillis());
        assertEquals(sol.key(), MarketWidgetStore.assets(context, 11, false).get(0).key());
        assertEquals(eth.key(), MarketWidgetStore.assets(context, 11, false).get(2).key());
        assertEquals(eth.key(), MarketWidgetStore.assets(context, 12, true).get(0).key());
        assertFalse(MarketWidgetStore.needsHotRanking(context, 11, false));
        assertTrue(MarketWidgetStore.contains(context, sol));
        MarketWidgetStore.saveSettings(context, 11, false, list.toString());
        assertEquals(eth.key(), MarketWidgetStore.assets(context, 12, true).get(0).key());
        try {
            MarketWidgetStore.saveSettings(context, 11, false, new JSONObject(list.toString())
                .put("assets", new JSONArray().put(btc.json())).toString());
            fail("Incomplete slots must not replace saved selections");
        } catch (IllegalArgumentException expected) { }
        assertEquals(3, MarketWidgetStore.assets(context, 11, false).size());
        JSONObject state = MarketWidgetStore.editorState(context, 11, false, MarketWidgetStore.HOT);
        assertEquals(3, state.getJSONArray("settings").getJSONObject(0).getJSONArray("assets").length());
        assertTrue(state.getJSONArray("settings").getJSONObject(0).getJSONArray("assets").getJSONObject(0).has("logoURL"));
        MarketWidgetStore.restoreWidget(context, 11, 13);
        assertEquals(sol.key(), MarketWidgetStore.assets(context, 13, false).get(0).key());
        assertFalse(MarketWidgetStore.hasManualSelection(context, 11));
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[],\"privacyMasked\":true}");
        assertTrue(MarketWidgetStore.assets(context, 13, false).isEmpty());
        assertFalse(MarketWidgetStore.contains(context, sol));
        MarketWidgetStore.deleteWidget(context, 13);
        assertFalse(MarketWidgetStore.hasManualSelection(context, 13));
    }

    @Test
    public void emptyWatchlistAndCorruptionDoNotSubstituteDifferentAssets() throws Exception {
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[]}");
        assertTrue(MarketWidgetStore.configuration(context).assets.isEmpty());
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
        assertTrue(MarketWidgetStore.assets(context, 2, false).isEmpty());
        context.getSharedPreferences("onekey_public_market_widgets_v1", Context.MODE_PRIVATE)
            .edit().putString("configuration", "broken").commit();
        assertFalse(MarketWidgetStore.configuration(context).valid);
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
    }

    @Test
    public void equivalentConfigurationDoesNotRequestAnotherRefreshAndInvalidInputDoesNotReplaceIt() throws Exception {
        String first = "{\"schemaVersion\":1,\"assets\":[{\"kind\":\"asset\",\"assetId\":\"btc\"}],\"locale\":\"en_US\"}";
        assertTrue(MarketWidgetStore.setConfiguration(context, first));
        MarketWidgetData.Asset bitcoin = MarketWidgetStore.configuration(context).assets.get(0);
        MarketWidgetStore.saveQuote(context, bitcoin,
            new MarketWidgetData.Quote(new BigDecimal("123"), null, "BTC", "Bitcoin", 12345L));
        String equivalent = "{\"privacyMasked\":false,\"greenUp\":true,\"locale\":\"en-US\","
            + "\"assets\":[{\"assetId\":\"btc\",\"kind\":\"asset\",\"symbol\":\"\",\"name\":\"\",\"iconUrl\":\"\"}],\"schemaVersion\":1}";
        assertFalse(MarketWidgetStore.setConfiguration(context, equivalent));
        assertEquals(12345L, MarketWidgetStore.quote(context, bitcoin).fetchedAt);
        try {
            MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":2,\"assets\":[]}");
            fail("Invalid input must not replace the last valid configuration");
        } catch (org.json.JSONException expected) { }
        assertFalse(MarketWidgetStore.setConfiguration(context, equivalent));
        context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).edit().putString("configuration", "broken").commit();
        assertTrue(MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[]}"));
        assertTrue(MarketWidgetStore.configuration(context).valid);
    }

    @Test
    public void configurationComparisonIncludesOrderMetadataPresentationAndPrivacy() throws Exception {
        JSONObject configuration = new JSONObject(MarketWidgetData.defaults().json());
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        org.json.JSONArray original = configuration.getJSONArray("assets");
        configuration.put("assets", new org.json.JSONArray().put(original.get(1)).put(original.get(0)).put(original.get(2)));
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        JSONObject asset = configuration.getJSONArray("assets").getJSONObject(0);
        for (String key : new String[]{"symbol", "name", "iconUrl"}) {
            asset.put(key, "iconUrl".equals(key) ? "https://example.com/eth.png" : "updated");
            assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
            assertFalse(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        }
        configuration.put("greenUp", false);
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        configuration.put("locale", "zh-CN");
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        configuration.put("privacyMasked", true);
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        assertFalse(MarketWidgetStore.canDisplay(context));
        configuration.put("privacyMasked", false);
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        JSONObject nativeAsset = new JSONObject().put("kind", "token").put("chainId", "evm--1")
            .put("contractAddress", "").put("isNative", true).put("requestTokenAddress", "");
        configuration.put("assets", new org.json.JSONArray().put(nativeAsset));
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        nativeAsset.put("requestTokenAddress", "0xeeee");
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
        nativeAsset.put("chainId", "evm--56");
        assertTrue(MarketWidgetStore.setConfiguration(context, configuration.toString()));
    }

    @Test
    public void refreshPlanDeduplicatesAssetsAndKeepsChartsOnlyForListDemand() {
        MarketWidgetData.Asset bitcoin = MarketWidgetData.defaults().assets.get(0);
        MarketWidgetData.Asset ethereum = MarketWidgetData.defaults().assets.get(1);
        Map<String, MarketWidgetRefreshService.AssetRequest> requests = new LinkedHashMap<>();
        MarketWidgetRefreshService.addAssetRequest(requests, bitcoin, false);
        MarketWidgetRefreshService.addAssetRequest(requests, bitcoin, false);
        assertEquals(1, requests.size());
        assertFalse(requests.get(bitcoin.key()).needsChart);
        MarketWidgetRefreshService.addAssetRequest(requests, bitcoin, true);
        MarketWidgetRefreshService.addAssetRequest(requests, bitcoin, false);
        MarketWidgetRefreshService.addAssetRequest(requests, ethereum, false);
        assertEquals(2, requests.size());
        assertTrue(requests.get(bitcoin.key()).needsChart);
        assertFalse(requests.get(ethereum.key()).needsChart);
    }

    @Test
    public void refreshPlanKeepsLatestRequestMetadataWithoutLosingEarlierChartDemand() throws Exception {
        JSONObject identity = new JSONObject().put("kind", "token").put("chainId", "evm--1")
            .put("contractAddress", "").put("isNative", true).put("requestTokenAddress", "")
            .put("symbol", "OLD").put("name", "Old name");
        MarketWidgetData.Asset first = new MarketWidgetData.Asset(identity);
        identity.put("requestTokenAddress", "0xeeee").put("symbol", "ETH").put("name", "Ethereum")
            .put("iconUrl", "https://example.com/eth.png");
        MarketWidgetData.Asset latest = new MarketWidgetData.Asset(identity);
        assertEquals(first.key(), latest.key());
        Map<String, MarketWidgetRefreshService.AssetRequest> requests = new LinkedHashMap<>();
        MarketWidgetRefreshService.addAssetRequest(requests, first, true);
        MarketWidgetRefreshService.addAssetRequest(requests, latest, false);
        assertEquals(1, requests.size());
        MarketWidgetRefreshService.AssetRequest request = requests.get(first.key());
        assertSame(latest, request.asset);
        assertEquals("0xeeee", MarketWidgetClient.endpoint(request.asset).getQueryParameter("tokenAddress"));
        assertTrue(request.needsChart);
    }

    @Test
    public void onlyOneProviderOwnsPeriodicRefreshAndSinglesResumeAfterLastListIsRemoved() {
        assertTrue(MarketWidgetProvider.ownsPeriodicRefresh(false, 0));
        for (int listCount : new int[]{1, 3}) {
            assertFalse(MarketWidgetProvider.ownsPeriodicRefresh(false, listCount));
            assertTrue(MarketWidgetProvider.ownsPeriodicRefresh(true, listCount));
        }
        assertTrue(MarketWidgetProvider.ownsPeriodicRefresh(false, 0));
    }

    @Test
    public void onlyDynamicHotWidgetsNeedTheRanking() throws Exception {
        MarketWidgetData.Asset hot = token("evm--1", "0xabc");
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(hot), 12345L);
        MarketWidgetStore.configure(context, 1, MarketWidgetStore.HOT, hot.key(), true);
        MarketWidgetStore.configure(context, 2, MarketWidgetStore.HOT, null, false);
        assertFalse(MarketWidgetStore.needsHotRanking(context, 1, true));
        assertTrue(MarketWidgetStore.needsHotRanking(context, 2, false));
        assertFalse(MarketWidgetStore.needsHotRanking(context, 3, true));
        context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE).edit().putString("source_3", MarketWidgetStore.HOT).commit();
        assertTrue(MarketWidgetStore.needsHotRanking(context, 3, true));
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(token("sol--101", "Next")), 23456L);
        assertEquals(hot.key(), MarketWidgetStore.assets(context, 1, true).get(0).key());
        assertFalse(MarketWidgetStore.needsHotRanking(context, 1, true));
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"assets\":[],\"privacyMasked\":true}");
        assertFalse(MarketWidgetStore.needsHotRanking(context, 2, false));
        assertFalse(MarketWidgetStore.needsHotRanking(context, 3, true));
    }

    @Test
    public void existingLegacyCardsKeepTheirDisplayedSourceAndSelectionWhenEditing() throws Exception {
        MarketWidgetStore.setConfiguration(context, MarketWidgetData.defaults().json());
        assertFalse(MarketWidgetStore.isConfigured(context, 101));
        Intent edit = MarketWidgetProvider.configureIntent(context, 101);
        assertTrue(edit.getBooleanExtra(MarketWidgetConfigureActivity.EXTRA_EDIT_EXISTING, false));
        MarketWidgetConfigureActivity.InitialEditorState list =
            MarketWidgetConfigureActivity.initialEditorState(context, edit, 101, false);
        assertEquals(MarketWidgetStore.WATCHLIST, list.source);
        assertNull(list.assetKey);
        // An already-issued PendingIntent can outlive the app update that added the extra.
        Intent legacyEdit = new Intent().setData(Uri.parse("onekey-widget-configure://widget/101"));
        MarketWidgetConfigureActivity.InitialEditorState single =
            MarketWidgetConfigureActivity.initialEditorState(context, legacyEdit, 101, true);
        assertEquals(MarketWidgetStore.WATCHLIST, single.source);
        assertEquals(MarketWidgetStore.assets(context, 101, true).get(0).key(), single.assetKey);
        assertFalse(MarketWidgetStore.isConfigured(context, 101));
    }

    @Test
    public void launcherCreationStartsHotWithoutPersistingUntilConfirmation() throws Exception {
        MarketWidgetStore.setConfiguration(context, MarketWidgetData.defaults().json());
        Intent create = new Intent(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 102);
        MarketWidgetConfigureActivity.InitialEditorState initial =
            MarketWidgetConfigureActivity.initialEditorState(context, create, 102, true);
        assertEquals(MarketWidgetStore.HOT, initial.source);
        assertNull(initial.assetKey);
        assertFalse(MarketWidgetStore.isConfigured(context, 102));
        assertEquals(MarketWidgetStore.WATCHLIST, MarketWidgetStore.source(context, 102));
        MarketWidgetStore.configure(context, 102, MarketWidgetStore.WATCHLIST,
            MarketWidgetData.defaults().assets.get(1).key(), true);
        MarketWidgetConfigureActivity.InitialEditorState reconfigured =
            MarketWidgetConfigureActivity.initialEditorState(context, create, 102, true);
        assertEquals(MarketWidgetStore.WATCHLIST, reconfigured.source);
        assertEquals(MarketWidgetStore.assets(context, 102, true).get(0).key(), reconfigured.assetKey);
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

    @Test
    public void widgetResourcesFollowAppLanguageAndDistinguishTraditionalChinese() throws Exception {
        String[][] cases = {
            {"en-US", "Source", "Coin"},
            {"zh-CN", "来源", "币种"},
            {"zh-HK", "來源", "幣種"},
            {"zh-TW", "來源", "幣種"},
            {"de", "Quelle", "Coin"},
            {"id", "Sumber", "Koin"},
        };
        for (String[] item : cases) {
            JSONObject configuration = new JSONObject(MarketWidgetData.defaults().json()).put("locale", item[0]);
            MarketWidgetStore.setConfiguration(context, configuration.toString());
            Context localized = MarketWidgetStore.localized(context);
            assertEquals(item[0], item[1], localized.getString(R.string.market_widget_source));
            assertEquals(item[0], item[2], localized.getString(R.string.market_widget_coin));
        }
    }

    @Test
    public void translatedQuoteDescriptionsFormatEveryParameterWithoutDuplicatingCurrency() throws Exception {
        for (String language : new String[]{"bn", "de", "en-US", "es", "fr-FR", "hi-IN", "id", "it-IT",
            "ja-JP", "ko-KR", "pt", "pt-BR", "ru", "th-TH", "uk-UA", "vi", "zh-CN", "zh-HK", "zh-TW"}) {
            MarketWidgetStore.setConfiguration(context,
                new JSONObject(MarketWidgetData.defaults().json()).put("locale", language).toString());
            Context localized = MarketWidgetStore.localized(context);
            for (int template : new int[]{R.string.market_widget_quote_updated_at, R.string.market_widget_quote_cached_at}) {
                String label = localized.getString(template, "BTC", "123.45", "+1.25%", "12:34");
                assertTrue(language, label.contains("BTC"));
                assertTrue(language, label.contains("123.45"));
                assertTrue(language, label.contains("+1.25%"));
                assertTrue(language, label.contains("12:34"));
                assertFalse(language, label.contains("$s"));
                assertFalse(language, label.contains("{price}"));
            }
        }
        assertEquals("1,234.50", MarketWidgetProvider.price(new BigDecimal("1234.5"), Locale.US, false));
        assertEquals("1.234,50", MarketWidgetProvider.price(new BigDecimal("1234.5"), Locale.GERMANY, false));
        assertEquals("<0,000000000001", MarketWidgetProvider.price(new BigDecimal("1e-20"), Locale.GERMANY, false));
    }

    @Test
    public void hotAndWatchlistInstancesStayIndependentWhenRankingChanges() throws Exception {
        MarketWidgetData.Configuration defaults = MarketWidgetData.defaults();
        MarketWidgetStore.setConfiguration(context, defaults.json());
        MarketWidgetData.Asset first = token("evm--1", "0xabc");
        MarketWidgetData.Asset next = token("sol--101", "ABC");
        MarketWidgetStore.saveHot(context, java.util.Arrays.asList(first, next), 12345L);
        MarketWidgetStore.configure(context, 1, MarketWidgetStore.HOT, first.key(), true);
        MarketWidgetStore.configure(context, 2, MarketWidgetStore.WATCHLIST, defaults.assets.get(1).key(), true);
        MarketWidgetStore.configure(context, 3, MarketWidgetStore.HOT, null, false);
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(next), 23456L);
        assertEquals(first.key(), MarketWidgetStore.assets(context, 1, true).get(0).key());
        assertEquals("eth", MarketWidgetStore.assets(context, 2, true).get(0).assetId);
        assertEquals(next.key(), MarketWidgetStore.assets(context, 3, false).get(0).key());
        MarketWidgetStore.restoreWidget(context, 1, 11);
        assertEquals(MarketWidgetStore.HOT, MarketWidgetStore.source(context, 11));
        assertEquals(first.key(), MarketWidgetStore.assets(context, 11, true).get(0).key());
        assertFalse(MarketWidgetStore.isConfigured(context, 1));
    }

    @Test
    public void privacyMaskHidesBothSourcesAndRejectsInflightCacheWrites() throws Exception {
        MarketWidgetData.Asset asset = MarketWidgetData.defaults().assets.get(0);
        MarketWidgetData.Asset hot = token("evm--1", "0xabc");
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(hot), 12345L);
        MarketWidgetStore.configure(context, 2, MarketWidgetStore.HOT, hot.key(), true);
        MarketWidgetData.Quote quote = new MarketWidgetData.Quote(new BigDecimal("12"), null, "BTC", "Bitcoin", 12345L);
        MarketWidgetStore.saveQuote(context, asset, quote);
        MarketWidgetStore.saveQuote(context, hot, quote);
        MarketWidgetStore.setConfiguration(context, "{\"schemaVersion\":1,\"privacyMasked\":true,\"assets\":[]}");
        assertTrue(MarketWidgetStore.assets(context, 1, true).isEmpty());
        assertTrue(MarketWidgetStore.assets(context, 2, true).isEmpty());
        MarketWidgetStore.saveQuote(context, hot, quote);
        MarketWidgetStore.saveHot(context, java.util.Collections.singletonList(hot), 23456L);
        MarketWidgetStore.setConfiguration(context, MarketWidgetData.defaults().json());
        assertNull(MarketWidgetStore.quote(context, asset));
        assertNull(MarketWidgetStore.quote(context, hot));
        assertTrue(MarketWidgetStore.availableAssets(context, MarketWidgetStore.HOT).isEmpty());
    }

    @Test
    public void realTrendingIdentitiesAndIconsDoNotBecomeTopCoinDefaults() throws Exception {
        JSONObject envelope = new JSONObject("{\"code\":0,\"data\":["
            + "{\"network\":\"btc--0\",\"address\":\"\",\"isNative\":true,\"symbol\":\"BTC\","
            + "\"logoUrl\":\"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png?1\"},"
            + "{\"network\":\"sol--101\",\"address\":\"AbCd\",\"symbol\":\"MEME\"}]}");
        java.util.List<MarketWidgetData.Asset> trending = MarketWidgetClient.decodeHot(envelope);
        assertEquals(2, trending.size());
        assertEquals("token", trending.get(0).kind);
        assertEquals("btc--0", trending.get(0).chainId);
        assertTrue(trending.get(0).isNative);
        assertTrue(trending.get(0).iconUrl.endsWith("?1"));
        assertEquals("AbCd", trending.get(1).contractAddress);
        assertEquals("", MarketWidgetData.imageUrl("http://example.com/coin.png"));
        assertEquals("", MarketWidgetData.imageUrl("https://user:password@example.com/icon.png"));
    }

    @Test
    public void historyAcceptsNumbersAndScientificNotationButRejectsInsufficientOrStaleSeries() throws Exception {
        long fetchedAt = 1793260800000L;
        long now = fetchedAt / 1000;
        org.json.JSONArray points = new org.json.JSONArray();
        for (int index = 24; index >= 0; index--) {
            points.put(new JSONObject().put("t", now - index * 3600 - 28)
                .put("c", index % 2 == 0 ? "1.2e-5" : 0.000013));
        }
        MarketWidgetData.History history = MarketWidgetClient.decodeHistory(points, fetchedAt);
        assertEquals(25, history.prices.size());
        assertEquals(86400L, (long) history.times.get(24) - history.times.get(0));
        assertNotNull(MarketWidgetData.History.cached(history.json().toString()));
        try {
            MarketWidgetClient.decodeHistory(points, fetchedAt + 48 * 3600_000L);
            fail("Old data must not be relabeled as the last 24 hours");
        } catch (java.io.IOException expected) { }
        try {
            MarketWidgetClient.decodeHistory(new org.json.JSONArray().put(points.get(0)), fetchedAt);
            fail("A single quote must not become a fabricated chart");
        } catch (java.io.IOException expected) { }
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
