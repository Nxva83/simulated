configure_file(Version.cpp.in ${CMAKE_CURRENT_BINARY_DIR}/Version.cpp @ONLY)

add_library(epikodi_core STATIC
    Version.h
    ${CMAKE_CURRENT_BINARY_DIR}/Version.cpp
)
target_include_directories(epikodi_core PUBLIC ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(epikodi_core PUBLIC Qt6::Core PRIVATE epikodi_warnings)
