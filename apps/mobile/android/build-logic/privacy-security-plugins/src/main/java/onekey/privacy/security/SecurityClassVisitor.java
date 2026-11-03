package onekey.privacy.security;

import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

import onekey.privacy.jpush.JPushMethodVisitor;

public class SecurityClassVisitor extends ClassVisitor {
    private static final String INTERCOM_ATTACHMENT_SETTINGS = "io/intercom/android/sdk/models/AttachmentSettings";
    private String className;
    private boolean intercomVoiceNotesGetterFound;
    private boolean intercomVoiceNotesGetterReplaced;

    public SecurityClassVisitor(ClassVisitor classVisitor) {
        super(Opcodes.ASM9, classVisitor);
    }


    @Override
    public void visit(int version, int access, String name, String signature, String superName, String[] interfaces) {
        this.className = name;
        intercomVoiceNotesGetterFound = false;
        intercomVoiceNotesGetterReplaced = false;
        super.visit(version, access, name, signature, superName, interfaces);
    }

    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor,
                                     String signature, String[] exceptions) {
        boolean intercomVoiceNotesGetter = INTERCOM_ATTACHMENT_SETTINGS.equals(className) &&
                "getVoiceNotesEnabled".equals(name);
        if (intercomVoiceNotesGetter) {
            int requiredAccess = Opcodes.ACC_PUBLIC | Opcodes.ACC_FINAL;
            int unsupportedAccess = Opcodes.ACC_STATIC | Opcodes.ACC_ABSTRACT | Opcodes.ACC_NATIVE;
            if (!"()Z".equals(descriptor) || (access & requiredAccess) != requiredAccess ||
                    (access & unsupportedAccess) != 0 || intercomVoiceNotesGetterFound) {
                throw new IllegalStateException("Unsupported Intercom AttachmentSettings.getVoiceNotesEnabled contract");
            }
            intercomVoiceNotesGetterFound = true;
        }

        MethodVisitor methodVisitor = super.visitMethod(access, name, descriptor, signature, exceptions);
        if (intercomVoiceNotesGetter) {
            if (methodVisitor == null) {
                throw new IllegalStateException("Missing Intercom voice notes method visitor");
            }
            return new MethodVisitor(Opcodes.ASM9, methodVisitor) {
                @Override
                public void visitCode() {
                    // Preserve declaration metadata, then discard the original code and code-scoped metadata.
                    MethodVisitor delegate = mv;
                    mv = null;
                    delegate.visitCode();
                    delegate.visitInsn(Opcodes.ICONST_0);
                    delegate.visitInsn(Opcodes.IRETURN);
                    delegate.visitMaxs(1, 1);
                    delegate.visitEnd();
                    intercomVoiceNotesGetterReplaced = true;
                }
            };
        }

        if (methodVisitor != null) {
            if ("cn/jiguang/internal/JCoreInternalHelper".equals(className) && "directHandle".equals(name)) {
                return new JPushMethodVisitor(methodVisitor, name, descriptor);
            }
        }

        return methodVisitor;
    }

    @Override
    public void visitEnd() {
        if (INTERCOM_ATTACHMENT_SETTINGS.equals(className) && !intercomVoiceNotesGetterReplaced) {
            throw new IllegalStateException("Missing concrete Intercom AttachmentSettings.getVoiceNotesEnabled()Z");
        }
        super.visitEnd();
    }
}
