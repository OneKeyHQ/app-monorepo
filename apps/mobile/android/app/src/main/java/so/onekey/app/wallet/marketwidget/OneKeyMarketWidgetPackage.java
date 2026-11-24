package so.onekey.app.wallet.marketwidget;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.Collections;

public final class OneKeyMarketWidgetPackage extends BaseReactPackage {
    @Nullable
    @Override
    public NativeModule getModule(@NonNull String name, @NonNull ReactApplicationContext context) {
        return OneKeyMarketWidgetModule.NAME.equals(name) ? new OneKeyMarketWidgetModule(context) : null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> Collections.singletonMap(OneKeyMarketWidgetModule.NAME, new ReactModuleInfo(
            OneKeyMarketWidgetModule.NAME, OneKeyMarketWidgetModule.class.getName(), false, false, false, false));
    }
}
