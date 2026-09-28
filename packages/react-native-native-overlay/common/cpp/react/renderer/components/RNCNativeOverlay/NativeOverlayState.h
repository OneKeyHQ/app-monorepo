#pragma once

#include <react/renderer/graphics/Float.h>
#include <react/renderer/graphics/Point.h>

#ifdef RN_SERIALIZABLE_STATE
#include <folly/dynamic.h>
#endif

namespace facebook::react {

/*
 * Native moves an overlay's content out of the host view into its level
 * window, sheet, or page host. `contentOffset` is the window origin of the
 * view the content now lives in (0,0 for a full-window level; the sheet top
 * for a sheet), so `measure` / `measureInWindow` report on-screen frames.
 */
class NativeOverlayState final {
 public:
  NativeOverlayState() = default;
  explicit NativeOverlayState(Point contentOffset)
      : contentOffset(contentOffset) {}

  Point contentOffset{};

#ifdef RN_SERIALIZABLE_STATE
  NativeOverlayState(
      const NativeOverlayState & /*previousState*/,
      folly::dynamic data)
      : contentOffset(
            {static_cast<Float>(data["x"].getDouble()),
             static_cast<Float>(data["y"].getDouble())}) {}

  folly::dynamic getDynamic() const {
    return folly::dynamic::object("x", contentOffset.x)("y", contentOffset.y);
  }
#endif
};

} // namespace facebook::react
