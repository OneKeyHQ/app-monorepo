#pragma once

#include <ReactCommon/JavaTurboModule.h>
#include <ReactCommon/TurboModule.h>
#include <jsi/jsi.h>

// Shadows the codegen header of the same name so autolinking, which
// includes it before ComponentDescriptors.h, sees the hand-written
// RNCNativeOverlayComponentDescriptor.
#include <react/renderer/components/RNCNativeOverlay/NativeOverlayComponentDescriptor.h>

namespace facebook::react {

JSI_EXPORT
std::shared_ptr<TurboModule> RNCNativeOverlay_ModuleProvider(
    const std::string &moduleName,
    const JavaTurboModule::InitParams &params);

} // namespace facebook::react
