package so.onekey.app.wallet.viewManager.homePage

import android.view.View
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import javax.annotation.Nullable


class HomePageManager : ViewGroupManager<HomePageView>() {
    private val REACT_CLASS = "NestedTabView"

    private var height = 56;

    override fun getName() = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): HomePageView {
        return HomePageView(reactContext)
    }

    @ReactProp(name = "headerHeight")
    fun setHeaderHeight(view: HomePageView, @Nullable height: Int?) {
        height?.let { this.height = it }
    }

    override fun addView(parent: HomePageView?, child: View?, index: Int) {
        if (parent == null) return
        if (child == null) return

        if (index == 0) {
            parent.setHeaderView(child, this.height)
        } else {
            parent.setContentView(child)
        }
    }

    override fun addViews(parent: HomePageView?, views: MutableList<View>?) {
        if (parent == null) return

        views?.get(0)?.let { parent.setHeaderView(it, this.height) }
        views?.get(1)?.let { parent.setContentView(it) }
    }
}