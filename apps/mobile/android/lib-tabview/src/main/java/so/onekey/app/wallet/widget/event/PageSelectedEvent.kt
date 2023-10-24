package so.onekey.app.wallet.widget.event

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class PageSelectedEvent(
    surfaceId: Int,
    viewId: Int,
    private val mIndex: Int,
    private val mTabName: String
) : Event<PageSelectedEvent>(surfaceId, viewId) {
    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getEventData(): WritableMap? {
        val eventData = Arguments.createMap()
        eventData.putString("tabName", mTabName)
        eventData.putInt("index", mIndex)
        return eventData
    }

    override fun canCoalesce(): Boolean {
        return false
    }

    companion object {
        const val EVENT_NAME = "onPageChange"
    }
}