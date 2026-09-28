#pragma once

#include <react/renderer/core/ConcreteComponentDescriptor.h>

#include "NativeOverlayShadowNode.h"

namespace facebook::react {

using RNCNativeOverlayComponentDescriptor =
    ConcreteComponentDescriptor<RNCNativeOverlayShadowNode>;

} // namespace facebook::react
