package so.onekey.app.wallet.widget

import android.annotation.SuppressLint
import android.content.Context

import android.graphics.drawable.ColorDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.widget.LinearLayoutCompat
import androidx.coordinatorlayout.widget.CoordinatorLayout
import androidx.fragment.app.FragmentActivity
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.CompositePageTransformer
import androidx.viewpager2.widget.ViewPager2
import androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.UIManagerModule
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.CollapsingToolbarLayout
import so.onekey.app.wallet.widget.event.PageScrollStateChangeEvent
import so.onekey.app.wallet.widget.event.PageSelectedEvent
import so.onekey.app.wallet.widget.event.SwipeRefreshEvent
import so.onekey.app.wallet.widget.tabBar.SlidingTabLayout2
import so.onekey.app.wallet.widget.utils.SizeUtils
import so.onekey.app.wallet.widget.utils.parseColor


data class TabViewStyle(
    var paddingX: Int,
    var paddingY: Int,
    var itemPaddingX: Int,
    var itemPaddingY: Int,
    var tabHeight: Int?,
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
    private var mHeaderHeight = 0

    val currentIndex: Int get() = viewpager.currentItem

    val eventDispatcher =
        (context as ReactContext).getNativeModule(UIManagerModule::class.java)?.eventDispatcher

    private val mPageChangeCallback = object : OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            super.onPageSelected(position)

            if (mTabProps.isNotEmpty() && position >= 0 && position < mTabProps.size) {
                sendChangeTabsNativeEvent(position, mTabProps[position])
            }
        }

        override fun onPageScrollStateChanged(state: Int) {
            content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)?.let {
                it.isEnabled =
                    if (state == ViewPager2.SCROLL_STATE_IDLE) mRefreshEnabled && mAppBarExtended else false
            }

            eventDispatcher?.dispatchEvent(
                PageScrollStateChangeEvent(
                    UIManagerHelper.getSurfaceId(context),
                    id,
                    PageScrollStateChangeEvent.stateToPageScrollState(state)
                )
            )
        }
    }

    private val content by lazy {
        LayoutInflater.from(context).inflate(R.layout.view_home_page, this, false).apply {
            addView(this)
        }
    }

    private val child: View? get() = if (childCount > 0) getChildAt(0) else null

    private val viewpager by lazy {
        content.findViewById<ViewPager2>(R.id.viewpager)
    }

    private val coordinatorLayout by lazy {
        content.findViewById<CoordinatorLayout>(R.id.coordinator)
    }

    private val toolbar by lazy {
        content.findViewById<CollapsingToolbarLayout>(R.id.toolbar)
    }

    private val slidingTabBar by lazy {
        content.findViewById<LinearLayoutCompat>(R.id.content)
    }

    private val appBarLayout by lazy {
        content.findViewById<AppBarLayout>(R.id.appbar)
    }

    private val layoutRefresh by lazy {
        content.findViewById<SwipeRefreshLayout>(R.id.layout_refresh)
    }

    private val tabLayout by lazy { content.findViewById<SlidingTabLayout2>(R.id.layout_tab) }

    fun sendChangeTabsNativeEvent(index: Int, tabProps: TabProps) {
        eventDispatcher?.dispatchEvent(
            PageSelectedEvent(UIManagerHelper.getSurfaceId(context), id, index, tabProps.name)
        )
    }

    fun setHeaderHeight(height: Int) {
        if (height == mHeaderHeight) return
        mHeaderHeight = height
        toolbar.layoutParams.height = SizeUtils.dp2px(context, height.toFloat())
        toolbar.requestLayout()
        viewpager.requestLayout()
    }

    fun getHeaderView(): View? {
        return toolbar?.getChildAt(0)
    }

    fun removeHeaderView() {
        toolbar?.removeAllViews()
    }

    fun setHeaderView(view: View) {
        toolbar.removeAllViews()

        val params = CollapsingToolbarLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        )
        params.collapseMode = CollapsingToolbarLayout.LayoutParams.COLLAPSE_MODE_PIN
        toolbar.addView(view, params)
    }

    fun setEnableRefresh(enabled: Boolean) {
        mRefreshEnabled = enabled
        layoutRefresh?.let {
            it.isEnabled = mRefreshEnabled && mAppBarExtended
        }
    }

    fun setRefresh(refresh: Boolean) {
        layoutRefresh?.let {
            it.isRefreshing = refresh
        }
    }

    fun initRefreshListener() {
        layoutRefresh?.let {
            it.setOnRefreshListener {
                it.isRefreshing = true

                val reactContext = context as ReactContext
                UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
                    SwipeRefreshEvent(UIManagerHelper.getSurfaceId(reactContext), id, true)
                )
            }

            appBarLayout
                ?.addOnOffsetChangedListener { _, verticalOffset ->
                    mAppBarExtended = verticalOffset >= 0
                    it.isEnabled = mRefreshEnabled && mAppBarExtended
                }
        }
    }

    fun setTabs(tabProps: MutableList<TabProps>) {
        // diff tabProps mTabProps
        if(tabProps.size != mTabProps.size) {
            mTabTitlesChange = true
        } else {
            for (i in 0 until tabProps.size) {
                if (i < mTabProps.size) {
                    if (mTabProps[i].label != tabProps[i].label) {
                        mTabTitlesChange = true
                    }
                } else {
                    mTabTitlesChange = true
                }
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
                if (it >= mTabProps.size) return@post
                if (viewpager?.currentItem != it) {
                    viewpager?.currentItem = it
                }
            }
        }
    }

    fun setSlideDisable(disable: Boolean?) {
        post {
            viewpager?.isUserInputEnabled = if (disable == null) true else !disable
        }
    }

    fun getChildViewCount(): Int {
        return (toolbar?.childCount ?: 0) + (getAdapter()?.itemCount ?: 0)
    }

    fun getChildViewAt(index: Int): View? {
        if (index == 0) {
            return toolbar?.getChildAt(0)
        }
        return getAdapter()?.getPageView(index - 1)
    }

    fun addChildView(child: View?, index: Int) {
        if (child == null) return
        if (index == 0) {
            val newView = PageHeaderView(context).also {
                child.layoutParams =
                    LayoutParams(LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                it.layoutParams = LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                it.addView(child, 0)
            }

            setHeaderView(newView)
        } else {
            child.let {
                getAdapter()?.addPageView(it, position = index - 1)
            }
        }
    }

    fun removeChildViewAt(index: Int) {
        if (index == 0) {
            removeHeaderView()
        } else if (index <= mTabProps.size) {
            getAdapter()?.removePageViewAt(index - 1)
        }
    }

    fun removeChildView(view: View?) {
        if (getHeaderView() == view) {
            removeHeaderView()
        } else {
            getAdapter()?.removePageView(view)
        }
    }

    fun getAdapter(): SimplePagerAdapter? {
        return viewpager?.adapter as SimplePagerAdapter?
    }

    fun setViewPager(fragmentActivity: FragmentActivity) {
        setViewPager(fragmentActivity, mTabTitles)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setViewPager(
        fragmentActivity: FragmentActivity, titles: List<String>
    ): RecyclerView.Adapter<*> {
        val adapter = SimplePagerAdapter()
        viewpager.adapter = adapter
        // remove recyclerView add view animation
        viewpager.setPageTransformer(CompositePageTransformer())
        tabLayout.setViewPager(viewpager, titles)

        viewpager.unregisterOnPageChangeCallback(mPageChangeCallback)
        viewpager.registerOnPageChangeCallback(mPageChangeCallback)
        return adapter
    }

    fun setScrollEnabled(enabled: Boolean) {
        viewpager.isUserInputEnabled = enabled
    }

    fun setSpinnerColor(spinnerColor: String?) {
        tabLayout?.let {
            spinnerColor?.let { color ->
                layoutRefresh.setColorSchemeColors(parseColor(color))
            }
        }
    }

    fun updateTabsTitle() {
        tabLayout?.let { tabView ->
            mTabViewStyle?.let { tabViewStyle ->
                tabView.setIndicatorWidthEqualTitle(true)

                tabView.isTabSpaceEqual = tabViewStyle.tabSpaceEqual
                tabView.indicatorColor = parseColor(tabViewStyle.indicatorColor)
                tabView.background = ColorDrawable(parseColor(tabViewStyle.backgroundColor))

                tabView.textUnselectColor = parseColor(tabViewStyle.labelColor)
                tabView.textSelectColor = parseColor(tabViewStyle.activeLabelColor)

                tabViewStyle.fontSize?.toFloat()?.let {
                    tabView.textsize = it
                }

                tabView.layoutParams = if (tabViewStyle.tabHeight != null) {
                    LinearLayoutCompat.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, MeasureSpec.makeMeasureSpec(
                            SizeUtils.dp2px(context, tabViewStyle.tabHeight?.toFloat()),
                            MeasureSpec.EXACTLY
                        )
                    )
                } else {
                    LinearLayoutCompat.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                }.also {
                    it.setMargins(
                        tabViewStyle.paddingX,
                        tabViewStyle.paddingY,
                        tabViewStyle.paddingX,
                        tabViewStyle.paddingY,
                    )
                }
                tabView.tabPadding = tabViewStyle.itemPaddingX.toFloat()
                tabView.setTabVerticalPadding(tabViewStyle.itemPaddingY.toFloat())
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
        paddingY: Int,
        itemPaddingX: Int,
        itemPaddingY: Int,
        tabHeight: Int?,
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
            paddingX = paddingX,
            paddingY = paddingY,
            itemPaddingX = itemPaddingX,
            itemPaddingY = itemPaddingY,
            tabHeight = tabHeight,
            tabSpaceEqual = tabSpaceEqual,
            activeLabelColor = activeLabelColor,
            labelColor = labelColor,
            indicatorColor = indicatorColor,
            backgroundColor = backgroundColor,
            fontSize = fontSize,
        )

        val tabDividerView = content.findViewById<View>(R.id.view_tab_divider)
        if (bottomLineColor != null) {
            tabDividerView.visibility = View.VISIBLE
            tabDividerView.setBackgroundColor(parseColor(bottomLineColor))
        } else {
            tabDividerView.visibility = View.GONE
        }
    }
}