qt_add_qml_module(epikodi_ui STATIC
    URI Epikodi.Ui
    VERSION 1.0
    OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/qml/Epikodi/Ui   # attendu par qmllint / qmlls
    QML_FILES
        Main.qml
        PlayerView.qml
        components/SidebarItem.qml
)
target_link_libraries(epikodi_ui PRIVATE Qt6::Quick epikodi_media)
