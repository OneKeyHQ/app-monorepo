package so.onekey.app.wallet.widget

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.widget.LinearLayoutCompat
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.widget.ViewPager2
import androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback
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
//        val event = Arguments.createMap()
//        event.putString("tabName", tabProps.name)
//        event.putInt("index", index)
//        val reactContext = context as ReactContext
//        reactContext
//            .getJSModule(RCTEventEmitter::class.java)
//            .receiveEvent(id, "tabPageChange", event)
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
        activeColor: String?,
        inactiveColor: String?,
        indicatorColor: String?,
        backgroundColor: String?,
        fontFamily: String?,
        fontWeight: String?,
        fontSize: Int?,
        lineHeight: Int?
    ) {
        val tabLayout = content.findViewById<SlidingTabLayout2>(R.id.layout_tab)

        tabLayout.isTabSpaceEqual = true
        tabLayout.indicatorColor = Color.parseColor(indicatorColor)

        tabLayout.background = GradientDrawable().also {
            it.cornerRadius = Utils.dp2px(tabLayout.context, 12F).toFloat()
            it.setColor(Color.parseColor(backgroundColor))
        }

        tabLayout.textUnselectColor = Color.parseColor(inactiveColor)
        tabLayout.textSelectColor = Color.parseColor(activeColor)

        tabLayout.textBold = 2 // TEXT_BOLD_BOTH
        tabLayout.textsize = fontSize?.toFloat() ?: 16f

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
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    private val measureAndLayout = Runnable {
        val adapter = content.findViewById<ViewPager2>(R.id.viewpager)?.adapter
        if (adapter is InnerPagerAdapter) {
            adapter.fragmentArrayList.forEach {
                if (it is ViewFragment) {
                    it.fixViewTop()
                }
            }
        }
    }
}