package so.onekey.app.wallet.dialog

import android.content.Context
import android.content.DialogInterface
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.appcompat.app.AlertDialog
import so.onekey.app.wallet.R

/**
 * @Description: @Author: peter Qin
 */
class BaseAlertCenterDialog(private val mBuilder: Builder) {
    class Builder(val mContext: Context) {
        var title: String? = null
        var content: String? = null
        var mOnPositiveClick: OnPositiveClick? = null
        var mOnNegativeClick: OnNegativeClick? = null
        var mNegativeButtonText: String
        var mPositiveButtonText: String
        var mNegativeButtonColorId: Int
        var mPositiveButtonColorId: Int
        var mCancelOutSide = true
        var onlyImpPositiveShowNegative = false
        var nothingImpShowPositive = false

        // if title is null use default
        fun modifyTitle(title: String?): Builder {
            this.title = title
            return this
        }

        fun setContent(content: String?): Builder {
            this.content = content
            return this
        }

        fun modifyTitle(titleId: Int): Builder {
            title = mContext.getString(titleId)
            return this
        }

        fun setContent(contentId: Int): Builder {
            content = mContext.getString(contentId)
            return this
        }

        fun setNegativeButtonText(
                negativeButtonText: String, onNegativeClick: OnNegativeClick?): Builder {
            mNegativeButtonText = negativeButtonText
            mOnNegativeClick = onNegativeClick
            return this
        }

        fun setOnlyPositiveClickButShowNegative(onPositiveClick: OnPositiveClick?): Builder {
            this.mOnPositiveClick = onPositiveClick
            onlyImpPositiveShowNegative = true
            return this
        }

        fun setNegativeButtonText(
                negativeButtonTextId: Int, onNegativeClick: OnNegativeClick?): Builder {
            mNegativeButtonText = mContext.getString(negativeButtonTextId)
            mOnNegativeClick = onNegativeClick
            return this
        }

        fun setPositiveButtonText(
                positiveButtonText: String, onPositiveClick: OnPositiveClick?): Builder {
            mPositiveButtonText = positiveButtonText
            this.mOnPositiveClick = onPositiveClick
            return this
        }

        //  only click not pass text for positive button
        fun setPositiveClick(mOnPositiveClick: OnPositiveClick?): Builder {
            this.mOnPositiveClick = mOnPositiveClick
            return this
        }

        fun setNothingImpShowPositive(): Builder {
            nothingImpShowPositive = true
            return this
        }

        fun setPositiveButtonText(resourceId: Int): Builder {
            mPositiveButtonText = mContext.getString(resourceId)
            return this
        }

        //  only click not pass text for negative button
        fun setNegativeClick(onNegativeClick: OnNegativeClick?): Builder {
            mOnNegativeClick = onNegativeClick
            return this
        }

        fun setNegativeButtonColorId(color: Int): Builder {
            mNegativeButtonColorId = mContext.getColor(color)
            return this
        }

        fun setCancelOutSide(cancelOutSide: Boolean): Builder {
            mCancelOutSide = cancelOutSide
            return this
        }

        fun setPositiveButtonColorId(color: Int): Builder {
            mPositiveButtonColorId = mContext.getColor(color)
            return this
        }

        fun setPositiveButtonText(
                positiveButtonTextId: Int, onPositiveClick: OnPositiveClick?): Builder {
            mPositiveButtonText = mContext.getString(positiveButtonTextId)
            this.mOnPositiveClick = onPositiveClick
            return this
        }

        fun build(): BaseAlertCenterDialog {
            return BaseAlertCenterDialog(this)
        }

        init {
            mNegativeButtonColorId = mContext.getColor(R.color.onykey_color_text)
            mNegativeButtonText = mContext.getString(R.string.action__cancel)
            mPositiveButtonText = mContext.getString(R.string.action__confirm)
            mPositiveButtonColorId = mContext.getColor(R.color.color_tint_blue)
        }
    }

    fun show() {
        val builder = AlertDialog.Builder(mBuilder.mContext)
        builder.setTitle(
                if (mBuilder.title?.isEmpty() == true) mBuilder.mContext.getString(R.string.tips_addspeed) else mBuilder.title)

        if (mBuilder.content?.isNotEmpty() == true) builder.setMessage(mBuilder.content)

        if (mBuilder.mOnNegativeClick != null || mBuilder.onlyImpPositiveShowNegative) {
            builder.setNegativeButton(
                    mBuilder.mNegativeButtonText
            ) { dialog: DialogInterface, which: Int ->
                if (mBuilder.mOnNegativeClick != null) mBuilder.mOnNegativeClick!!.onCancel()
                dialog.dismiss()
            }
        }

        if (mBuilder.mOnPositiveClick != null || mBuilder.nothingImpShowPositive) {
            builder.setPositiveButton(
                    mBuilder.mPositiveButtonText
            ) { dialog: DialogInterface, which: Int ->
                if (mBuilder.mOnPositiveClick != null) mBuilder.mOnPositiveClick!!.onConfirm()
                dialog.dismiss()
            }
        }
        builder.setCancelable(mBuilder.mCancelOutSide)
        val dialog = builder.show()
        val attributes: WindowManager.LayoutParams = dialog.window!!.attributes
        val metric = DisplayMetrics()
        val wm: WindowManager = mBuilder.mContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        wm.getDefaultDisplay().getMetrics(metric)
        attributes.width = metric.widthPixels
        dialog.window!!.attributes = attributes
        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(mBuilder.mNegativeButtonColorId)
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(mBuilder.mPositiveButtonColorId)
    }

    fun interface OnPositiveClick {
        fun onConfirm()
    }

    fun interface OnNegativeClick {
        fun onCancel()
    }
}