package so.onekey.app.wallet.storage;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

public final class OneKeyNativeStorageMigrationPackage extends BaseReactPackage {
    @Nullable
    @Override
    public NativeModule getModule(
        @NonNull String name,
        @NonNull ReactApplicationContext reactContext
    ) {
        if (OneKeyNativeStorageMigrationModule.NAME.equals(name)) {
            return new OneKeyNativeStorageMigrationModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
            moduleInfos.put(
                OneKeyNativeStorageMigrationModule.NAME,
                new ReactModuleInfo(
                    OneKeyNativeStorageMigrationModule.NAME,
                    OneKeyNativeStorageMigrationModule.class.getName(),
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
