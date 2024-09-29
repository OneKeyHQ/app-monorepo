package so.onekey.app.wallet.pasteinput;

import static com.facebook.react.uimanager.UIManagerHelper.getReactContext;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.text.Spanned;

import androidx.annotation.Nullable;

import com.facebook.react.views.textinput.ReactEditText;

public class PasteEditText extends ReactEditText {

    private @Nullable PasteWatcher mPasteWatcher;

    public PasteEditText(Context context) {
        super(context);
        mPasteWatcher = null;
    }

    @Override
    public boolean onTextContextMenuItem(int id) {
        if (id == android.R.id.paste || id == android.R.id.pasteAsPlainText) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                id = android.R.id.pasteAsPlainText;
                if (mPasteWatcher != null) {
                    ClipboardManager clipboardManager =
                            (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                    ClipData clipData = clipboardManager.getPrimaryClip();
                    String type = null;
                    String data = null;
                    if (clipData.getDescription().hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN)) {
                        type = ClipDescription.MIMETYPE_TEXT_PLAIN;
                        data = clipData.getItemAt(0).getText().toString();
                    } else {
                        Uri itemUri = clipData.getItemAt(0).getUri();
                        if (itemUri != null) {
                            ContentResolver cr = getReactContext(this).getContentResolver();
                            type = cr.getType(itemUri);
                            data = itemUri.toString();
                        }
                    }
                    if (type != null && data != null) {
                        mPasteWatcher.onPaste(type, data);
                    }
                }
            } else {
                ClipboardManager clipboard =
                        (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData previousClipData = clipboard.getPrimaryClip();
                if (previousClipData != null) {
                    for (int i = 0; i < previousClipData.getItemCount(); i++) {
                        final CharSequence text = previousClipData.getItemAt(i).coerceToText(getContext());
                        final CharSequence paste = (text instanceof Spanned) ? text.toString() : text;
                        if (paste != null) {
                            ClipData clipData = ClipData.newPlainText(null, text);
                            clipboard.setPrimaryClip(clipData);
                        }
                    }
                    boolean actionPerformed = super.onTextContextMenuItem(id);
                    clipboard.setPrimaryClip(previousClipData);
                    return actionPerformed;
                }
            }
        }
        return super.onTextContextMenuItem(id);
    }

    public void setPasteWatcher(@Nullable PasteWatcher pasteWatcher) {
        mPasteWatcher = pasteWatcher;
    }
}
