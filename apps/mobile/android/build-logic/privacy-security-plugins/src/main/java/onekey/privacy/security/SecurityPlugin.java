package onekey.privacy.security;

import com.android.build.api.instrumentation.FramesComputationMode;
import com.android.build.api.instrumentation.InstrumentationScope;
import com.android.build.api.variant.AndroidComponentsExtension;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public class SecurityPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        AndroidComponentsExtension<?, ?, ?> extension = project.getExtensions().getByType(AndroidComponentsExtension.class);
        extension.onVariants(extension.selector().all(), variant -> {
            variant.getInstrumentation().transformClassesWith(
                    SecurityTransform.class,
                    InstrumentationScope.ALL,
                    ignored -> null
            );

            variant.getInstrumentation().setAsmFramesComputationMode(
                    FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS
            );
        });
    }
}
