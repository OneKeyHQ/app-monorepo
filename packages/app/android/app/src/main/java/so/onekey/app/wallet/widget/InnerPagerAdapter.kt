package so.onekey.app.wallet.widget

import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.viewpager2.adapter.FragmentStateAdapter
import kotlin.math.min

class InnerPagerAdapter constructor(
    fragmentActivity: FragmentActivity,
    lifecycle: Lifecycle,
    private val fragmentArrayList: MutableList<ViewFragment> = arrayListOf(),
) : FragmentStateAdapter(fragmentActivity.supportFragmentManager, lifecycle) {

    fun getFragment(position: Int): ViewFragment {
        return fragmentArrayList[position]
    }

    fun addFragment(fragment: ViewFragment, position: Int? = -1) {
        if (position == null || position < 0) {
            fragmentArrayList.add(fragment)
            notifyItemChanged(min(fragmentArrayList.size - 1, 0))
        } else {
            fragmentArrayList.add(position, fragment)
            notifyItemChanged(position)
        }
    }

    fun removeFragmentAt(position: Int) {
        if(fragmentArrayList.size > position) {
            fragmentArrayList.removeAt(position)
            notifyItemChanged(position)
        }
    }

    fun removeFragment(view: View?) {
        val index = fragmentArrayList.indexOfFirst { it.childView == view }
        if (index != -1) {
            removeFragmentAt(index)
        }
    }

    override fun getItemId(position: Int): Long {
        return fragmentArrayList[position].childView.id.toLong()
    }

    override fun createFragment(position: Int): Fragment {
        return fragmentArrayList[position]
    }

    override fun getItemCount(): Int {
        return fragmentArrayList.size
    }
}