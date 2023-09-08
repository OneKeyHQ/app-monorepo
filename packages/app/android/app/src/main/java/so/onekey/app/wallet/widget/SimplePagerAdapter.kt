package so.onekey.app.wallet.widget

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.widget.NestedScrollView
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.views.scroll.ReactScrollView
import kotlin.math.min

class SimplePagerAdapter(
    private val viewArrayList: MutableList<View> = arrayListOf(),
) : RecyclerView.Adapter<SimplePagerAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        return ViewHolder.create(parent)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val container: FrameLayout = holder.container
        viewArrayList.getOrNull(position)?.let {
            if (container.childCount > 0) {
                container.removeAllViews()
            }

            if (it.parent != null) {
                (it.parent as FrameLayout).removeView(it)
            }

            container.addView(it, 0)
        }
    }

    fun getPageView(position: Int): View? {
        return viewArrayList.getOrNull(position)
    }

    private fun replaceScrollView(view: View): View {
        // If the view itself is a ScrollView
        if (view is ReactScrollView) {
            val nestedScrollView = PageNestedScrollView(view.context)
            nestedScrollView.layoutParams = view.layoutParams ?: ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            )

            // Transfer all children from the ScrollView to the NestedScrollView
            while (view.childCount > 0) {
                val child = view.getChildAt(0)
                view.removeViewAt(0)
                nestedScrollView.addView(child)
            }

            return nestedScrollView
        }

        // If the view is a ViewGroup, check its children
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                if (child is ReactScrollView) {
                    // Create a new NestedScrollView and configure it as needed
                    val nestedScrollView = NestedScrollView(view.context)
                    nestedScrollView.layoutParams = child.layoutParams ?: ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    // Transfer all children from the ScrollView to the NestedScrollView
                    while (child.childCount > 0) {
                        val innerChild = child.getChildAt(0)
                        child.removeViewAt(0)
                        nestedScrollView.addView(innerChild)
                    }

                    // Replace the ScrollView with the NestedScrollView in the ViewGroup
                    view.removeViewAt(i)
                    view.addView(nestedScrollView, i)

                    // Since we found and replaced the ScrollView, we can exit the loop
                    break
                }
            }
        }

        return view
    }


    fun addPageView(pageView: View, position: Int? = -1) {
        val newParent = replaceScrollView(pageView)

        if (position == null || position < 0) {
            viewArrayList.add(newParent)
            notifyItemChanged(min(viewArrayList.size - 1, 0))
        } else {
            viewArrayList.add(position, newParent)
            notifyItemChanged(position)
        }
    }

    fun removePageViewAt(position: Int) {
        if (viewArrayList.size > position) {
            viewArrayList.removeAt(position)
            notifyItemChanged(position)
        }
    }

    fun removePageView(view: View?) {
        val index = viewArrayList.indexOfFirst { it == view }
        if (index != -1) {
            removePageViewAt(index)
        }
    }

    override fun getItemCount() = viewArrayList.size

    class ViewHolder(container: FrameLayout) : RecyclerView.ViewHolder(container) {
        val container: FrameLayout
            get() = itemView as FrameLayout

        companion object {
            fun create(parent: ViewGroup): ViewHolder {
                val container = FrameLayout(parent.context)
                container.layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
                )
                container.isSaveEnabled = false
                return ViewHolder(container)
            }
        }
    }
}
