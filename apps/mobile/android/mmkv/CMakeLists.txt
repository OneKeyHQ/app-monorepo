cmake_minimum_required(VERSION 3.13)
project(mmkv)

if(NOT DEFINED MMKV_SOURCE_DIR)
    message(FATAL_ERROR "MMKV_SOURCE_DIR must point to the verified MMKV sources")
endif()

add_subdirectory("${MMKV_SOURCE_DIR}/Core" Core)
add_library(mmkv SHARED
    "${MMKV_SOURCE_DIR}/Android/MMKV/mmkv/src/main/cpp/native-bridge.cpp"
    "${MMKV_SOURCE_DIR}/Android/MMKV/mmkv/src/main/cpp/flutter-bridge.cpp"
)
set_target_properties(mmkv PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF POSITION_INDEPENDENT_CODE ON)
# NDK r27 library targets do not inherit the React Native application's page-size flags.
target_link_options(mmkv PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384")
find_library(android-log log REQUIRED)
target_link_libraries(mmkv PRIVATE core ${android-log})
