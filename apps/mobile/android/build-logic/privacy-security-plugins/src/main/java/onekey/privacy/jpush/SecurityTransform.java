package onekey.privacy.jpush;

import com.android.build.api.instrumentation.*;
import org.objectweb.asm.ClassVisitor;

public abstract class SecurityTransform implements AsmClassVisitorFactory<InstrumentationParameters.None> {
    @Override
    public ClassVisitor createClassVisitor(ClassContext context, ClassVisitor next) {
        return new SecurityClassVisitor(next);
    }

    @Override
    public boolean isInstrumentable(ClassData classData) {
        String className = classData.getClassName();
        return className.equals("cn.jiguang.internal.JCoreInternalHelper");
    }
}
