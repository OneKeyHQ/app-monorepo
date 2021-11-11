package so.onekey.app.wallet.bean

import android.widget.ImageView
import androidx.annotation.DrawableRes
import androidx.vectordrawable.graphics.drawable.VectorDrawableCompat
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CircleCrop
import com.bumptech.glide.request.RequestOptions
import com.facebook.common.internal.Objects
import so.onekey.app.wallet.R

interface ImageResources {
  fun intoTarget(imageView: ImageView)
}

open class LocalImage(@DrawableRes val res: Int, val circle: Boolean = true) : ImageResources {
  override fun intoTarget(imageView: ImageView) {
    val into = Glide.with(imageView.context).load(res).placeholder(R.drawable.ic_bi)
    if (circle) {
      into.apply(RequestOptions.bitmapTransform(CircleCrop())).into(imageView)
    } else {
      into.into(imageView)
    }
    // imageView.setImageDrawable(ResourcesCompat.getDrawable(imageView.resources, res, null))
  }

  override fun hashCode(): Int {
    return Objects.hashCode(res)
  }

  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (javaClass != other?.javaClass) return false

    other as LocalImage

    if (res != other.res) return false

    return true
  }

}

class RemoteImage @JvmOverloads constructor(
        val url: String,
        @DrawableRes val placeholder: Int = R.drawable.ic_bi,
        val circle: Boolean = true
) : ImageResources {
  override fun intoTarget(imageView: ImageView) {
    val into = Glide.with(imageView.context).load(url).placeholder(placeholder)
    if (circle) {
      into.apply(RequestOptions.bitmapTransform(CircleCrop())).into(imageView)
    } else {
      into.into(imageView)
    }
  }

  override fun hashCode(): Int {
    return Objects.hashCode(url)
  }

  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (javaClass != other?.javaClass) return false

    other as RemoteImage

    if (url != other.url) return false

    return true
  }
}


class LocalVectorDrawableImage(@DrawableRes res: Int) : LocalImage(res) {
  override fun intoTarget(imageView: ImageView) {
    try {
      imageView.setImageDrawable(VectorDrawableCompat.create(imageView.resources, res, null))
    } catch (e: Exception) {
      imageView.setImageDrawable(null)
    }
  }
}
