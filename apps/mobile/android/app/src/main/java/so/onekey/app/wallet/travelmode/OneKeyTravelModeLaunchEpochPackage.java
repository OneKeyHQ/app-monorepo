package so.onekey.app.wallet.travelmode;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

public final class OneKeyTravelModeLaunchEpochPackage extends BaseReactPackage {
    @Nullable
    @Override
    public NativeModule getModule(
        @NonNull String name,
        @NonNull ReactApplicationContext reactContext
    ) {
        if (OneKeyTravelModeLaunchEpochModule.NAME.equals(name)) {
            return new OneKeyTravelModeLaunchEpochModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
            moduleInfos.put(
                OneKeyTravelModeLaunchEpochModule.NAME,
                new ReactModuleInfo(
                    OneKeyTravelModeLaunchEpochModule.NAME,
                    OneKeyTravelModeLaunchEpochModule.class.getName(),
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
