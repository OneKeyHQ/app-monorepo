#include "uninstall-retry.h"

#include <windows.h>

#include <array>
#include <cstring>
#include <memory>
#include <vector>

namespace installer {
namespace {

struct Close {
  void operator()(HANDLE handle) const { CloseHandle(handle); }
};
using File = std::unique_ptr<void, Close>;

File Open(const std::wstring& path, DWORD access, DWORD share) {
  const auto handle = CreateFileW(path.c_str(), access, share, nullptr, OPEN_EXISTING,
                                  FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                                  nullptr);
  return File(handle == INVALID_HANDLE_VALUE ? nullptr : handle);
}

bool SameImage(HANDLE candidate, HANDLE running) {
  LARGE_INTEGER candidate_size{}, running_size{};
  if (!GetFileSizeEx(candidate, &candidate_size) || !GetFileSizeEx(running, &running_size) ||
      candidate_size.QuadPart != running_size.QuadPart || candidate_size.QuadPart == 0) {
    return false;
  }
  std::array<char, 16384> left{}, right{};
  for (;;) {
    DWORD read_left = 0, read_right = 0;
    if (!ReadFile(candidate, left.data(), static_cast<DWORD>(left.size()), &read_left, nullptr) ||
        !ReadFile(running, right.data(), static_cast<DWORD>(right.size()), &read_right, nullptr) ||
        read_left != read_right || std::memcmp(left.data(), right.data(), read_left) != 0) {
      return false;
    }
    if (read_left == 0) return true;
  }
}

}  // namespace

bool UninstallRetry(const std::wstring& path, const std::wstring& scope, bool launch) {
  if ((scope != L"/allusers" && scope != L"/currentuser") || path.size() < 4 ||
      path[1] != L':' || path[2] != L'\\' || path.find(L'"') != std::wstring::npos ||
      GetDriveTypeW(path.substr(0, 3).c_str()) != DRIVE_FIXED) {
    return false;
  }
  wchar_t resolved[1024]{};
  wchar_t volume[MAX_PATH]{};
  if (!GetVolumeNameForVolumeMountPointW(path.substr(0, 3).c_str(), volume,
                                       static_cast<DWORD>(std::size(volume)))) {
    return false;
  }
  const auto full_length = GetFullPathNameW(path.c_str(), static_cast<DWORD>(std::size(resolved)),
                                           resolved, nullptr);
  if (!full_length || full_length >= std::size(resolved) || path != resolved) return false;

  const auto extended = L"\\\\?\\" + path;
  std::vector<File> ancestors;
  for (auto end = path.find(L'\\', 3); end != std::wstring::npos; end = path.find(L'\\', end + 1)) {
    auto directory = Open(extended.substr(0, end + 4), FILE_READ_ATTRIBUTES, FILE_SHARE_READ);
    BY_HANDLE_FILE_INFORMATION attributes{};
    if (!directory || !GetFileInformationByHandle(directory.get(), &attributes) ||
        (attributes.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) !=
            FILE_ATTRIBUTE_DIRECTORY) {
      return false;
    }
    ancestors.push_back(std::move(directory));
  }
  const auto candidate = Open(extended, GENERIC_READ, FILE_SHARE_READ);
  BY_HANDLE_FILE_INFORMATION attributes{};
  if (!candidate || !GetFileInformationByHandle(candidate.get(), &attributes) ||
      (attributes.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) ||
      attributes.nNumberOfLinks != 1) {
    return false;
  }
  wchar_t process_path[1024]{};
  const auto process_length = GetModuleFileNameW(nullptr, process_path,
                                                static_cast<DWORD>(std::size(process_path)));
  if (!process_length || process_length >= std::size(process_path)) return false;
  const auto running = Open(process_path, GENERIC_READ, FILE_SHARE_READ);
  if (!running || !SameImage(candidate.get(), running.get())) return false;
  if (!launch) return true;

  std::wstring command = L"\"" + path + L"\" " + scope;
  wchar_t system_dir[MAX_PATH]{};
  const auto system_length = GetSystemDirectoryW(system_dir, static_cast<UINT>(std::size(system_dir)));
  if (!system_length || system_length >= std::size(system_dir)) return false;
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION child{};
  if (!CreateProcessW(path.c_str(), command.data(), nullptr, nullptr, FALSE, 0, nullptr,
                      system_dir, &startup, &child)) {
    return false;
  }
  CloseHandle(child.hThread);
  CloseHandle(child.hProcess);
  return true;
}

}  // namespace installer
