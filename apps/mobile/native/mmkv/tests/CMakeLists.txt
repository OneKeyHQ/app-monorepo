cmake_minimum_required(VERSION 3.10)
project(mmkv_checked_sync_tests)

if(NOT DEFINED MMKV_SOURCE_DIR)
    message(FATAL_ERROR "Pass the source path printed by development/scripts/prepare-mmkv-source.js")
endif()

# Upstream CMake generates headers in its source tree. Keep host-test output
# separate from the source tree used concurrently by Android prefab/CocoaPods.
file(COPY "${MMKV_SOURCE_DIR}/Core" DESTINATION "${CMAKE_CURRENT_BINARY_DIR}/mmkv-source")
set(TEST_CORE_SOURCE "${CMAKE_CURRENT_BINARY_DIR}/mmkv-source/Core")
add_subdirectory("${TEST_CORE_SOURCE}" Core)
add_executable(sync_regression sync_regression.cpp)
target_compile_features(sync_regression PRIVATE cxx_std_20)
target_compile_definitions(sync_regression PRIVATE FORCE_POSIX NEW_API)
target_include_directories(sync_regression PRIVATE "${TEST_CORE_SOURCE}")
target_link_libraries(sync_regression PRIVATE core ${CMAKE_DL_LIBS})
enable_testing()
add_test(NAME checked_sync COMMAND sync_regression)
set_tests_properties(checked_sync PROPERTIES TIMEOUT 30)
