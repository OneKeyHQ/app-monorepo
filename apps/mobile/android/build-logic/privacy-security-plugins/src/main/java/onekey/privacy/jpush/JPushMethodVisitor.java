package onekey.privacy.jpush;

import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Label;

public class JPushMethodVisitor extends MethodVisitor implements Opcodes {
    private final String methodName;
    private final String methodDesc;

    public JPushMethodVisitor(MethodVisitor methodVisitor, String methodName, String methodDesc) {
        super(Opcodes.ASM9, methodVisitor);
        this.methodName = methodName;
        this.methodDesc = methodDesc;
    }

    @Override
    public void visitCode() {
        super.visitCode();

        // 仅处理 directHandle 方法
        if ("directHandle".equals(methodName) && methodDesc.startsWith("(Landroid/content/Context;Ljava/lang/String;")) {
            // 创建标签用于条件跳转
            Label continueLabel = new Label();

            // 检查参数是否为null
            mv.visitVarInsn(ALOAD, 2); // 加载第2个参数(str)
            mv.visitJumpInsn(IFNULL, continueLabel);

            // "INTERNAL_API",
            // "cn.jpush.android.service.PushReceiver",
            // "cn.jpush.android.service.PushService", // exported false
            // "cn.jiguang.plugins.push.receiver.JPushModuleReceiver",
            // "cn.jiguang.plugins.push.receiver.JPushBroadcastReceiver",
            // "cn.jpush.android.service.SchedulerReceiver", // exported false
            // "cn.jpush.android.service.AlarmReceiver", // exported false
            // "cn.jiguang.plugins.service.JCoreModuleService"

            mv.visitVarInsn(ALOAD, 2);
            mv.visitLdcInsn("INTERNAL_API");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);
            mv.visitJumpInsn(IFNE, continueLabel);

            mv.visitVarInsn(ALOAD, 2);
            mv.visitLdcInsn("cn.jpush.android.service.PushReceiver");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);
            mv.visitJumpInsn(IFNE, continueLabel);

            mv.visitVarInsn(ALOAD, 2);
            mv.visitLdcInsn("cn.jiguang.plugins.push.receiver.JPushModuleReceiver");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);
            mv.visitJumpInsn(IFNE, continueLabel);

            mv.visitVarInsn(ALOAD, 2);
            mv.visitLdcInsn("cn.jiguang.plugins.push.receiver.JPushBroadcastReceiver");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);
            mv.visitJumpInsn(IFNE, continueLabel);

            mv.visitVarInsn(ALOAD, 2);
            mv.visitLdcInsn("cn.jiguang.plugins.service.JCoreModuleService");
            mv.visitMethodInsn(INVOKEVIRTUAL, "java/lang/String", "equals", "(Ljava/lang/Object;)Z", false);
            mv.visitJumpInsn(IFNE, continueLabel);

            // 如果不在允许列表中，返回新的空Bundle
            mv.visitTypeInsn(NEW, "android/os/Bundle");
            mv.visitInsn(DUP);
            mv.visitMethodInsn(INVOKESPECIAL, "android/os/Bundle", "<init>", "()V", false);
            mv.visitInsn(ARETURN);

            // 如果在允许列表中，继续执行原方法
            mv.visitLabel(continueLabel);
        }
    }
}
