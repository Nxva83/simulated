find_package(Qt6 REQUIRED COMPONENTS Test)

function(epikodi_add_test name)
    qt_add_executable(${name} ${ARGN})
    target_link_libraries(${name} PRIVATE epikodi_core epikodi_warnings Qt6::Test)
    add_test(NAME ${name} COMMAND ${name})
endfunction()

epikodi_add_test(test_version test_version.cpp)
