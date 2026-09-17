# react-native-update (pushy) OHOS CMake
# 两个产物：
#   1) rnupdate —— napi 差分核心 librnupdate.so（复用上游 pushy.cpp + cpp/patch_core +
#      android/jni 的 HDiffPatch/LZMA 源码，已 staging 到 android-generated/，
#      ETS 侧经 NativePatchCore.ts 的 `import ... from 'librnupdate.so'` 使用）
#   2) update —— 流水线 TurboModule C++ 代理（codegen 产物 generated/，
#      由宿主 App 经 autolinking.cmake add_subdirectory 编译，链接 rnoh）
cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---- 原生源 staging 目录（对齐上游 build-harmony-har.js 的 syncHarmonyNativeSources） ----
set(STAGED_NATIVE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/android-generated)
set(ANDROID_JNI_DIR ${STAGED_NATIVE_DIR}/jni)
set(PATCH_CORE_DIR ${STAGED_NATIVE_DIR}/patch_core)
set(UPDATE_FLOW_CORE_DIR ${STAGED_NATIVE_DIR}/update_flow_core)
set(HDIFFPATCH_DIR ${ANDROID_JNI_DIR}/HDiffPatch)
set(LZMA_DIR ${ANDROID_JNI_DIR}/lzma)

# Always compile from source. A prebuilt-import branch used to live here, but
# it had no symbol verification: a stale libs/<abi>/librnupdate.so missing a
# newly added export (e.g. getSupportedDiffVersion) would silently ship and
# crash getConstants at runtime.
set(HDP_SOURCES
     ${CMAKE_CURRENT_SOURCE_DIR}/pushy.cpp
     ${PATCH_CORE_DIR}/archive_patch_core.cpp
     ${PATCH_CORE_DIR}/digest.cpp
     ${PATCH_CORE_DIR}/hbc_transform.cpp
     ${PATCH_CORE_DIR}/hbc_transform_wire.cpp
     ${PATCH_CORE_DIR}/patch_core.cpp
     ${PATCH_CORE_DIR}/state_core.cpp
     ${UPDATE_FLOW_CORE_DIR}/flow_json.cpp
     ${UPDATE_FLOW_CORE_DIR}/update_flow_core.cpp
     ${ANDROID_JNI_DIR}/hpatch.c
     ${HDIFFPATCH_DIR}/libHDiffPatch/HPatch/patch.c
     ${HDIFFPATCH_DIR}/file_for_patch.c
     ${LZMA_DIR}/C/LzmaDec.c
     ${LZMA_DIR}/C/Lzma2Dec.c
)

add_library(rnupdate SHARED
    ${HDP_SOURCES}
)

target_include_directories(rnupdate PRIVATE
     ${CMAKE_CURRENT_SOURCE_DIR}
     ${PATCH_CORE_DIR}
     ${UPDATE_FLOW_CORE_DIR}
     ${ANDROID_JNI_DIR}
     ${HDIFFPATCH_DIR}
     ${HDIFFPATCH_DIR}/libHDiffPatch/HPatch
     ${LZMA_DIR}/C
)

target_link_libraries(rnupdate PUBLIC
    libace_napi.z.so
)

# Optimize binary size for Release builds of the NAPI library. --gc-sections
# only drops anything when every function/data item sits in its own section,
# and the module registers itself through NAPI_MODULE's static constructor,
# so no symbol needs default visibility.
if(NOT CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(rnupdate PRIVATE
        -ffunction-sections
        -fdata-sections
        -fvisibility=hidden
        -fvisibility-inlines-hidden
    )
    # Strip debug symbols and garbage-collect the unused sections.
    target_link_options(rnupdate PRIVATE -Wl,--gc-sections -s)
endif()

# ---- 流水线 TurboModule 代理（codegen 产物） ----
# react-native codegen-harmony 将 C++ 产物放在 generated/；#include 以 src/main/cpp 为根
# （如 generated/Foo.h），同时 generated 下的 .cpp 常使用 #include "Foo.h"，
# 故需同时加入 cpp 与 cpp/generated。注意：不要 GLOB 根目录 *.cpp，
# 根目录的 pushy.cpp 属于 rnupdate（napi 模块），不得编入 update。
set(library_generated_dir "${CMAKE_CURRENT_SOURCE_DIR}/generated")
# 不用 **/*.cpp：OHOS 自带 CMake 在 Windows 上常匹配不到，会得到空列表 → add_library 报 No SOURCES。
file(GLOB_RECURSE library_generated_SRC CONFIGURE_DEPENDS "${library_generated_dir}/*.cpp")
add_library(update SHARED ${library_generated_SRC})
target_include_directories(update PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${library_generated_dir})
target_link_libraries(update PUBLIC rnoh)
