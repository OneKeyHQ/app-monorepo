using System;
using System.Runtime.InteropServices;
using Accessibility;

public static class FixtureAccessibility {
    [DllImport("oleacc.dll")]
    static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid iid,
                                                   [MarshalAs(UnmanagedType.Interface)] out IAccessible root);

    [DllImport("oleacc.dll")]
    static extern int AccessibleChildren(IAccessible root, int start, int count,
        [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] object[] children, out int found);

    public sealed class Session {
        internal readonly IAccessible Accessible;
        internal Session(IAccessible accessible) { Accessible = accessible; }
    }

    public static Session Root(IntPtr window) {
        var iid = typeof(IAccessible).GUID;
        IAccessible root;
        Marshal.ThrowExceptionForHR(AccessibleObjectFromWindow(window, 0xFFFFFFFC, ref iid, out root));
        return new Session(root);
    }

    public static int Find(Session root, string expectedName, int role) {
        var children = new object[root.Accessible.accChildCount];
        int found;
        Marshal.ThrowExceptionForHR(AccessibleChildren(root.Accessible, 0, children.Length, children, out found));
        for (int i = 0; i < found; ++i) {
            int child = (int)children[i];
            if (root.Accessible.get_accName(child) == expectedName && (int)root.Accessible.get_accRole(child) == role) {
                return child;
            }
        }
        throw new InvalidOperationException("Missing accessible name and role: " + expectedName);
    }

    public static void CheckRoot(Session root, string name) {
        if (root.Accessible.get_accName(0) != name || (int)root.Accessible.get_accRole(0) != 18) {
            throw new InvalidOperationException("Missing accessible dialog: " + name);
        }
    }

    public static void CheckState(Session root, int child, int flags, bool present) {
        if ((((int)root.Accessible.get_accState(child) & flags) == flags) != present) {
            throw new InvalidOperationException("Unexpected accessible state: " + root.Accessible.get_accName(child));
        }
    }

    public static string Status(Session root, int progress) {
        var text = root.Accessible.get_accDescription(progress);
        if (String.IsNullOrEmpty(text)) throw new InvalidOperationException("Missing progress status");
        return text;
    }

    public static void CheckValue(Session root, int child, string expected) {
        if (root.Accessible.get_accValue(child) != expected) {
            throw new InvalidOperationException("Unexpected accessible progress value");
        }
    }

    public static void TakeFocus(Session root, int child) {
        root.Accessible.accSelect(1, child);
        if (!Equals(root.Accessible.accFocus, child)) {
            throw new InvalidOperationException("Accessible control did not receive focus");
        }
        CheckState(root, child, 4, true);
    }

    public static void Invoke(Session root, int child) {
        if (String.IsNullOrEmpty(root.Accessible.get_accDefaultAction(child))) {
            throw new InvalidOperationException("Missing accessible default action");
        }
        root.Accessible.accDoDefaultAction(child);
    }

    public static void CheckRejectedInvocation(Session root, int child, int expectedHresult) {
        try {
            root.Accessible.accDoDefaultAction(child);
        } catch (Exception error) {
            if (error.HResult == expectedHresult) return;
            throw;
        }
        throw new InvalidOperationException("Accessible control accepted an invalid action");
    }

    public static void CheckLocation(Session root, int child) {
        int x, y, width, height;
        root.Accessible.accLocation(out x, out y, out width, out height, child);
        if (width <= 0 || height <= 0 || !Equals(root.Accessible.accHitTest(x + width / 2, y + height / 2), child)) {
            throw new InvalidOperationException("Accessible hit test missed " + root.Accessible.get_accName(child));
        }
    }
}
