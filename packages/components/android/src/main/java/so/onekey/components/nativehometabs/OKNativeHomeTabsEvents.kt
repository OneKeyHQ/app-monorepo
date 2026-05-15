package so.onekey.components.nativehometabs

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OKHomeTabChangeEvent(
  surfaceId: Int,
  viewTag: Int,
  private val tabKey: String,
  private val source: String,
) : Event<OKHomeTabChangeEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("tabKey", tabKey)
      putString("source", source)
    }

  companion object {
    const val EVENT_NAME = "topTabChange"
  }
}

class OKHomeRefreshEvent(
  surfaceId: Int,
  viewTag: Int,
  private val tabKey: String,
) : Event<OKHomeRefreshEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("tabKey", tabKey)
    }

  companion object {
    const val EVENT_NAME = "topRefresh"
  }
}

class OKHomeEndReachedEvent(
  surfaceId: Int,
  viewTag: Int,
  private val tabKey: String,
  private val itemCount: Int,
) : Event<OKHomeEndReachedEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("tabKey", tabKey)
      putDouble("itemCount", itemCount.toDouble())
    }

  companion object {
    const val EVENT_NAME = "topEndReached"
  }
}

class OKHomeRowEvent(
  surfaceId: Int,
  viewTag: Int,
  private val emittedEventName: String,
  private val tabKey: String,
  private val rowKey: String,
  private val rowType: String,
  private val action: String?,
) : Event<OKHomeRowEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = emittedEventName

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("tabKey", tabKey)
      putString("rowKey", rowKey)
      putString("rowType", rowType)
      action?.let { putString("action", it) }
    }
}

class OKHomeVisibleRowsEvent(
  surfaceId: Int,
  viewTag: Int,
  private val tabKey: String,
  private val rowKeysJson: String,
) : Event<OKHomeVisibleRowsEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("tabKey", tabKey)
      putString("rowKeysJson", rowKeysJson)
    }

  companion object {
    const val EVENT_NAME = "topVisibleRowsChange"
  }
}

class OKHomeNativeErrorEvent(
  surfaceId: Int,
  viewTag: Int,
  private val code: String,
  private val message: String,
) : Event<OKHomeNativeErrorEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT_NAME

  override fun getEventData(): WritableMap =
    Arguments.createMap().apply {
      putString("code", code)
      putString("message", message)
    }

  companion object {
    const val EVENT_NAME = "topNativeError"
  }
}
