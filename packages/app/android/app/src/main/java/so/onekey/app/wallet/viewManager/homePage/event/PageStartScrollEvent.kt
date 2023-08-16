package so.onekey.app.wallet.viewManager.homePage.event

import androidx.viewpager2.widget.ViewPager2
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event


class PageStartScrollEvent(
    surfaceId: Int,
    viewId: Int,
) :
    Event<PageStartScrollEvent>(surfaceId, viewId) {
    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getEventData(): WritableMap? {
        return Arguments.createMap()
    }

    companion object {
        const val EVENT_NAME = "onPageStartScroll"
    }
}