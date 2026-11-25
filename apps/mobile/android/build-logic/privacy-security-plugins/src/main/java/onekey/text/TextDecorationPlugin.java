package onekey.text;

import com.android.build.api.instrumentation.AsmClassVisitorFactory;
import com.android.build.api.instrumentation.ClassContext;
import com.android.build.api.instrumentation.ClassData;
import com.android.build.api.instrumentation.FramesComputationMode;
import com.android.build.api.instrumentation.InstrumentationParameters;
import com.android.build.api.instrumentation.InstrumentationScope;
import com.android.build.api.variant.AndroidComponentsExtension;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.commons.AdviceAdapter;
import org.objectweb.asm.commons.Method;

public class TextDecorationPlugin implements Plugin<Project> {
    private static final Type RENDERER =
            Type.getObjectType("com/facebook/react/views/text/TextDecorationStyleKt");
    private static final Type BOUNDS =
            Type.getObjectType("so/onekey/app/wallet/text/TextDecorationBounds");
    private static final String LAYOUT = "android/text/Layout";
    private static final Method DRAW_LINE = new Method("drawDecorationLine",
            "(Landroid/graphics/Canvas;Landroid/graphics/Paint;FFFFF"
                    + "Lcom/facebook/react/views/text/TextDecorationStyle;Landroid/graphics/Path;)V");
    private static final Method LINE_INTERVALS =
            new Method("forLine", "(Landroid/text/Layout;III)[F");

    @Override
    public void apply(Project project) {
        AndroidComponentsExtension<?, ?, ?> extension =
                project.getExtensions().getByType(AndroidComponentsExtension.class);
        extension.onVariants(extension.selector().all(), variant -> {
            variant.getInstrumentation().transformClassesWith(
                    Transform.class, InstrumentationScope.ALL, ignored -> null);
            variant.getInstrumentation().setAsmFramesComputationMode(
                    FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS);
        });
    }

    public abstract static class Transform
            implements AsmClassVisitorFactory<InstrumentationParameters.None> {
        @Override
        public boolean isInstrumentable(ClassData classData) {
            return classData.getClassName().equals(RENDERER.getClassName());
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
                if (method != null && name.equals("drawSpannedDecoration")) {
                    return new DecorationVisitor(method, access, name, descriptor);
                }
                return method;
            }
        };
    }

    private static final class DecorationVisitor extends AdviceAdapter {
        private final int line = newLocal(Type.INT_TYPE);
        private boolean foundBaseline;
        private boolean replacedDraw;

        DecorationVisitor(MethodVisitor next, int access, String name, String descriptor) {
            super(Opcodes.ASM9, next, access, name, descriptor);
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor,
                boolean isInterface) {
            if (opcode == INVOKEVIRTUAL && owner.equals(LAYOUT)) {
                if (name.equals("getLineBaseline") && descriptor.equals("(I)I")) {
                    dup();
                    storeLocal(line);
                    foundBaseline = true;
                } else if (descriptor.equals("(I)F") && (name.equals("getPrimaryHorizontal")
                        || name.equals("getLineLeft") || name.equals("getLineRight"))) {
                    // The original two endpoints are replaced below, so skip measuring them.
                    pop2();
                    push(0f);
                    return;
                }
            }
            if (opcode == INVOKESTATIC && owner.equals(RENDERER.getInternalName())
                    && name.equals(DRAW_LINE.getName()) && descriptor.equals(DRAW_LINE.getDescriptor())) {
                if (!foundBaseline || replacedDraw) {
                    throw new IllegalStateException("Unexpected React Android decoration draw loop");
                }
                drawIntervals();
                replacedDraw = true;
                return;
            }
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
        }

        @Override
        public void visitEnd() {
            if (!replacedDraw) {
                throw new IllegalStateException("Could not replace React Android decoration endpoints");
            }
            super.visitEnd();
        }

        private void drawIntervals() {
            Type[] types = DRAW_LINE.getArgumentTypes();
            int[] arguments = new int[types.length];
            for (int i = types.length - 1; i >= 0; i--) {
                arguments[i] = newLocal(types[i]);
                storeLocal(arguments[i]);
            }

            // drawSpannedDecoration's layout, start and end, plus the current line.
            loadArg(3);
            loadArg(0);
            loadArg(1);
            loadLocal(line);
            invokeStatic(BOUNDS, LINE_INTERVALS);
            int intervals = newLocal(Type.getType(float[].class));
            storeLocal(intervals);

            int offset = newLocal(Type.INT_TYPE);
            push(0);
            storeLocal(offset);
            Label loop = mark();
            loadLocal(offset);
            loadLocal(intervals);
            arrayLength();
            Label done = newLabel();
            ifICmp(GE, done);

            loadLocal(arguments[0]); // Canvas
            loadLocal(arguments[1]); // Paint
            loadLocal(intervals);
            loadLocal(offset);
            arrayLoad(Type.FLOAT_TYPE);
            loadLocal(intervals);
            loadLocal(offset);
            push(1);
            math(ADD, Type.INT_TYPE);
            arrayLoad(Type.FLOAT_TYPE);
            for (int i = 4; i < arguments.length; i++) {
                loadLocal(arguments[i]);
            }
            invokeStatic(RENDERER, DRAW_LINE);
            iinc(offset, 2);
            goTo(loop);
            mark(done);
        }
    }
}
