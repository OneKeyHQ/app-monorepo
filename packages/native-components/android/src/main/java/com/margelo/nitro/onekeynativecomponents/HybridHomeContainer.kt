package com.margelo.nitro.onekeynativecomponents

import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

internal fun homeContainerShouldSubmitInitialSnapshot(
  current: String,
  next: String,
): Boolean = next.isNotEmpty() && current != next

@DoNotStrip
class HybridHomeContainer(context: ThemedReactContext) : HybridHomeContainerSpec() {
  private val containerView = HomeContainerView(context).apply {
    onAction = { actionId, itemId, tabId ->
      this@HybridHomeContainer.onAction?.invoke(actionId, itemId, tabId)
    }
    onRefresh = { tabId, requestId ->
      this@HybridHomeContainer.onRefresh?.invoke(tabId, requestId)
    }
    onVisibleTabChange = { tabId ->
      this@HybridHomeContainer.onVisibleTabChange?.invoke(tabId)
    }
    onRenderError = { code, message ->
      this@HybridHomeContainer.onRenderError?.invoke(code, message)
    }
    onIntent = { intentJson ->
      this@HybridHomeContainer.onIntent?.invoke(intentJson)
    }
  }

  override val view: View = containerView

  override var initialSnapshotJson: String = ""
    set(value) {
      val shouldSubmit = homeContainerShouldSubmitInitialSnapshot(field, value)
      field = value
      if (shouldSubmit) containerView.submitInitialSnapshot(value)
    }

  override var backgroundColor: String = "#FFFFFF"
    set(value) {
      field = value
      containerView.setFallbackBackgroundColor(value)
    }

  override var debugOverlayEnabled: Boolean = false
    set(value) {
      field = value
      containerView.setDebugOverlayEnabled(value)
    }

  override var onAction: ((actionId: String, itemId: String, tabId: String) -> Unit)? = null
  override var onRefresh: ((tabId: String, requestId: String) -> Unit)? = null
    set(value) {
      field = value
      updateRefreshAvailability()
    }
  override var onVisibleTabChange: ((tabId: String) -> Unit)? = null
  override var onRenderError: ((code: String, message: String) -> Unit)? = null
  override var onIntent: ((intentJson: String) -> Unit)? = null
    set(value) {
      field = value
      updateRefreshAvailability()
    }
  override fun setSnapshot(snapshotJson: String) {
    containerView.submitSnapshot(snapshotJson)
  }

  override fun setDomains(domainsJson: String) {
    containerView.submitDomains(domainsJson)
  }

  override fun completeRefresh(requestId: String) {
    containerView.completeRefresh(requestId)
  }

  override fun selectTab(tabId: String, animated: Boolean) {
    containerView.selectTab(tabId, animated)
  }

  override fun getCapabilities(): String =
    "{\"schemaVersions\":[2],\"protocolVersion\":3," +
      "\"tabIds\":[\"portfolio\",\"perps\",\"defi\",\"nft\",\"history\"]," +
      "\"supportsNativeRefresh\":true,\"supportsHorizontalPaging\":true," +
      "\"supportsSlots\":true}"

  private fun updateRefreshAvailability() {
    containerView.setRefreshEnabled(onRefresh != null || onIntent != null)
  }

  override fun dispose() {
    containerView.dispose()
  }
}
