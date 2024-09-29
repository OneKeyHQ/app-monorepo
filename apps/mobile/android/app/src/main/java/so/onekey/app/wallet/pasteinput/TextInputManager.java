package so.onekey.app.wallet.pasteinput;

import static com.facebook.react.uimanager.UIManagerHelper.getReactContext;

import android.text.InputType;
import android.util.Log;
import android.view.ViewGroup;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.scroll.ScrollEventType;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.textinput.ReactTextInputManager;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Nullable;

public class TextInputManager extends ReactTextInputManager {

    public static final String REACT_CLASS = "AndroidPasteTextInput";

    public TextInputManager(ReactApplicationContext reactContext) {
        Log.d("dddd", "dddd");
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    public ReactEditText createViewInstance(ThemedReactContext context) {
        ReactEditText editText = new PasteEditText(context);
        int inputType = editText.getInputType();
        editText.setInputType(inputType & (~InputType.TYPE_TEXT_FLAG_MULTI_LINE));
        editText.setReturnKeyType("done");
        // Set default layoutParams to avoid NullPointerException to be thrown by Android EditTextView
        // when update props (PlaceHolder) is executed before the view is layout.
        // This change should not affect layout for TextInput components because layout will be
        // overridden on the first RN commit.
        editText.setLayoutParams(
                new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return editText;
    }

    @Nullable
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        @Nullable Map<String, Object> baseEventTypeConstants =
                super.getExportedCustomDirectEventTypeConstants();
        baseEventTypeConstants.put("topPaste", MapBuilder.of("registrationName", "onPaste"));
        return baseEventTypeConstants;
    }

    @ReactProp(name = "onPaste", defaultBoolean = false)
    public void setOnPaste(final PasteEditText view, boolean onPaste) {
        if (onPaste) {
            view.setPasteWatcher(new ReactPasteWatcher(view));
        } else {
            view.setPasteWatcher(null);
        }
    }

    protected static EventDispatcher getEventDispatcher(
            ReactContext reactContext, PasteEditText editText) {
        return UIManagerHelper.getEventDispatcherForReactTag(reactContext, editText.getId());
    }

    private static class ReactPasteWatcher implements PasteWatcher {
        private final ReactEditText mReactEditText;
        private final EventDispatcher mEventDispatcher;
        private final int mSurfaceId;

        public ReactPasteWatcher(PasteEditText editText) {
            mReactEditText = editText;
            ReactContext reactContext = getReactContext(editText);
            mEventDispatcher = getEventDispatcher(reactContext, editText);
            mSurfaceId = UIManagerHelper.getSurfaceId(reactContext);
        }

        @Override
        public void onPaste(String type, String data) {
            mEventDispatcher.dispatchEvent(
                    new ReactTextInputPasteEvent(mSurfaceId, mReactEditText.getId(), type, data));
        }
    }
}
