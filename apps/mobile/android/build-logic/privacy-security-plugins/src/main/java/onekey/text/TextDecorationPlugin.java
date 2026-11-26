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

/**
 * Corrects the horizontal bounds of underlines and strikethroughs in React Android's
 * prebuilt AAR. The shared renderer can collapse the decoration at an RTL line wrap
 * or paint under unstyled characters when the text changes direction within a line.
 *
 * <p>Full lines use their visual edges. Partial lines use Android's selection geometry
 * to coalesce touching runs and restart the decoration only after a visual gap.
 * Wavy strokes are clipped to each interval because the last curve may extend past it.
 * Dashed underlines use DashText's stroke and position within those same intervals.
 *
 * <ul>
 *   <li>{@code שלום עולם} with a dashed underline wraps between words. Both lines
 *       show dashes on the first draw.
 *   <li>{@code שלום USDT} wraps before {@code USDT} and the styled span ends after
 *       {@code US}. The second line decorates {@code US} only.
 *   <li>{@code abc אבג DEF} is styled from the beginning through the first Hebrew
 *       letter. The two visual intervals leave the unstyled gap undecorated.
 * </ul>
 *
 * <p>{@code TextDecorationBoundsTest} covers the mixed-direction cases and dash styling.
 */
public class TextDecorationPlugin implements Plugin<Project> {
    private static final Type RENDERER =
            Type.getObjectType("com/facebook/react/views/text/TextDecorationStyleKt");
    private static final Type BOUNDS =
            Type.getObjectType("so/onekey/app/wallet/text/TextDecorationBounds");
    private static final String LAYOUT = "android/text/Layout";
    private static final Type CANVAS = Type.getObjectType("android/graphics/Canvas");
    private static final Type DECORATION_STYLE =
            Type.getObjectType("com/facebook/react/views/text/TextDecorationStyle");
    private static final Method DRAW_LINE = new Method("drawDecorationLine",
            "(Landroid/graphics/Canvas;Landroid/graphics/Paint;FFFFF"
                    + "Lcom/facebook/react/views/text/TextDecorationStyle;Landroid/graphics/Path;)V");
    private static final Method LINE_INTERVALS =
            new Method("forLine", "(Landroid/text/Layout;III)[F");
    private static final Method DRAW_DASHED_UNDERLINE = new Method("drawDashedUnderline",
            "(Landroid/graphics/Canvas;Landroid/graphics/Paint;Landroid/text/Layout;IFFF)Z");
    private static final Method DRAW_PATH =
            new Method("drawPath", "(Landroid/graphics/Path;Landroid/graphics/Paint;)V");
    private static final Method DRAW_CLIPPED_WAVE = new Method("drawClippedWave",
            "(Landroid/graphics/Canvas;Landroid/graphics/Path;Landroid/graphics/Paint;FF)V");

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

    static ClassVisitor fixDecorationBounds(ClassVisitor next) {
        return new ClassVisitor(Opcodes.ASM9, next) {
            @Override
            public MethodVisitor visitMethod(int access, String name, String descriptor,
                    String signature, String[] exceptions) {
                MethodVisitor method = super.visitMethod(access, name, descriptor, signature, exceptions);
                if (method == null) {
                    return null;
                }
                if (name.equals("drawSpannedDecoration")) {
                    return new DecorationVisitor(method, access, name, descriptor);
                }
                if (name.equals(DRAW_LINE.getName()) && descriptor.equals(DRAW_LINE.getDescriptor())) {
                    return new WaveClipVisitor(method, access, name, descriptor);
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

            loadLocal(intervals);
            loadLocal(offset);
            arrayLoad(Type.FLOAT_TYPE);
            storeLocal(arguments[2]); // Left edge
            loadLocal(intervals);
            loadLocal(offset);
            push(1);
            math(ADD, Type.INT_TYPE);
            arrayLoad(Type.FLOAT_TYPE);
            storeLocal(arguments[3]); // Right edge

            Label original = newLabel();
            Label nextInterval = newLabel();
            loadLocal(arguments[7]); // Decoration style
            getStatic(DECORATION_STYLE, "DASHED", DECORATION_STYLE);
            ifCmp(DECORATION_STYLE, NE, original);
            loadLocal(arguments[0]); // Canvas
            loadLocal(arguments[1]); // Paint
            loadArg(3); // Layout
            loadLocal(line);
            loadLocal(arguments[2]); // Left edge
            loadLocal(arguments[3]); // Right edge
            loadLocal(arguments[4]); // Original y
            invokeStatic(BOUNDS, DRAW_DASHED_UNDERLINE);
            ifZCmp(NE, nextInterval);

            mark(original);
            for (int argument : arguments) {
                loadLocal(argument);
            }
            invokeStatic(RENDERER, DRAW_LINE);
            mark(nextInterval);
            iinc(offset, 2);
            goTo(loop);
            mark(done);
        }
    }
    private static final class WaveClipVisitor extends AdviceAdapter {
        WaveClipVisitor(MethodVisitor next, int access, String name, String descriptor) {
            super(Opcodes.ASM9, next, access, name, descriptor);
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor,
                boolean isInterface) {
            if (opcode != INVOKEVIRTUAL || !owner.equals(CANVAS.getInternalName())
                    || !name.equals(DRAW_PATH.getName()) || !descriptor.equals(DRAW_PATH.getDescriptor())) {
                super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
                return;
            }

            // Keep the Canvas, Path and Paint arguments already on the stack.
            loadArg(7); // Decoration style
            getStatic(DECORATION_STYLE, "WAVY", DECORATION_STYLE);
            Label original = newLabel();
            ifCmp(DECORATION_STYLE, NE, original);
            loadArg(2); // Left edge
            loadArg(3); // Right edge
            invokeStatic(BOUNDS, DRAW_CLIPPED_WAVE);
            Label done = newLabel();
            goTo(done);
            mark(original);
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
            mark(done);
        }
    }
}
