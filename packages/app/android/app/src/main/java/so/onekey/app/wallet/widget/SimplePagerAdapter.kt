package so.onekey.app.wallet.widget

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.recyclerview.widget.RecyclerView
import kotlin.math.min

class SimplePagerAdapter(
    private val viewArrayList: MutableList<View> = arrayListOf(),
) : RecyclerView.Adapter<SimplePagerAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        return ViewHolder.create(parent)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val container: FrameLayout = holder.container
        viewArrayList.getOrNull(position).let {
            container.addView(it, 0)
        }
    }

    fun getPageView(position: Int): View? {
        return viewArrayList.getOrNull(position)
    }

    fun addPageView(pageView: View, position: Int? = -1) {
        if (position == null || position < 0) {
            viewArrayList.add(pageView)
            notifyItemChanged(min(viewArrayList.size - 1, 0))
        } else {
            viewArrayList.add(position, pageView)
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
                val container = NestedScrollableFrameLayout(parent.context)
                container.layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
                )
                container.isSaveEnabled = false
                return ViewHolder(container)
            }
        }
    }
}
