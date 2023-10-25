package so.onekey.app.wallet.widget.event

import androidx.viewpager2.widget.ViewPager2
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event


enum class PageScrollState(val state: String) {
    IDLE("idle"),
    DRAGGING("dragging"),
    SETTLING("settling")
}

class PageScrollStateChangeEvent(
    surfaceId: Int,
    viewId: Int,
    private val mState: PageScrollState
) : Event<PageScrollStateChangeEvent>(surfaceId, viewId) {
    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getEventData(): WritableMap? {
        val eventData = Arguments.createMap()
        eventData.putString("state", mState.state)
        return eventData
    }

    companion object {
        const val EVENT_NAME = "onPageScrollStateChange"

        fun stateToPageScrollState(state: Int): PageScrollState {
            return when (state) {
                ViewPager2.SCROLL_STATE_IDLE -> PageScrollState.IDLE
                ViewPager2.SCROLL_STATE_DRAGGING -> PageScrollState.DRAGGING
                ViewPager2.SCROLL_STATE_SETTLING -> PageScrollState.SETTLING
                else -> throw IllegalArgumentException("Unknown state: $state")
            }
        }
    }
}