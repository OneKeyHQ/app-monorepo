package com.margelo.nitro.onekeynativecomponents

import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

internal fun homeContainerShouldSubmitInitialState(
  current: String,
  next: String,
): Boolean = next.isNotEmpty() && current != next

@DoNotStrip
class HybridHomeContainer(context: ThemedReactContext) : HybridHomeContainerSpec() {
  private val containerView = HomeContainerView(context).apply {
    onRenderError = { code, message ->
      this@HybridHomeContainer.onRenderError?.invoke(code, message)
    }
    onIntent = { intentJson ->
      this@HybridHomeContainer.onIntent?.invoke(intentJson)
    }
  }

  override val view: View = containerView

  override var initialStateJson: String = ""
    set(value) {
      val shouldSubmit = homeContainerShouldSubmitInitialState(field, value)
      field = value
      if (shouldSubmit) containerView.submitInitialState(value)
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

  override var onRenderError: ((code: String, message: String) -> Unit)? = null
  override var onIntent: ((intentJson: String) -> Unit)? = null
    set(value) {
      field = value
      updateRefreshAvailability()
    }
  override fun setState(stateJson: String) {
    containerView.submitState(stateJson)
  }

  override fun completeRefresh(requestId: String) {
    containerView.completeRefresh(requestId)
  }

  override fun selectTab(tabId: String, animated: Boolean) {
    containerView.selectTab(tabId, animated)
  }

  private fun updateRefreshAvailability() {
    containerView.setRefreshEnabled(onIntent != null)
  }

  override fun dispose() {
    containerView.dispose()
  }
}
