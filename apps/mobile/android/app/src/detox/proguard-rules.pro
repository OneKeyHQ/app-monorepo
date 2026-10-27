# The Debug instrumentation APK reuses dependencies supplied by the Release app.
# Detox's bundled rules do not cover all of their classes and callable members.
# Preserve these shared APIs only for Detox, while allowing their bodies to optimize.
-keep,allowoptimization class kotlin.** { *; }
-keep,allowoptimization class kotlinx.coroutines.** { *; }
-keep,allowoptimization class com.google.common.** { *; }
-keep,allowoptimization class okio.** { *; }

# Espresso and Detox access these view types across the APK boundary.
-keep,allowoptimization class androidx.appcompat.widget.AppCompatSeekBar { *; }
-keep,allowoptimization class androidx.drawerlayout.widget.DrawerLayout** { *; }
-keep,allowoptimization class androidx.lifecycle.Lifecycle$State { *; }
-keep,allowoptimization class androidx.recyclerview.widget.RecyclerView** { *; }
-keep,allowoptimization class androidx.viewpager.widget.** { *; }
-keep,allowoptimization class com.google.android.material.button.MaterialButton { *; }
-keep,allowoptimization class com.google.android.material.navigation.NavigationView { *; }
-keep,allowoptimization class com.facebook.react.interfaces.TaskInterface { *; }
-keep,allowoptimization class com.facebook.react.views.scroll.** { *; }
