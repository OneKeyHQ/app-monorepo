package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.bumptech.glide.Glide
import com.bumptech.glide.RequestManager
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.load.model.GlideUrl
import com.bumptech.glide.load.model.LazyHeaders
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.transition.Transition
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

internal object HomeContainerImageLoader {
  internal class Request internal constructor(
    private val requestManager: RequestManager,
    internal val completion: (Bitmap?) -> Unit,
  ) {
    private val cancelled = AtomicBoolean(false)
    private val target = AtomicReference<CustomTarget<Bitmap>?>(null)

    fun cancel() {
      if (cancelled.compareAndSet(false, true)) clearTarget()
    }

    internal fun attach(value: CustomTarget<Bitmap>) {
      target.set(value)
      if (cancelled.get()) clearTarget()
    }

    internal fun deliver(bitmap: Bitmap?) {
      if (!cancelled.get()) completion(bitmap)
    }

    private fun clearTarget() {
      val current = target.getAndSet(null) ?: return
      if (Looper.myLooper() == Looper.getMainLooper()) {
        requestManager.clear(current)
      } else {
        mainHandler.post { requestManager.clear(current) }
      }
    }
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  fun load(context: Context, value: String, completion: (Bitmap?) -> Unit): Request? {
    if (value.isEmpty()) return null
    val applicationContext = context.applicationContext
    val model = createModel(applicationContext, value) ?: return null
    val requestManager = Glide.with(applicationContext)
    val request = Request(requestManager, completion)
    val target = object : CustomTarget<Bitmap>() {
      override fun onResourceReady(resource: Bitmap, transition: Transition<in Bitmap>?) {
        request.deliver(resource)
      }

      override fun onLoadFailed(errorDrawable: Drawable?) {
        request.deliver(null)
      }

      override fun onLoadCleared(placeholder: Drawable?) = Unit
    }
    request.attach(target)
    requestManager
      .asBitmap()
      .load(model)
      .diskCacheStrategy(DiskCacheStrategy.AUTOMATIC)
      .into(target)
    return request
  }

  private fun createModel(context: Context, value: String): Any? {
    val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
    return when (uri.scheme) {
      "http", "https" -> GlideUrl(value, LazyHeaders.DEFAULT)
      "file", "content", "android.resource" -> uri
      "asset" -> Uri.parse("file:///android_asset/${uri.path.orEmpty().removePrefix("/")}")
      "res" -> Uri.parse(
        "android.resource://${context.packageName}/${uri.path.orEmpty().removePrefix("/")}",
      )
      else -> null
    }
  }
}
