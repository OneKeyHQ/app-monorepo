package so.onekey.app.wallet.widget

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.widget.LinearLayoutCompat
import androidx.fragment.app.FragmentActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.ViewPager2
import androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.google.android.material.appbar.CollapsingToolbarLayout
import so.onekey.app.wallet.R
import so.onekey.app.wallet.utils.Utils
import so.onekey.app.wallet.viewManager.homePage.TabProps
import so.onekey.app.wallet.widget.SlidingTabLayout2.InnerPagerAdapter

open class HomePageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val mTabProps = mutableListOf<TabProps>()

    private val mPageChangeCallback = object : OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            super.onPageSelected(position)
            if (mTabProps.isNotEmpty() && position < mTabProps.size) {
                onReceiveNativeEvent(position, mTabProps[position])
            }
        }
    }

    private val content =
        LayoutInflater.from(context).inflate(R.layout.view_home_page, this, false).apply {
            addView(this)
        }

    fun onReceiveNativeEvent(index: Int, tabProps: TabProps) {
        val event = Arguments.createMap()
        event.putString("tabName", tabProps.name)
        event.putInt("index", index)
        val reactContext = context as ReactContext
        reactContext
            .getJSModule(RCTEventEmitter::class.java)
            .receiveEvent(id, "tabPageChange", event)
    }

    fun setHeaderView(view: View, height: Int) {
        val contentView = content.findViewById<CollapsingToolbarLayout>(R.id.toolbar)
        contentView.removeAllViews()

        val params = CollapsingToolbarLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            MeasureSpec.makeMeasureSpec(
                Utils.dp2px(view.context, height.toFloat()),
                MeasureSpec.EXACTLY
            )
        )
        params.collapseMode = CollapsingToolbarLayout.LayoutParams.COLLAPSE_MODE_PIN
        contentView.addView(view, params)
    }

    fun setEnableRefresh(enabled: Boolean) {
        content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
            it.isEnabled = enabled
        }
    }

    fun setRefresh(refresh: Boolean) {
        content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
            it.isRefreshing = refresh
        }
    }

    fun initRefreshListener() {
        content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
            it.setOnRefreshListener {
                val event = Arguments.createMap()
                event.putBoolean("refresh", true)
                val reactContext = context as ReactContext
                reactContext
                    .getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(id, "swipeRefreshChange", event)
            }
        }
    }

    fun setViewPager(
        fragmentActivity: FragmentActivity,
        fragments: List<ViewFragment>,
        titles: List<TabProps>
    ) {
        mTabProps.clear()
        mTabProps.addAll(titles)

        val tabLayout = content.findViewById<SlidingTabLayout2>(R.id.layout_tab)
        val viewpager = content.findViewById<ViewPager2>(R.id.viewpager)

        tabLayout.setViewPager(
            viewpager,
            titles.map { it.label }.toTypedArray(),
            fragmentActivity,
            fragments
        )

        viewpager.unregisterOnPageChangeCallback(mPageChangeCallback)
        viewpager.registerOnPageChangeCallback(mPageChangeCallback)
    }

    fun setScrollEnabled(enabled: Boolean) {
        content.findViewById<ViewPager2>(R.id.viewpager).isUserInputEnabled = enabled
    }

    fun updateTabsTitle(mTabs: MutableList<TabProps>) {
        if (mTabProps.isEmpty()) {
            return
        }
        content.findViewById<SlidingTabLayout2>(R.id.layout_tab)
            ?.updateTabsTitle(mTabs.map { it.label }.toTypedArray())
    }

    fun setTabViewStyle(
        paddingX: Int,
        tabHeight: Int,
        tabSpaceEqual: Boolean,
        activeLabelColor: String?,
        labelColor: String?,
        indicatorColor: String?,
        backgroundColor: String?,
        bottomLineColor: String?,
        fontFamily: String?,
        fontWeight: String?,
        fontSize: Int?,
        lineHeight: Int?
    ) {
        val tabLayout = content.findViewById<SlidingTabLayout2>(R.id.layout_tab)

        tabLayout.isTabSpaceEqual = tabSpaceEqual
        tabLayout.indicatorColor = Color.parseColor(indicatorColor)
        tabLayout.background = ColorDrawable(Color.parseColor(backgroundColor))

        tabLayout.textUnselectColor = Color.parseColor(labelColor)
        tabLayout.textSelectColor = Color.parseColor(activeLabelColor)

        fontSize?.toFloat()?.let {
            tabLayout.textsize = it
        }

        tabLayout.layoutParams = LinearLayoutCompat.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            MeasureSpec.makeMeasureSpec(
                Utils.dp2px(tabLayout.context, tabHeight.toFloat()),
                MeasureSpec.EXACTLY
            )
        ).also {
            it.marginStart = Utils.dp2px(tabLayout.context, paddingX.toFloat())
            it.marginEnd = Utils.dp2px(tabLayout.context, paddingX.toFloat())
        }

        val tabDividerView = content.findViewById<View>(R.id.view_tab_divider)
        if (bottomLineColor != null) {
            tabDividerView.visibility = View.VISIBLE
            tabDividerView.setBackgroundColor(Color.parseColor(bottomLineColor))
        } else {
            tabDividerView.visibility = View.GONE
        }
    }
}