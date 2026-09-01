cmake_minimum_required(VERSION 3.16)
project(pear-browser VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets WebEngineWidgets)

add_executable(pear-browser
    src/main.cpp
    src/BrowserWindow.cpp
    src/RequestInterceptor.cpp
)

target_link_libraries(pear-browser PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::WebEngineWidgets
)

install(TARGETS pear-browser RUNTIME DESTINATION bin)
