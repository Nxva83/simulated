add_subdirectory(core)
add_subdirectory(ui)

qt_add_executable(epikodi
    main.cpp
    app/QmlHotReloader.h
    app/QmlHotReloader.cpp
)
target_link_libraries(epikodi PRIVATE
    epikodi_core
    epikodi_uiplugin
    epikodi_warnings
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2
)

# En Debug, l'application charge les .qml depuis les sources et les recharge a la volee.
target_compile_definitions(epikodi PRIVATE
    $<$<CONFIG:Debug>:EPIKODI_QML_SOURCE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/ui">
)

set_target_properties(epikodi PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_GUI_IDENTIFIER fr.epitech.epikodi
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
)

install(TARGETS epikodi BUNDLE DESTINATION . RUNTIME DESTINATION bin)
