package so.onekey.app.wallet.viewManager.homePage.event

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class SwipeRefreshEvent(
    surfaceId: Int,
    viewId: Int,
    private val mRefreshing: Boolean,
) : Event<SwipeRefreshEvent>(surfaceId, viewId) {
    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getEventData(): WritableMap? {
        val eventData = Arguments.createMap()
        eventData.putBoolean("refresh", mRefreshing)
        return eventData
    }

    companion object {
        const val EVENT_NAME = "onSwipeRefresh"
    }
}