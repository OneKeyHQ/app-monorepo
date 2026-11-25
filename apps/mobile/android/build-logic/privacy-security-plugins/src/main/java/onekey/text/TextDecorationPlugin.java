package onekey.text;

import com.android.build.api.instrumentation.AsmClassVisitorFactory;
import com.android.build.api.instrumentation.ClassContext;
import com.android.build.api.instrumentation.ClassData;
import com.android.build.api.instrumentation.InstrumentationParameters;
import com.android.build.api.instrumentation.InstrumentationScope;
import com.android.build.api.variant.AndroidComponentsExtension;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

public class TextDecorationPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        AndroidComponentsExtension<?, ?, ?> extension =
                project.getExtensions().getByType(AndroidComponentsExtension.class);
        extension.onVariants(extension.selector().all(), variant -> {
            variant.getInstrumentation().transformClassesWith(
                    Transform.class, InstrumentationScope.ALL, ignored -> null);
        });
    }

    public abstract static class Transform
            implements AsmClassVisitorFactory<InstrumentationParameters.None> {
        @Override
        public boolean isInstrumentable(ClassData classData) {
            return classData.getClassName().equals(
                    "com.facebook.react.views.text.TextDecorationStyleKt");
        }

        @Override
        public ClassVisitor createClassVisitor(ClassContext context, ClassVisitor next) {
            return fixDecorationBounds(next);
        }
    }

    // React Android ships as a prebuilt AAR on this project.
    static ClassVisitor fixDecorationBounds(ClassVisitor next) {
        return new ClassVisitor(Opcodes.ASM9, next) {
            @Override
            public MethodVisitor visitMethod(int access, String name, String descriptor,
                    String signature, String[] exceptions) {
                MethodVisitor method = super.visitMethod(access, name, descriptor, signature, exceptions);
                if (method == null || !name.equals("drawSpannedDecoration")) {
                    return method;
                }
                return new MethodVisitor(Opcodes.ASM9, method) {
                    @Override
                    public void visitMethodInsn(int opcode, String owner, String name,
                            String descriptor, boolean isInterface) {
                        if (opcode == Opcodes.INVOKEVIRTUAL && owner.equals("android/text/Layout")
                                && descriptor.equals("(I)F")
                                && (name.equals("getLineLeft") || name.equals("getLineRight"))) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,
                                    "so/onekey/app/wallet/text/TextDecorationBounds",
                                    name.equals("getLineLeft") ? "start" : "end",
                                    "(Landroid/text/Layout;I)F", false);
                            return;
                        }
                        super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
                    }
                };
            }
        };
    }
}
