cmake_minimum_required(VERSION 3.25)

project(EPIKODI
    VERSION 0.1.0
    DESCRIPTION "Centre multimedia desktop libre inspire de Kodi"
    HOMEPAGE_URL "https://github.com/Nxva83/simulated"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)   # pour clang-tidy / IDE

option(EPIKODI_BUILD_TESTS "Compiler les tests" ON)
option(EPIKODI_WARNINGS_AS_ERRORS "Traiter les warnings comme des erreurs" OFF)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)
qt_standard_project_setup(REQUIRES 6.5)
qt_policy(SET QTP0001 NEW)  # prefixe de ressource /qt/qml pour les modules QML
qt_policy(SET QTP0004 NEW)  # qmldir genere pour les sous-dossiers QML (components/)

# Options de compilation communes a toutes les cibles du projet.
add_library(epikodi_warnings INTERFACE)
if(MSVC)
    target_compile_options(epikodi_warnings INTERFACE /W4 /permissive- /utf-8)
    if(EPIKODI_WARNINGS_AS_ERRORS)
        target_compile_options(epikodi_warnings INTERFACE /WX)
    endif()
else()
    target_compile_options(epikodi_warnings INTERFACE -Wall -Wextra -Wpedantic -Wshadow -Wconversion)
    if(EPIKODI_WARNINGS_AS_ERRORS)
        target_compile_options(epikodi_warnings INTERFACE -Werror)
    endif()
endif()

add_subdirectory(src)

if(EPIKODI_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
