cmake_minimum_required(VERSION 3.24)
project(onekey_installer_ui LANGUAGES CXX RC)

if(NOT MSVC OR NOT CMAKE_SIZEOF_VOID_P EQUAL 4)
  message(FATAL_ERROR "The Unicode NSIS plugin requires MSVC targeting Win32/x86")
endif()

find_program(POWERSHELL_EXECUTABLE NAMES pwsh powershell REQUIRED)
set(THEME_DIR "${CMAKE_CURRENT_SOURCE_DIR}/theme")
file(GLOB THEME_INPUTS CONFIGURE_DEPENDS
  "${THEME_DIR}/*.json" "${THEME_DIR}/locales/*.json" "${THEME_DIR}/pages/*.xml")
set(THEME_HEADER "${CMAKE_CURRENT_BINARY_DIR}/generated-theme.inc")
add_custom_command(
  OUTPUT "${THEME_HEADER}"
  COMMAND "${POWERSHELL_EXECUTABLE}" -NoProfile -NonInteractive -ExecutionPolicy Bypass
    -File "${CMAKE_CURRENT_SOURCE_DIR}/compile-theme.ps1"
    -ThemeDirectory "${THEME_DIR}" -OutputFile "${THEME_HEADER}"
  DEPENDS compile-theme.ps1 ${THEME_INPUTS}
  VERBATIM
)

configure_file(licenses.rc.in licenses.rc @ONLY)
add_library(onekey-installer-ui SHARED
  plugin.cpp window.cpp accessibility.cpp theme.cpp paint.cpp onekey-installer-ui.def "${THEME_HEADER}"
  "${CMAKE_CURRENT_BINARY_DIR}/licenses.rc")
target_include_directories(onekey-installer-ui PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
target_compile_features(onekey-installer-ui PRIVATE cxx_std_17)
target_compile_definitions(onekey-installer-ui PRIVATE
  UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX WINVER=0x0A00 _WIN32_WINNT=0x0A00)
target_compile_options(onekey-installer-ui PRIVATE /W4 /permissive- /utf-8)
target_link_libraries(onekey-installer-ui PRIVATE comctl32 dwmapi gdiplus gdi32 shell32 user32 ole32 oleacc oleaut32 uuid)
set_target_properties(onekey-installer-ui PROPERTIES
  MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
