package com.margelo.nitro.onekeynativecomponents

import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

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
  }

  override val view: View = containerView

  override var initialSnapshotJson: String = ""
    set(value) {
      field = value
      if (value.isNotEmpty()) containerView.submitSnapshot(value)
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
      containerView.setRefreshEnabled(value != null)
    }
  override var onVisibleTabChange: ((tabId: String) -> Unit)? = null
  override var onRenderError: ((code: String, message: String) -> Unit)? = null

  override fun setSnapshot(snapshotJson: String) {
    containerView.submitSnapshot(snapshotJson)
  }

  override fun applyPatch(patchJson: String) {
    containerView.submitPatch(patchJson)
  }

  override fun completeRefresh(requestId: String) {
    containerView.completeRefresh(requestId)
  }

  override fun selectTab(tabId: String, animated: Boolean) {
    containerView.selectTab(tabId, animated)
  }

  override fun getCapabilities(): String =
    "{\"schemaVersions\":[1],\"tabIds\":[\"portfolio\",\"perps\",\"defi\",\"nft\",\"history\"],\"supportsPatches\":true,\"supportsAtomicPatches\":true,\"supportsNativeRefresh\":true,\"supportsHorizontalPaging\":true,\"supportsSlots\":true}"

  override fun dispose() {
    containerView.dispose()
  }
}
