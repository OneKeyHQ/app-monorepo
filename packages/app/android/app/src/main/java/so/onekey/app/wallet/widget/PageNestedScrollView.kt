package so.onekey.app.wallet.widget

import android.content.Context
import android.util.AttributeSet
import androidx.core.widget.NestedScrollView

class PageNestedScrollView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : NestedScrollView(
    context,
    attrs,
    defStyleAttr
) {

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val widthMode = MeasureSpec.getMode(widthMeasureSpec)
        val widthSize = MeasureSpec.getSize(widthMeasureSpec)

        val heightMode = MeasureSpec.getMode(heightMeasureSpec)
        val heightSize = MeasureSpec.getSize(heightMeasureSpec)

        val width: Int = when (widthMode) {
            MeasureSpec.EXACTLY -> widthSize
            MeasureSpec.AT_MOST -> widthSize
            MeasureSpec.UNSPECIFIED -> context.resources.displayMetrics.widthPixels
            else -> widthSize
        }

        val height: Int = when (heightMode) {
            MeasureSpec.EXACTLY -> heightSize
            MeasureSpec.AT_MOST -> heightSize
            MeasureSpec.UNSPECIFIED -> context.resources.displayMetrics.heightPixels
            else -> heightSize
        }

        setMeasuredDimension(width, height)
    }
}