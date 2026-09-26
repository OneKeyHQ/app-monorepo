cmake_minimum_required(VERSION 3.20)
project(onekey_usb_repair LANGUAGES CXX)

add_executable(onekey-usb-repair main.cpp)
target_compile_features(onekey-usb-repair PRIVATE cxx_std_17)
target_compile_definitions(onekey-usb-repair PRIVATE UNICODE _UNICODE)
target_link_libraries(onekey-usb-repair PRIVATE newdev setupapi shell32)
set_property(TARGET onekey-usb-repair PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
