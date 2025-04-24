package onekey.privacy.phoenix;

import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Label;

public class PhoenixMethodVisitor extends MethodVisitor implements Opcodes {
    private boolean superCalled = false;

    public PhoenixMethodVisitor(MethodVisitor methodVisitor) {
        super(Opcodes.ASM9, methodVisitor);
    }

    @Override
    public void visitCode() {
        // Execute the original visitCode
        super.visitCode();
    }

    @Override
    public void visitMethodInsn(int opcode, String owner, String name, String descriptor, boolean isInterface) {
        // Execute the original method call first
        super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);

        // Check if this is a call to super.onCreate
        if (opcode == INVOKESPECIAL &&
            "android/app/Activity".equals(owner) &&
            "onCreate".equals(name) &&
            "(Landroid/os/Bundle;)V".equals(descriptor) &&
            !superCalled) {

            // Mark that super method has been called
            superCalled = true;

            System.out.println("Phoenix security fix: Injecting security check after super.onCreate");

            // Inject security check code after super.onCreate()
            Label allowContinue = new Label();

            // Get Intent
            mv.visitVarInsn(ALOAD, 0); // this
            mv.visitMethodInsn(INVOKEVIRTUAL, "com/jakewharton/processphoenix/ProcessPhoenix", "getIntent", "()Landroid/content/Intent;", false);
            mv.visitVarInsn(ASTORE, 2); // Store intent in local variable 2

            // Get KEY_RESTART_INTENTS
            mv.visitVarInsn(ALOAD, 2); // intent
            mv.visitLdcInsn("phoenix_restart_intents");
            mv.visitMethodInsn(INVOKEVIRTUAL, "android/content/Intent", "getParcelableArrayListExtra", "(Ljava/lang/String;)Ljava/util/ArrayList;", false);
            mv.visitVarInsn(ASTORE, 3); // Store intents in local variable 3

            // Check if intents is null
            mv.visitVarInsn(ALOAD, 3); // intents
            mv.visitJumpInsn(IFNULL, allowContinue);

            // Check if intents has exactly one element
            mv.visitVarInsn(ALOAD, 3); // intents
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/util/ArrayList", "size", "()I", false);
            mv.visitInsn(ICONST_1);
            mv.visitJumpInsn(IF_ICMPNE, allowContinue); // if size != 1, deny and continue

            // Get the first Intent
            mv.visitVarInsn(ALOAD, 3); // intents
            mv.visitInsn(ICONST_0);
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/util/ArrayList", "get", "(I)Ljava/lang/Object;", false);
            mv.visitTypeInsn(CHECKCAST, "android/content/Intent");
            mv.visitVarInsn(ASTORE, 4); // Store firstIntent in local variable 4

            // Get ComponentName
            mv.visitVarInsn(ALOAD, 4); // firstIntent
            mv.visitMethodInsn(INVOKEVIRTUAL, "android/content/Intent", "getComponent", "()Landroid/content/ComponentName;", false);
            mv.visitVarInsn(ASTORE, 5); // Store componentName in local variable 5

            // Check if ComponentName is null
            mv.visitVarInsn(ALOAD, 5); // componentName
            mv.visitJumpInsn(IFNULL, allowContinue);

            // Check if it's MainActivity
            mv.visitVarInsn(ALOAD, 5); // componentName
            mv.visitMethodInsn(INVOKEVIRTUAL, "android/content/ComponentName", "getClassName", "()Ljava/lang/String;", false);
            mv.visitLdcInsn("so.onekey.app.wallet.MainActivity");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);

            // If it's MainActivity, allow to continue
            mv.visitJumpInsn(IFNE, allowContinue);

            // If it's not MainActivity, call finish() and return
            mv.visitVarInsn(ALOAD, 0); // this
            mv.visitMethodInsn(INVOKEVIRTUAL, "com/jakewharton/processphoenix/ProcessPhoenix", "finish", "()V", false);
            mv.visitInsn(RETURN);

            // Label for allowing to continue
            mv.visitLabel(allowContinue);
        }
    }
}
