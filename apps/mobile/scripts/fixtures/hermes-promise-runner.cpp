#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <fstream>
#include <iostream>
#include <sstream>
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  std::ifstream file(argv[1]);
  std::stringstream source;
  source << file.rdbuf();
  if (!file.good() && !file.eof()) return 3;
  auto config = hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build();
  auto runtime = facebook::hermes::makeHermesRuntime(config);
  try {
    auto result = runtime->evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(source.str()), "lockdown-fixture.js");
    runtime->drainMicrotasks();
    result = runtime->evaluateJavaScript(
        std::make_shared<facebook::jsi::StringBuffer>("JSON.stringify(globalThis.finishHermesPromiseFixture())"),
        "lockdown-fixture-result.js");
    std::cout << result.toString(*runtime).utf8(*runtime) << std::endl;
    return 0;
  } catch (const facebook::jsi::JSError &error) {
    std::cerr << error.what() << std::endl;
    return 1;
  }
}
