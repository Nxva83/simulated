#pragma once

namespace epikodi {

/// Version semantique du projet, injectee par CMake (project(... VERSION x.y.z)).
const char* version() noexcept;
int versionMajor() noexcept;
int versionMinor() noexcept;
int versionPatch() noexcept;

} // namespace epikodi
