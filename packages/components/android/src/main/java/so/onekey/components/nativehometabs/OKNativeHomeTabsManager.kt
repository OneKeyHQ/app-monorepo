package so.onekey.components.nativehometabs

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.OKNativeHomeTabsManagerDelegate
import com.facebook.react.viewmanagers.OKNativeHomeTabsManagerInterface

@ReactModule(name = OKNativeHomeTabsManager.NAME)
class OKNativeHomeTabsManager(
  @Suppress("UNUSED_PARAMETER") context: ReactApplicationContext,
) : ViewGroupManager<OKNativeHomeTabsView>(),
  OKNativeHomeTabsManagerInterface<OKNativeHomeTabsView> {
  private val delegate:
    OKNativeHomeTabsManagerDelegate<OKNativeHomeTabsView, OKNativeHomeTabsManager> =
    OKNativeHomeTabsManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate():
    ViewManagerDelegate<OKNativeHomeTabsView> = delegate

  override fun createViewInstance(context: ThemedReactContext): OKNativeHomeTabsView {
    val view = OKNativeHomeTabsView(context)
    val surfaceId = UIManagerHelper.getSurfaceId(context)
    view.onTabChange = { tabKey, source ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(OKHomeTabChangeEvent(surfaceId, view.id, tabKey, source))
    }
    view.onRefresh = { tabKey ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(OKHomeRefreshEvent(surfaceId, view.id, tabKey))
    }
    view.onEndReached = { tabKey, itemCount ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(
          OKHomeEndReachedEvent(surfaceId, view.id, tabKey, itemCount),
        )
    }
    view.onRowPress = { tabKey, rowKey, rowType ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(
          OKHomeRowEvent(
            surfaceId,
            view.id,
            "topRowPress",
            tabKey,
            rowKey,
            rowType,
            null,
          ),
        )
    }
    view.onRowAction = { tabKey, rowKey, rowType, action ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(
          OKHomeRowEvent(
            surfaceId,
            view.id,
            "topRowAction",
            tabKey,
            rowKey,
            rowType,
            action,
          ),
        )
    }
    view.onVisibleRowsChange = { tabKey, rowKeysJson ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(
          OKHomeVisibleRowsEvent(surfaceId, view.id, tabKey, rowKeysJson),
        )
    }
    view.onNativeError = { code, message ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        ?.dispatchEvent(OKHomeNativeErrorEvent(surfaceId, view.id, code, message))
    }
    return view
  }

  override fun receiveCommand(
    root: OKNativeHomeTabsView,
    commandId: String,
    args: ReadableArray?,
  ) {
    delegate.receiveCommand(root, commandId, args)
  }

  override fun addView(parent: OKNativeHomeTabsView, child: View, index: Int) {
    parent.addReactChild(child, index)
  }

  override fun getChildCount(parent: OKNativeHomeTabsView): Int =
    parent.getReactChildCount()

  override fun getChildAt(parent: OKNativeHomeTabsView, index: Int): View? =
    parent.getReactChildAt(index)

  override fun removeView(parent: OKNativeHomeTabsView, view: View) {
    parent.removeReactChild(view)
  }

  override fun removeViewAt(parent: OKNativeHomeTabsView, index: Int) {
    parent.removeReactChildAt(index)
  }

  override fun removeAllViews(parent: OKNativeHomeTabsView) {
    while (parent.getReactChildCount() > 0) {
      parent.removeReactChildAt(0)
    }
  }

  override fun needsCustomLayoutForChildren(): Boolean = true

  override fun setSchemaJson(view: OKNativeHomeTabsView?, value: String?) {
    view?.setSchemaJson(value)
  }

  override fun setTopInset(view: OKNativeHomeTabsView?, value: Double) {
    view?.setTopInset(value)
  }

  override fun setBottomInset(view: OKNativeHomeTabsView?, value: Double) {
    view?.setBottomInset(value)
  }

  override fun setInitialHeaderHeight(view: OKNativeHomeTabsView?, value: Double) {
    view?.setInitialHeaderHeight(value)
  }

  override fun setEnableHorizontalSwipe(view: OKNativeHomeTabsView?, value: Boolean) {
    view?.setEnableHorizontalSwipe(value)
  }

  override fun scrollToTop(
    view: OKNativeHomeTabsView?,
    tabKey: String?,
    animated: Boolean,
  ) {
    view?.scrollToTop(tabKey.orEmpty(), animated)
  }

  override fun switchTab(
    view: OKNativeHomeTabsView?,
    tabKey: String?,
    animated: Boolean,
  ) {
    view?.switchTab(tabKey.orEmpty(), animated)
  }

  override fun applyPatch(view: OKNativeHomeTabsView?, patchJson: String?) {
    view?.applyPatch(patchJson)
  }

  override fun endRefreshing(view: OKNativeHomeTabsView?, tabKey: String?) {
    view?.endRefreshing(tabKey.orEmpty())
  }

  override fun getExportedCustomDirectEventTypeConstants():
    MutableMap<String, Map<String, String>> =
    mutableMapOf(
      OKHomeTabChangeEvent.EVENT_NAME to mapOf("registrationName" to "onTabChange"),
      OKHomeRefreshEvent.EVENT_NAME to mapOf("registrationName" to "onRefresh"),
      OKHomeEndReachedEvent.EVENT_NAME to mapOf(
        "registrationName" to "onEndReached",
      ),
      "topRowPress" to mapOf("registrationName" to "onRowPress"),
      "topRowAction" to mapOf("registrationName" to "onRowAction"),
      OKHomeVisibleRowsEvent.EVENT_NAME to mapOf(
        "registrationName" to "onVisibleRowsChange",
      ),
      OKHomeNativeErrorEvent.EVENT_NAME to mapOf(
        "registrationName" to "onNativeError",
      ),
    )

  companion object {
    const val NAME = "OKNativeHomeTabs"
  }
}
