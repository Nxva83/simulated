find_package(Qt6 REQUIRED COMPONENTS Test Gui)

set(EPIKODI_FIXTURES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/fixtures)

# epikodi_add_test(<nom> <sources...> [LIBS <cibles...>])
function(epikodi_add_test name)
    cmake_parse_arguments(ARG "" "" "LIBS" ${ARGN})
    qt_add_executable(${name} ${ARG_UNPARSED_ARGUMENTS})
    target_link_libraries(${name} PRIVATE epikodi_core epikodi_warnings Qt6::Test ${ARG_LIBS})
    target_compile_definitions(${name} PRIVATE EPIKODI_FIXTURES_DIR="${EPIKODI_FIXTURES_DIR}")
    add_test(NAME ${name} COMMAND ${name})
    # Hors ecran : les tests tournent sans serveur graphique (CI).
    set_tests_properties(${name} PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
endfunction()

epikodi_add_test(test_version test_version.cpp)
epikodi_add_test(test_media_formats test_media_formats.cpp LIBS epikodi_media)
epikodi_add_test(test_player test_player.cpp LIBS epikodi_media Qt6::Gui)
