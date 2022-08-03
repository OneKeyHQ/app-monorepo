package so.onekey.app.wallet.viewManager.homePage

import android.content.Context
import android.util.AttributeSet
import android.view.ViewGroup
import so.onekey.app.wallet.widget.HomePageLayout

class HomePageView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : HomePageLayout(context, attrs, defStyleAttr) {

    init {
        val width = ViewGroup.LayoutParams.MATCH_PARENT
        val height = ViewGroup.LayoutParams.MATCH_PARENT

        val params = LayoutParams(width, height);
        this.layoutParams = params;

        initRefreshListener()
    }


    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    private val measureAndLayout = Runnable {
        try {
            measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
            )
            layout(left, top, right, bottom)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}