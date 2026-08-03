#include <jni.h>
#include "onekeynativecomponentsOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::onekeynativecomponents::initialize(vm);
}
