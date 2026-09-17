# Bibliotheque + module QML "Epikodi.Media" (types C++ exposes a QML via QML_ELEMENT).
qt_add_qml_module(epikodi_media STATIC
    URI Epikodi.Media
    VERSION 1.0
    OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/qml/Epikodi/Media
    SOURCES
        MediaFormats.h MediaFormats.cpp
        Player.h Player.cpp
)
target_include_directories(epikodi_media PUBLIC ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(epikodi_media
    PUBLIC Qt6::Core Qt6::Multimedia Qt6::Qml
    PRIVATE epikodi_warnings
)
