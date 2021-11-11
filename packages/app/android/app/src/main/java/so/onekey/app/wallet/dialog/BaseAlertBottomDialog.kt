package so.onekey.app.wallet.dialog

import android.annotation.SuppressLint
import android.content.Context
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.annotation.ColorInt
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import com.bumptech.glide.Glide
import com.lxj.xpopup.XPopup
import com.lxj.xpopup.core.BottomPopupView
import so.onekey.app.wallet.R
import so.onekey.app.wallet.bean.ImageResources
import so.onekey.app.wallet.databinding.DialogBaseBottomBinding

/**
 * @author Onekey@QuincySx
 * @create 2021-03-03 10:23 AM
 */
@SuppressLint("ViewConstructor")
class BaseAlertBottomDialog private constructor(
  private val builder: Builder
) : BottomPopupView(builder.context) {
  enum class TextStyle {
    CENTERED, LEFT
  }

  private lateinit var mBinding: DialogBaseBottomBinding

  override fun addInnerContent() {
    mBinding =
      DialogBaseBottomBinding.inflate(LayoutInflater.from(context), bottomPopupContainer, false)
    bottomPopupContainer.addView(mBinding.root)
  }

  override fun onCreate() {
    super.onCreate()
    mBinding.tvButtonSecondary.setOnClickListener {
      builder.secondaryButtonListener?.onClick(this)
      dismiss()
    }
    mBinding.tvButtonPrimary.setOnClickListener {
      builder.primaryButtonListener?.onClick(this)
      dismiss()
    }

    builder.secondaryButtonListener?.let {
      mBinding.tvButtonSecondary.visibility = View.VISIBLE
      mBinding.viewButtonDivision.visibility = View.VISIBLE
    }
    builder.iconResources?.let {
      mBinding.layoutIconInfo.visibility = View.VISIBLE
      mBinding.progressBar.visibility = View.GONE
      mBinding.ivDialogLogo.visibility = View.VISIBLE
      it.intoTarget(mBinding.ivDialogLogo)
    }
    builder.iconUrl?.let {
      mBinding.layoutIconInfo.visibility = View.VISIBLE
      mBinding.progressBar.visibility = View.GONE
      mBinding.ivDialogLogo.visibility = View.VISIBLE
      Glide.with(mBinding.ivDialogLogo)
        .load(it)
        .centerCrop()
        .placeholder(R.mipmap.ic_launcher_foreground)
        .error(R.mipmap.ic_launcher_foreground)
        .fitCenter()
        .into(mBinding.ivDialogLogo)
    }
    builder.iconResId?.let {
      mBinding.layoutIconInfo.visibility = View.VISIBLE
      mBinding.progressBar.visibility = View.GONE
      mBinding.ivDialogLogo.visibility = View.VISIBLE
      mBinding.ivDialogLogo.setImageResource(it)
    }
    builder.messageText?.let {
      mBinding.dialogSubText.visibility = View.VISIBLE
      mBinding.dialogSubText.text = it
    }
    builder.messageTextResId?.let {
      mBinding.dialogSubText.visibility = View.VISIBLE
      mBinding.dialogSubText.text = context.resources?.getString(it)
    }
    builder.titleText?.let {
      mBinding.dialogMainText.visibility = View.VISIBLE
      mBinding.dialogMainText.text = it
    }
    builder.titleTextResId?.let {
      mBinding.dialogMainText.visibility = View.VISIBLE
      mBinding.dialogMainText.text = context.resources?.getString(it)
    }

    builder.primaryButtonText?.let {
      mBinding.tvButtonPrimary.visibility = View.VISIBLE
      mBinding.tvButtonPrimary.text = it
    }
    builder.primaryButtonTextResId?.let {
      mBinding.tvButtonPrimary.visibility = View.VISIBLE
      mBinding.tvButtonPrimary.text = context.resources?.getString(it)
    }
    builder.primaryButtonTextColor?.let {
      mBinding.tvButtonPrimary.visibility = View.VISIBLE
      mBinding.tvButtonPrimary.setTextColor(it)
    }
    mBinding.tvButtonPrimary.visibility = if (builder.primaryButtonHidden) {
      View.GONE
    } else {
      View.VISIBLE
    }

    builder.secondaryButtonText?.let {
      mBinding.tvButtonSecondary.visibility = View.VISIBLE
      mBinding.tvButtonSecondary.text = it
    }
    builder.secondaryButtonTextResId?.let {
      mBinding.tvButtonSecondary.visibility = View.VISIBLE
      mBinding.viewButtonDivision.visibility = View.VISIBLE
      mBinding.tvButtonSecondary.text = context.resources?.getString(it)
    }
    builder.secondaryButtonTextColor?.let {
      mBinding.tvButtonSecondary.visibility = View.VISIBLE
      mBinding.viewButtonDivision.visibility = View.VISIBLE
      mBinding.tvButtonSecondary.setTextColor(it)
    }

    builder.messageTextStyle?.let {
      when (it) {
        TextStyle.CENTERED -> mBinding.dialogSubText.gravity = Gravity.CENTER_HORIZONTAL
        TextStyle.LEFT -> mBinding.dialogSubText.gravity = Gravity.START
      }
    }
    builder.customView?.let {
      if (builder.customLayoutParams == null) {
        mBinding.dialogView.addView(it)
      } else {
        mBinding.dialogView.addView(it, builder.customLayoutParams)
      }
    }
    builder.hiddenDialogContainerPaddingTop.let {
      if (it) {
        with(mBinding) {
          layoutDialogContainer.setPadding(
            layoutDialogContainer.paddingLeft,
            0,
            layoutDialogContainer.paddingRight,
            layoutDialogContainer.paddingBottom
          )
        }
      }
    }
    builder.hiddenBottomDividingLine.let {
      if (it) {
        mBinding.viewDivider.visibility = View.GONE
      } else {
        mBinding.viewDivider.visibility = View.VISIBLE
      }
    }

    if (builder.progressMode) {
      mBinding.layoutIconInfo.visibility = View.VISIBLE
      mBinding.ivDialogLogo.visibility = View.GONE
      mBinding.progressBar.visibility = View.VISIBLE
    }
  }

  fun setMessage(resId: Int): BaseAlertBottomDialog {
    mBinding.dialogSubText.visibility = View.VISIBLE
    mBinding.dialogSubText.text = context.resources?.getString(resId)
    return this
  }

  fun setMessage(message: CharSequence?): BaseAlertBottomDialog {
    mBinding.dialogSubText.visibility = View.VISIBLE
    mBinding.dialogSubText.text = message
    return this
  }

  fun showDialog() {
    XPopup.Builder(builder.context)
      .dismissOnBackPressed(builder.dismissOnBackPressed)
      .enableDrag(builder.enableDrag)
      .dismissOnTouchOutside(builder.cancelOutSide)
      .moveUpToKeyboard(builder.moveUpToKeyboard)
      .asCustom(this)
      .show()
  }

  class Builder(val context: Context) {
    var primaryButtonListener: OnClickListener? = null
      private set

    @StringRes
    var primaryButtonTextResId: Int? = null
      private set
    var primaryButtonHidden: Boolean = false
      private set
    var primaryButtonText: String? = null
      private set

    @ColorInt
    var primaryButtonTextColor: Int? = null
      private set

    @ColorInt
    var primaryButtonColor: Int? = null
      private set

    var secondaryButtonListener: OnClickListener? = null
      private set

    @StringRes
    var secondaryButtonTextResId: Int? = null
      private set
    var secondaryButtonText: String? = null
      private set

    @ColorInt
    var secondaryButtonTextColor: Int? = null
      private set

    @ColorInt
    var secondaryButtonColor: Int? = null
      private set

    @StringRes
    var messageTextResId: Int? = null
      private set
    var messageText: CharSequence? = null
      private set

    @StringRes
    var titleTextResId: Int? = null
      private set
    var titleText: CharSequence? = null
      private set

    @DrawableRes
    var iconResId: Int? = null
      private set
    var iconUrl: CharSequence? = null
      private set
    var iconResources: ImageResources? = null
      private set

    var progressMode: Boolean = false
      private set
    var hiddenBottomDividingLine: Boolean = false
      private set
    var hiddenDialogContainerPaddingTop: Boolean = false
      private set

    var messageTextStyle: TextStyle? = null
      private set
    var customView: View? = null
      private set
    var customLayoutParams: ViewGroup.LayoutParams? = null
      private set

    var cancelOutSide: Boolean = true
      private set

    var enableDrag: Boolean = true
      private set

    var dismissOnBackPressed: Boolean = true
      private set

    var moveUpToKeyboard: Boolean = true
      private set

    fun setPrimaryButtonListener(value: OnClickListener) =
      apply { this.primaryButtonListener = value }

    fun hiddenPrimaryButton(hidden: Boolean) = apply { this.primaryButtonHidden = hidden }
    fun setPrimaryButtonText(@StringRes value: Int) = apply { this.primaryButtonTextResId = value }
    fun setPrimaryButtonText(value: String) = apply { this.primaryButtonText = value }
    fun setPrimaryButtonTextColor(@ColorInt value: Int) =
      apply { this.primaryButtonTextColor = value }

    fun setSecondaryButtonListener(value: OnClickListener) =
      apply { this.secondaryButtonListener = value }

    fun setSecondaryButtonText(@StringRes value: Int) =
      apply { this.secondaryButtonTextResId = value }

    fun setSecondaryButtonText(value: String) = apply { this.secondaryButtonText = value }
    fun setSecondaryButtonTextColor(@ColorInt value: Int) =
      apply { this.secondaryButtonTextColor = value }

    fun setMessage(@StringRes value: Int) = apply { this.messageTextResId = value }
    fun setMessage(value: String) = apply { this.messageText = value }

    fun setTitle(@StringRes value: Int) = apply { this.titleTextResId = value }
    fun setTitle(value: String) = apply { this.titleText = value }

    fun setIcon(@DrawableRes value: Int) = apply { this.iconResId = value }
    fun setIcon(value: String) = apply { this.iconUrl = value }
    fun setIcon(value: ImageResources?) = apply { this.iconResources = value }

    fun setProgressMode(value: Boolean) = apply { this.progressMode = value }
    fun hiddenBottomDividingLine(value: Boolean) = apply { this.hiddenBottomDividingLine = value }
    fun hiddenDialogContainerPaddingTop(value: Boolean) =
      apply { this.hiddenDialogContainerPaddingTop = value }

    fun setMessageTextStyle(value: TextStyle) = apply { this.messageTextStyle = value }

    @JvmOverloads
    fun addView(value: View, layoutParams: ViewGroup.LayoutParams? = null) = apply {
      this.customView = value
      this.customLayoutParams = layoutParams
    }

    fun setCancelOutSide(value: Boolean) = apply { this.cancelOutSide = value }

    fun setEnableDrag(value: Boolean) = apply { this.enableDrag = value }

    fun setDismissOnBackPressed(value: Boolean) = apply { this.dismissOnBackPressed = value }

    fun setMoveUpToKeyboard(value: Boolean) = apply { this.moveUpToKeyboard = value }

    fun build(): BaseAlertBottomDialog {
      return BaseAlertBottomDialog(this)
    }
  }

  companion object {
    inline fun build(context: Context, block: Builder.() -> Unit) =
      Builder(context).apply(block).build()
  }

  fun
  interface OnClickListener {
    fun onClick(dialog: BaseAlertBottomDialog)
  }
}
