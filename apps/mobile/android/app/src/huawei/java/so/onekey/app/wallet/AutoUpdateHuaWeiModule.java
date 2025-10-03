public class AutoUpdateHuaWeiModule {
    public AutoUpdateGoogleModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "AutoUpdateModule";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("ANDROID_CHANNEL", "huawei");
        return constants;
    }
}
