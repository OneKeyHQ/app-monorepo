package so.onekey.app.wallet.pasteinput;

/**
  * Implement this interface to be informed of paste event in the
  * ReactTextEdit This is used by the ReactTextInputManager to forward events
  * from the EditText to JS
  */
 interface PasteWatcher {
   public void onPaste(String type, String data);
 }
