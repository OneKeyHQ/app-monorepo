#pragma once

#include <jsi/jsi.h>
#include <react/renderer/components/RNCNativeOverlay/EventEmitters.h>
#include <react/renderer/components/RNCNativeOverlay/Props.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

#include "NativeOverlayState.h"

namespace facebook::react {

JSI_EXPORT extern const char RNCNativeOverlayComponentName[];

class JSI_EXPORT RNCNativeOverlayShadowNode final
    : public ConcreteViewShadowNode<
          RNCNativeOverlayComponentName,
          RNCNativeOverlayProps,
          RNCNativeOverlayEventEmitter,
          NativeOverlayState> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;

  /*
   * Like <Modal>: the content is drawn outside the host's tree position, so
   * measurements stop at this node (a root) and the host is never culled.
   */
  static ShadowNodeTraits BaseTraits() {
    auto traits = ConcreteViewShadowNode::BaseTraits();
    traits.set(ShadowNodeTraits::Trait::RootNodeKind);
    traits.set(ShadowNodeTraits::Trait::Unstable_uncullableView);
    return traits;
  }

  /*
   * Measurements start at this node's origin, which native reports as the
   * window origin of wherever it presented the content.
   */
  Point getContentOriginOffset(bool includeTransform) const override;
};

} // namespace facebook::react
