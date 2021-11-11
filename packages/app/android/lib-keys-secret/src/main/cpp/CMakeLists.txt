cmake_minimum_required(VERSION 3.4.1)

set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -Os -Oz")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -Os -Oz")
set(CMAKE_C_VISIBILITY_PRESET hidden)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)

add_library(keys SHARED
        keys.c
        validation.c)

# Include libraries needed for native-lib lib
target_link_libraries(keys
                      android
                      log)