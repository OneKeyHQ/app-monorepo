package so.onekey.app.wallet.widget.transition;

import android.util.TypedValue;
import android.widget.TextView;

import so.onekey.app.wallet.widget.SlidingTabLayoutBase;

public class TabScaleTransformer implements ITabScaleTransformer {

    private SlidingTabLayoutBase slidingScaleTabLayout;

    private float textSelectSize;

    private float textUnSelectSize;


    public TabScaleTransformer(SlidingTabLayoutBase slidingScaleTabLayout,
                               float textSelectSize, float textUnSelectSize) {
        this.slidingScaleTabLayout = slidingScaleTabLayout;
        this.textSelectSize = textSelectSize;
        this.textUnSelectSize = textUnSelectSize;

    }

    public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
        // 字体大小相同，不需要切换
        if (textSelectSize == textUnSelectSize) return;

        for (int i = 0; i < slidingScaleTabLayout.getTabCount(); i++) {
            if (i != position && i != position + 1) {
                updateTextSize(i, 1);
            }
        }
        changeTextSize(position, positionOffset);

    }

    private void changeTextSize(final int position, final float positionOffset) {
        updateTextSize(position, positionOffset);
        if (position + 1 < slidingScaleTabLayout.getTabCount()) {
            updateTextSize(position + 1, 1 - positionOffset);
        }
    }

    private void updateTextSize(final int position, final float positionOffset) {
        final TextView currentTab = slidingScaleTabLayout.getTabTitleView(position);
        // 必须要在View调用post更新样式，否则可能无效
        currentTab.post(new Runnable() {
            @Override
            public void run() {
                int textSize =
                        (int) (textSelectSize - Math.abs((textSelectSize - textUnSelectSize) * positionOffset));
                if (currentTab.getTextSize() != textSize) {
                    currentTab.setTextSize(TypedValue.COMPLEX_UNIT_PX, textSize);
                    currentTab.requestLayout();
                }
            }
        });
    }
}
