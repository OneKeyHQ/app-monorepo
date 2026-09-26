package com.onekey.nativeoverlay

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class NativeOverlayPresentedEvent(
  surfaceId: Int,
  viewTag: Int,
  private val stackOrder: Int,
) : Event<NativeOverlayPresentedEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = "topPresented"

  override fun getEventData(): WritableMap = Arguments.createMap().apply {
    putInt("stackOrder", stackOrder)
  }
}

internal class NativeOverlayReasonEvent(
  surfaceId: Int,
  viewTag: Int,
  private val name: String,
  private val reason: String,
) : Event<NativeOverlayReasonEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = name

  // Every request / dismissal must reach JS; never coalesce them.
  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap = Arguments.createMap().apply {
    putString("reason", reason)
  }

  companion object {
    const val DISMISSED = "topDismissed"
    const val REQUEST_DISMISS = "topRequestDismiss"
  }
}
