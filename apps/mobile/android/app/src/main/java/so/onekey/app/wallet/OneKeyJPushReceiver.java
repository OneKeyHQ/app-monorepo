package so.onekey.app.wallet;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import cn.jiguang.plugins.push.JPushModule;
import cn.jiguang.plugins.push.receiver.JPushModuleReceiver;
import cn.jpush.android.api.NotificationMessage;

public class OneKeyJPushReceiver extends JPushModuleReceiver {
  static boolean isSupportNotification(String extras) {
    if (extras == null) return false;
    try {
      JSONObject data = new JSONObject(extras);
      Object mode = data.opt("mode");
      if (!((mode instanceof Number && ((Number) mode).doubleValue() == 6.0) || "6".equals(mode))) return false;
      Object payload = data.opt("payload");
      if (!(payload instanceof String)) return false;
      JSONObject command = new JSONObject((String) payload);
      return "openSupportConversation".equals(command.opt("action"));
    } catch (JSONException error) {
      return false;
    }
  }

  @Override
  public boolean isNeedShowNotification(Context context, NotificationMessage message, String source) {
    if (JPushModule.isAppForeground && isSupportNotification(message.notificationExtras)) {
      return false;
    }
    return super.isNeedShowNotification(context, message, source);
  }

  @Override
  public void onNotifyMessageUnShow(Context context, NotificationMessage message) {
    super.onNotifyMessageUnShow(context, message);
    if (isSupportNotification(message.notificationExtras)) {
      // Keep the RN delivery event for foreground messages hidden by this receiver.
      super.onNotifyMessageArrived(context, message);
    }
  }
}
