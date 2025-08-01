package so.onekey.app.wallet.splashscreen;

public class NoContentViewException extends RuntimeException {
    public NoContentViewException() {
        super("No content view found in activity");
    }
} 