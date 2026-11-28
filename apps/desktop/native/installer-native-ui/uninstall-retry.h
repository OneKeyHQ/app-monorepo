#pragma once

#include <string>

namespace installer {

bool UninstallRetry(const std::wstring& path, const std::wstring& scope, bool launch);

}  // namespace installer
