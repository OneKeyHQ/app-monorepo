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
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.CompositePageTransformer
import androidx.viewpager2.widget.ViewPager2
import androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.CollapsingToolbarLayout
import so.onekey.app.wallet.R
import so.onekey.app.wallet.utils.Utils
import so.onekey.app.wallet.viewManager.homePage.TabProps


data class TabViewStyle(
    var paddingX: Int,
    var tabHeight: Int,
    var tabSpaceEqual: Boolean,
    var activeLabelColor: String?,
    var labelColor: String?,
    var indicatorColor: String?,
    var backgroundColor: String?,
    var fontSize: Int?
)

open class HomePageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val mTabProps = mutableListOf<TabProps>()
    private val mTabTitles = mutableListOf<String>()
    private var mTabTitlesChange = false

    private var mTabViewStyle: TabViewStyle? = null

    private var mRefreshEnabled = true
    private var mAppBarExtended = true
    private var mHeaderHeight = 56

    private val mPageChangeCallback = object : OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            super.onPageSelected(position)
            if (mTabProps.isNotEmpty() && position >= 0 && position < mTabProps.size) {
                onReceiveNativeEvent(position, mTabProps[position])
            }
        }
        override fun onPageScrollStateChanged(state: Int) {
            content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
                it.isEnabled = if (state == ViewPager2.SCROLL_STATE_IDLE) mRefreshEnabled && mAppBarExtended else false
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

    fun setHeaderHeight(height: Int) {
        mHeaderHeight = height
        val contentView = content.findViewById<CollapsingToolbarLayout>(R.id.toolbar)
        contentView.layoutParams.height = Utils.dp2px(context, height.toFloat())
        contentView.requestLayout()
    }

    fun getHeaderView(): View? {
        return content.findViewById<ViewGroup>(R.id.toolbar)?.getChildAt(0)
    }

    fun removeHeaderView() {
        content.findViewById<ViewGroup>(R.id.toolbar)?.removeAllViews()
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
        mRefreshEnabled = enabled
        content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
            it.isEnabled = mRefreshEnabled && mAppBarExtended
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

            content.findViewById<AppBarLayout>(R.id.appbar)
                ?.addOnOffsetChangedListener(object : AppBarLayout.OnOffsetChangedListener {
                    override fun onOffsetChanged(appBarLayout: AppBarLayout?, verticalOffset: Int) {
                        if (verticalOffset >= 0) {
                            mAppBarExtended = true
                        } else {
                            mAppBarExtended = false
                        }

                        it.isEnabled = mRefreshEnabled && mAppBarExtended
                    }
                })
        }
    }

    fun setTabs(tabProps: MutableList<TabProps>) {
        // diff tabProps mTabProps
        for (i in 0 until tabProps.size) {
            if (i < mTabProps.size) {
                if (mTabProps[i].label != tabProps[i].label) {
                    mTabTitlesChange = true
                }
            } else {
                mTabTitlesChange = true
            }
        }

        mTabProps.clear()
        mTabTitles.clear()
        mTabProps.addAll(tabProps)
        mTabTitles.addAll(tabProps.map { it.label })
    }

    fun setCurrentIndex(index: Int?) {
        // Finally set index
        post {
            index?.let {
                if(it >= mTabProps.size) return@post
                content.findViewById<ViewPager2>(R.id.viewpager)?.currentItem = it
            }
        }
    }

    fun getChildViewCount(): Int {
        val contentView = content.findViewById<CollapsingToolbarLayout>(R.id.toolbar)
        return (contentView?.childCount ?: 0) + (getAdapter()?.itemCount ?: 0)
    }

    fun getChildViewAt(index: Int): View? {
        if (index == 0) {
            val contentView = content.findViewById<CollapsingToolbarLayout>(R.id.toolbar)
            return contentView?.getChildAt(0)
        }
        return getAdapter()?.getFragment(index - 1)?.childView
    }

    fun addChildView(child: View?, index: Int) {
        if (child == null) return
        if (index == 0) {
            setHeaderView(child, this.mHeaderHeight)
        } else if (index <= mTabProps.size) {
            child.let {
                getAdapter()?.addFragment(ViewFragment(it), position = index - 1)
            }
        }
        requestLayout()
    }

    fun removeChildViewAt(index: Int) {
        if (index == 0) {
            removeHeaderView()
        } else if (index <= mTabProps.size) {
            getAdapter()?.removeFragmentAt(index - 1)
        }
    }

    fun removeChildView(view: View?) {
        if (getHeaderView() == view) {
            removeHeaderView()
        } else {
            getAdapter()?.removeFragment(view)
        }
    }

    fun getAdapter(): InnerPagerAdapter? {
        return content.findViewById<ViewPager2>(R.id.viewpager)?.adapter as InnerPagerAdapter?
    }

    fun setViewPager(fragmentActivity: FragmentActivity) {
        setViewPager(fragmentActivity, mTabTitles)
    }

    private fun setViewPager(
        fragmentActivity: FragmentActivity,
        titles: List<String>
    ): RecyclerView.Adapter<*> {
        val tabLayout = content.findViewById<SlidingTabLayout2>(R.id.layout_tab)
        val viewpager = content.findViewById<ViewPager2>(R.id.viewpager)

        val adapter = InnerPagerAdapter(fragmentActivity, fragmentActivity.lifecycle)
        viewpager.adapter = adapter
        // remove recyclerView add view animation
        viewpager.setPageTransformer(CompositePageTransformer())
        tabLayout.setViewPager(viewpager, titles)

        viewpager.unregisterOnPageChangeCallback(mPageChangeCallback)
        viewpager.registerOnPageChangeCallback(mPageChangeCallback)
        return adapter
    }

    fun setScrollEnabled(enabled: Boolean) {
        content.findViewById<ViewPager2>(R.id.viewpager).isUserInputEnabled = enabled
    }

    fun updateTabsTitle() {
        content.findViewById<SlidingTabLayout2>(R.id.layout_tab)?.let { tabView ->
            mTabViewStyle?.let { tabViewStyle ->
                tabView.isTabSpaceEqual = tabViewStyle.tabSpaceEqual
                tabView.indicatorColor = Color.parseColor(tabViewStyle.indicatorColor)
                tabView.background =
                    ColorDrawable(Color.parseColor(tabViewStyle.backgroundColor))

                tabView.textUnselectColor = Color.parseColor(tabViewStyle.labelColor)
                tabView.textSelectColor = Color.parseColor(tabViewStyle.activeLabelColor)

                tabViewStyle.fontSize?.toFloat()?.let {
                    tabView.textsize = it
                }

                tabView.layoutParams = LinearLayoutCompat.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    MeasureSpec.makeMeasureSpec(
                        Utils.dp2px(context, tabViewStyle.tabHeight.toFloat()),
                        MeasureSpec.EXACTLY
                    )
                ).also {
                    it.marginStart = Utils.dp2px(context, tabViewStyle.paddingX.toFloat())
                    it.marginEnd = Utils.dp2px(context, tabViewStyle.paddingX.toFloat())
                }
            }

            if (mTabTitlesChange) {
                mTabTitlesChange = false
                tabView.updateTabsTitle(mTabTitles.toTypedArray())
            }

            // Refresh when the main thread is busy
            tabView.post {
                tabView.updateTabStyles()
                tabView.invalidate()
            }
        }
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
        mTabViewStyle = TabViewStyle(
            paddingX,
            tabHeight,
            tabSpaceEqual,
            activeLabelColor,
            labelColor,
            indicatorColor,
            backgroundColor,
            fontSize,
        )

        val tabDividerView = content.findViewById<View>(R.id.view_tab_divider)
        if (bottomLineColor != null) {
            tabDividerView.visibility = View.VISIBLE
            tabDividerView.setBackgroundColor(Color.parseColor(bottomLineColor))
        } else {
            tabDividerView.visibility = View.GONE
        }
    }
}