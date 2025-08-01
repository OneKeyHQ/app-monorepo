package so.onekey.app.wallet.splashscreen.exceptions;

import expo.modules.kotlin.exception.CodedException;

public class NoContentViewException extends CodedException {
    public NoContentViewException() {
        super("ContentView is not yet available. Call 'SplashScreen.show(...)' once 'setContentView()' is called.");
    }
}

class PreventAutoHideException extends CodedException {
    public PreventAutoHideException(String message) {
        super(message);
    }
}

class HideAsyncException extends CodedException {
    public HideAsyncException(String message) {
        super(message);
    }
}
