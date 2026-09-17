cmake_minimum_required(VERSION 3.21)
project(epikodi-bench-qt LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)
qt_standard_project_setup(REQUIRES 6.5)

qt_add_executable(epikodi-bench-qt main.cpp bridge.h)
qt_add_qml_module(epikodi-bench-qt URI EpikodiBench VERSION 1.0 QML_FILES Main.qml)
target_link_libraries(epikodi-bench-qt PRIVATE Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2)
