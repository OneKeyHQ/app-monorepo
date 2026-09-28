#include "NativeOverlayShadowNode.h"

namespace facebook::react {

extern const char RNCNativeOverlayComponentName[] = "RNCNativeOverlay";

Point RNCNativeOverlayShadowNode::getContentOriginOffset(
    bool /*includeTransform*/) const {
  return getStateData().contentOffset;
}

} // namespace facebook::react
