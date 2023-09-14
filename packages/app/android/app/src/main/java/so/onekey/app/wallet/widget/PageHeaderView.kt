package so.onekey.app.wallet.widget

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout

class PageHeaderView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(
    context,
    attrs,
    defStyleAttr
) {

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val widthMode = MeasureSpec.getMode(widthMeasureSpec)
        val widthSize = MeasureSpec.getSize(widthMeasureSpec)

        // 默认情况下使用原始测量高度
        var heightSize = MeasureSpec.getSize(heightMeasureSpec)

        // 测量子视图
        var totalHeight = 0
        try {
            for (i in 0 until childCount) {
                val child = getChildAt(i)
                child.requestLayout()
                totalHeight += child.measuredHeight
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 如果子视图的总高度大于0，则使用子视图的高度
        if (totalHeight > 0) {
            heightSize = totalHeight
        }

        val width: Int = when (widthMode) {
            MeasureSpec.EXACTLY -> widthSize
            MeasureSpec.AT_MOST -> widthSize
            MeasureSpec.UNSPECIFIED -> widthSize
            else -> widthSize
        }

        setMeasuredDimension(width, heightSize)
    }
}
