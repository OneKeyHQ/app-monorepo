package so.onekey.app.wallet.viewManager.homePage

import android.util.Log
import android.view.View
import androidx.fragment.app.FragmentActivity
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.th3rdwave.safeareacontext.getReactContext
import so.onekey.app.wallet.extensions.getBooleanOrNull
import so.onekey.app.wallet.extensions.getIntOrNull
import so.onekey.app.wallet.extensions.getStringOrNull
import so.onekey.app.wallet.widget.ViewFragment
import javax.annotation.Nullable


data class TabProps(
    var name: String,
    var label: String,
)

class HomePageManager : ViewGroupManager<HomePageView>() {
    private val REACT_CLASS = "NestedTabView"

    private var height = 56;

    override fun getName() = REACT_CLASS

    private val mTabs = mutableListOf<TabProps>()
    private val mFragments = ArrayList<ViewFragment>()
    private var mAdapter: RecyclerView.Adapter<*>? = null

    override fun createViewInstance(reactContext: ThemedReactContext): HomePageView {
        Log.d("HomePageManager", "createViewInstance")
        return HomePageView(reactContext).also {
            mAdapter = it.setViewPager(
                (getReactContext(it).currentActivity as FragmentActivity),
                mFragments,
                mTabs
            )
        }
    }

    override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> {
        return mapOf(
            "tabPageChange" to mapOf(
                "phasedRegistrationNames" to mapOf(
                    "bubbled" to "onChange"
                )
            ),
            "swipeRefreshChange" to mapOf(
                "phasedRegistrationNames" to mapOf(
                    "bubbled" to "onRefreshCallBack"
                )
            )
        )
    }

    @ReactProp(name = "headerHeight")
    fun setHeaderHeight(view: HomePageView, @Nullable height: Int?) {
        height?.let { this.height = it }
    }

    @ReactProp(name = "disableRefresh")
    fun setDisableRefresh(view: HomePageView, enable: Boolean) {
        view.setEnableRefresh(!enable)
    }

    @ReactProp(name = "refresh")
    fun setRefresh(view: HomePageView, refresh: Boolean) {
        view.setRefresh(refresh)
    }

    @ReactProp(name = "scrollEnabled")
    fun setScrollEnabled(view: HomePageView, @Nullable enable: Boolean?) {
        view.setScrollEnabled(enable ?: false)
    }

    @ReactProp(name = "tabViewStyle")
    fun setTabViewStyle(view: HomePageView?, style: ReadableMap?) {
        style?.apply {
            val paddingX = getIntOrNull("paddingX") ?: 0
            val tabHeight = getInt("height")

            val activeLabelColor = getString("activeLabelColor")
            val labelColor = getString("labelColor")

            val tabSpaceEqual = getBooleanOrNull("tabSpaceEqual") ?: true
            val indicatorColor = getString("indicatorColor")
            val backgroundColor = getString("backgroundColor")
            val bottomLineColor = getStringOrNull("bottomLineColor")

            val labelStyle = getMap("labelStyle")
            val fontFamily = labelStyle?.getString("fontFamily")
            val fontWeight = labelStyle?.getString("fontWeight")
            val fontSize = labelStyle?.getInt("fontSize")
            val lineHeight = labelStyle?.getInt("lineHeight")

            view?.setTabViewStyle(
                paddingX,
                tabHeight,
                tabSpaceEqual,
                activeLabelColor,
                labelColor,
                indicatorColor,
                backgroundColor,
                bottomLineColor,
                fontFamily,
                fontWeight,
                fontSize,
                lineHeight
            )
        }
    }

    @ReactProp(name = "values")
    fun setTabs(view: HomePageView, @Nullable tabs: ReadableArray?) {
        mTabs.clear()
        tabs?.let {
            val list = mutableListOf<TabProps>()
            for (i in 0 until tabs.size()) {

                val tab = tabs.getMap(i)
                val name = tab.getString("name")
                val label = tab.getString("label")

                if (name != null && label != null) {
                    mTabs.add(TabProps(name, label))
                }
            }
        }
    }

    override fun getChildCount(parent: HomePageView): Int {
        // harderView and tabViews
        return 1 + mFragments.size
    }

    override fun getChildAt(parent: HomePageView?, index: Int): View {
        return if (index == 0) {
            parent?.getHeaderView()!!
        } else {
            mFragments[index - 1].childView
        }
    }

    override fun onAfterUpdateTransaction(view: HomePageView) {
        super.onAfterUpdateTransaction(view)
        view.updateTabsTitle(mTabs)
    }

    override fun addView(parent: HomePageView?, child: View?, index: Int) {
        if (parent == null) return
        if (child == null) return
        if (index == 0) {
            mFragments.clear()
            parent.setHeaderView(child, this.height)
        } else if (index <= mTabs.size) {
            child.let {
                mFragments.add(index - 1, ViewFragment(it))
            }

            parent.updateTabsTitle(mTabs)
            parent.post {
                mAdapter?.notifyItemChanged(index - 1)
            }
        }
        parent.requestLayout()
    }

    override fun addViews(parent: HomePageView?, views: MutableList<View>?) {
        if (parent == null) return
        views?.forEachIndexed { index, view ->
            addView(parent, view, index)
        }
    }

    override fun removeViewAt(parent: HomePageView?, index: Int) {
        if (parent == null) return
        if (index == 0) {
            parent.setHeaderView(View(parent.context), 0)
        } else if (index <= mTabs.size) {
            mFragments.removeAt(index - 1)
            if (index == mTabs.size) {
                parent.setViewPager(
                    (getReactContext(parent).currentActivity as FragmentActivity),
                    mFragments,
                    mTabs
                )
            }
        }
    }

    override fun needsCustomLayoutForChildren(): Boolean {
        return true
    }

}