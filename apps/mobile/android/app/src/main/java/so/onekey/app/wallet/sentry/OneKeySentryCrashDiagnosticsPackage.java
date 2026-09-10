package so.onekey.app.wallet.sentry;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

public final class OneKeySentryCrashDiagnosticsPackage extends BaseReactPackage {
    @Nullable
    @Override
    public NativeModule getModule(
        @NonNull String name,
        @NonNull ReactApplicationContext reactContext
    ) {
        if (OneKeySentryCrashDiagnosticsModule.NAME.equals(name)) {
            return new OneKeySentryCrashDiagnosticsModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
            moduleInfos.put(
                OneKeySentryCrashDiagnosticsModule.NAME,
                new ReactModuleInfo(
                    OneKeySentryCrashDiagnosticsModule.NAME,
                    OneKeySentryCrashDiagnosticsModule.class.getName(),
                    false,
                    false,
                    false,
                    false
                )
            );
            return moduleInfos;
        };
    }
}
