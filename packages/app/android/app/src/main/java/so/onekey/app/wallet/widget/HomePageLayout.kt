package so.onekey.app.wallet.widget

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.coordinatorlayout.widget.CoordinatorLayout
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.CollapsingToolbarLayout
import so.onekey.app.wallet.R
import so.onekey.app.wallet.utils.Utils

open class HomePageLayout @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val content =
        LayoutInflater.from(context).inflate(R.layout.view_home_page, this, false).apply {
            addView(this)
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

    fun setContentView(view: View) {
        val contentView = content.findViewById<ViewGroup>(R.id.coordinator)

        val params = CoordinatorLayout.LayoutParams(
            CoordinatorLayout.LayoutParams.MATCH_PARENT,
            CoordinatorLayout.LayoutParams.MATCH_PARENT,
        )
        params.behavior = AppBarLayout.ScrollingViewBehavior()
        contentView.addView(view, params)
    }
}