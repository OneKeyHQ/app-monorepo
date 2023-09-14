package so.onekey.app.wallet.viewManager.homePage

import android.content.Context
import android.util.AttributeSet
import android.view.ViewGroup
import so.onekey.app.wallet.widget.HomePageLayout

class HomePageView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : HomePageLayout(context, attrs, defStyleAttr) {

    init {
        val params =
            LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        this.layoutParams = params

        initRefreshListener()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val widthSize = MeasureSpec.getSize(widthMeasureSpec)
        val heightSize = MeasureSpec.getSize(heightMeasureSpec)

        val maxHeight = context.resources.displayMetrics.heightPixels
        val maxWidth = context.resources.displayMetrics.widthPixels

        val width: Int = Math.min(maxWidth, widthSize)
        val height: Int = Math.min(maxHeight, heightSize)

        setMeasuredDimension(width, height)
        super.onMeasure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        )
    }
}