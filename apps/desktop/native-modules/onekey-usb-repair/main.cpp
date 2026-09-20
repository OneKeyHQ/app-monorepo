#define WIN32_LEAN_AND_MEAN
// Windows types and GUID definitions must precede the device property keys.
// clang-format off
#include <windows.h>
#include <initguid.h>
#include <devpropdef.h>
#include <devpkey.h>
#include <newdev.h>
#include <setupapi.h>
#include <shellapi.h>
#include <string.h>
// clang-format on

#include <algorithm>
#include <cwctype>
#include <iostream>
#include <string>
#include <vector>

#pragma comment(lib, "newdev.lib")
#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "shell32.lib")

namespace {

constexpr wchar_t kDeviceId[] = L"USB\\VID_1209&PID_53C1";
constexpr wchar_t kInterfaceId[] = L"USB\\VID_1209&PID_53C1&MI_00";
constexpr wchar_t kWinUsbCompatibleId[] = L"USB\\MS_COMP_WINUSB";
constexpr DWORD kElevationTimeoutMs = 120000;

enum class Result : DWORD {
  Repaired = 0,
  AlreadyCorrect = 1,
  NoDevice = 2,
  MultipleDevices = 3,
  NoWinUsbDescriptor = 4,
  NoWinUsbDriver = 5,
  Cancelled = 6,
  RebootRequired = 7,
  Failed = 8,
};

bool Equal(const std::wstring &left, const wchar_t *right) {
  return _wcsicmp(left.c_str(), right) == 0;
}

std::vector<BYTE> GetProperty(HDEVINFO devices, SP_DEVINFO_DATA *device,
                              const DEVPROPKEY &key) {
  DEVPROPTYPE type = 0;
  DWORD required = 0;
  SetupDiGetDevicePropertyW(devices, device, &key, &type, nullptr, 0, &required,
                            0);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || required == 0) {
    return {};
  }
  std::vector<BYTE> value(required);
  if (!SetupDiGetDevicePropertyW(devices, device, &key, &type, value.data(),
                                 required, nullptr, 0)) {
    return {};
  }
  return value;
}

std::vector<std::wstring> GetStringList(HDEVINFO devices,
                                        SP_DEVINFO_DATA *device,
                                        const DEVPROPKEY &key) {
  const auto bytes = GetProperty(devices, device, key);
  if (bytes.size() < 2 * sizeof(wchar_t) ||
      bytes.size() % sizeof(wchar_t) != 0) {
    return {};
  }
  const auto *strings = reinterpret_cast<const wchar_t *>(bytes.data());
  const size_t length = bytes.size() / sizeof(wchar_t);
  std::vector<std::wstring> result;
  for (size_t i = 0; i < length && strings[i] != L'\0';) {
    size_t end = i;
    while (end < length && strings[end] != L'\0') {
      ++end;
    }
    if (end == length) {
      return {};
    }
    result.emplace_back(strings + i, end - i);
    i = end + 1;
  }
  return result;
}

std::wstring GetString(HDEVINFO devices, SP_DEVINFO_DATA *device,
                       const DEVPROPKEY &key) {
  const auto bytes = GetProperty(devices, device, key);
  if (bytes.size() < sizeof(wchar_t) || bytes.size() % sizeof(wchar_t) != 0) {
    return {};
  }
  const auto *value = reinterpret_cast<const wchar_t *>(bytes.data());
  const size_t length = bytes.size() / sizeof(wchar_t);
  if (value[length - 1] != L'\0') {
    return {};
  }
  return std::wstring(value);
}

bool HasId(const std::vector<std::wstring> &ids, const wchar_t *expected) {
  return std::any_of(ids.begin(), ids.end(), [expected](const auto &id) {
    return Equal(id, expected);
  });
}

struct Candidate {
  SP_DEVINFO_DATA device{};
  bool hasWinUsbDescriptor = false;
  bool usesWinUsb = false;
};

std::vector<Candidate> FindCandidates(HDEVINFO devices) {
  std::vector<Candidate> interfaces;
  std::vector<Candidate> devicesWithoutInterface;
  for (DWORD index = 0;; ++index) {
    SP_DEVINFO_DATA device{};
    device.cbSize = sizeof(device);
    if (!SetupDiEnumDeviceInfo(devices, index, &device)) {
      break;
    }
    const auto hardwareIds =
        GetStringList(devices, &device, DEVPKEY_Device_HardwareIds);
    const bool isInterface = HasId(hardwareIds, kInterfaceId);
    if (!isInterface && !HasId(hardwareIds, kDeviceId)) {
      continue;
    }
    const auto compatibleIds =
        GetStringList(devices, &device, DEVPKEY_Device_CompatibleIds);
    const auto service = GetString(devices, &device, DEVPKEY_Device_Service);
    auto &candidates = isInterface ? interfaces : devicesWithoutInterface;
    candidates.push_back({device, HasId(compatibleIds, kWinUsbCompatibleId),
                          Equal(service, L"WinUSB")});
  }
  // A composite device exposes both its parent and MI_00 child. Never bind
  // WinUSB to the parent when the interface node exists.
  return interfaces.empty() ? devicesWithoutInterface : interfaces;
}

bool FindInboxWinUsbDriver(HDEVINFO devices, SP_DEVINFO_DATA *device,
                           SP_DRVINFO_DATA_W *selected) {
  SP_DEVINSTALL_PARAMS_W params{};
  params.cbSize = sizeof(params);
  if (!SetupDiGetDeviceInstallParamsW(devices, device, &params)) {
    return false;
  }
  params.FlagsEx |= DI_FLAGSEX_ALLOWEXCLUDEDDRVS;
  if (!SetupDiSetDeviceInstallParamsW(devices, device, &params)) {
    return false;
  }
  if (!SetupDiBuildDriverInfoList(devices, device, SPDIT_COMPATDRIVER)) {
    return false;
  }
  for (DWORD index = 0;; ++index) {
    SP_DRVINFO_DATA_W driver{};
    driver.cbSize = sizeof(driver);
    if (!SetupDiEnumDriverInfoW(devices, device, SPDIT_COMPATDRIVER, index,
                                &driver)) {
      break;
    }
    std::vector<BYTE> buffer(sizeof(SP_DRVINFO_DETAIL_DATA_W) + 4096);
    auto *detail = reinterpret_cast<SP_DRVINFO_DETAIL_DATA_W *>(buffer.data());
    detail->cbSize = sizeof(SP_DRVINFO_DETAIL_DATA_W);
    DWORD required = 0;
    if (!SetupDiGetDriverInfoDetailW(devices, device, &driver, detail,
                                     static_cast<DWORD>(buffer.size()),
                                     &required) &&
        GetLastError() != ERROR_INSUFFICIENT_BUFFER) {
      continue;
    }
    const std::wstring path(detail->InfFileName);
    const auto lastSlash = path.find_last_of(L"\\/");
    const auto name =
        path.substr(lastSlash == std::wstring::npos ? 0 : lastSlash + 1);
    if (Equal(name, L"winusb.inf")) {
      *selected = driver;
      return true;
    }
  }
  SetupDiDestroyDriverInfoList(devices, device, SPDIT_COMPATDRIVER);
  return false;
}

Result RepairElevated() {
  HDEVINFO devices = SetupDiGetClassDevsW(nullptr, nullptr, nullptr,
                                          DIGCF_ALLCLASSES | DIGCF_PRESENT);
  if (devices == INVALID_HANDLE_VALUE) {
    return Result::Failed;
  }
  const auto candidates = FindCandidates(devices);
  Result result = Result::Failed;
  if (candidates.empty()) {
    result = Result::NoDevice;
  } else if (candidates.size() != 1) {
    result = Result::MultipleDevices;
  } else if (candidates[0].usesWinUsb) {
    result = Result::AlreadyCorrect;
  } else if (!candidates[0].hasWinUsbDescriptor) {
    result = Result::NoWinUsbDescriptor;
  } else {
    auto device = candidates[0].device;
    SP_DRVINFO_DATA_W driver{};
    if (!FindInboxWinUsbDriver(devices, &device, &driver)) {
      result = Result::NoWinUsbDriver;
    } else {
      BOOL rebootRequired = FALSE;
      result =
          DiInstallDevice(nullptr, devices, &device, &driver, 0,
                          &rebootRequired)
              ? (rebootRequired ? Result::RebootRequired : Result::Repaired)
              : Result::Failed;
      SetupDiDestroyDriverInfoList(devices, &device, SPDIT_COMPATDRIVER);
    }
  }
  SetupDiDestroyDeviceInfoList(devices);
  return result;
}

Result RunElevated() {
  std::vector<wchar_t> modulePath(32768);
  const DWORD length = GetModuleFileNameW(
      nullptr, modulePath.data(), static_cast<DWORD>(modulePath.size()));
  if (length == 0 || length >= modulePath.size()) {
    return Result::Failed;
  }

  SHELLEXECUTEINFOW request{};
  request.cbSize = sizeof(request);
  request.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_FLAG_NO_UI;
  request.lpVerb = L"runas";
  request.lpFile = modulePath.data();
  request.lpParameters = L"--elevated";
  request.nShow = SW_HIDE;
  if (!ShellExecuteExW(&request)) {
    return GetLastError() == ERROR_CANCELLED ? Result::Cancelled
                                             : Result::Failed;
  }
  const DWORD wait = WaitForSingleObject(request.hProcess, kElevationTimeoutMs);
  DWORD code = static_cast<DWORD>(Result::Failed);
  if (wait != WAIT_OBJECT_0 || !GetExitCodeProcess(request.hProcess, &code)) {
    code = static_cast<DWORD>(Result::Failed);
  }
  CloseHandle(request.hProcess);
  return code <= static_cast<DWORD>(Result::Failed) ? static_cast<Result>(code)
                                                    : Result::Failed;
}

const char *Status(Result result) {
  switch (result) {
  case Result::Repaired:
    return "repaired";
  case Result::AlreadyCorrect:
    return "already-correct";
  case Result::NoDevice:
    return "no-device";
  case Result::MultipleDevices:
    return "multiple-devices";
  case Result::NoWinUsbDescriptor:
    return "no-winusb-descriptor";
  case Result::NoWinUsbDriver:
    return "no-winusb-driver";
  case Result::Cancelled:
    return "cancelled";
  case Result::RebootRequired:
    return "reboot-required";
  case Result::Failed:
    return "failed";
  }
  return "failed";
}

} // namespace

int wmain(int argc, wchar_t *argv[]) {
  if (argc != 2) {
    return static_cast<int>(Result::Failed);
  }
  if (_wcsicmp(argv[1], L"--elevated") == 0) {
    return static_cast<int>(RepairElevated());
  }
  if (_wcsicmp(argv[1], L"repair") != 0) {
    return static_cast<int>(Result::Failed);
  }

  HDEVINFO devices = SetupDiGetClassDevsW(nullptr, nullptr, nullptr,
                                          DIGCF_ALLCLASSES | DIGCF_PRESENT);
  if (devices == INVALID_HANDLE_VALUE) {
    std::cout << "{\"status\":\"failed\"}\n";
    return 0;
  }
  const auto candidates = FindCandidates(devices);
  SetupDiDestroyDeviceInfoList(devices);

  Result result = Result::Failed;
  if (candidates.empty()) {
    result = Result::NoDevice;
  } else if (candidates.size() != 1) {
    result = Result::MultipleDevices;
  } else if (candidates[0].usesWinUsb) {
    result = Result::AlreadyCorrect;
  } else if (!candidates[0].hasWinUsbDescriptor) {
    result = Result::NoWinUsbDescriptor;
  } else {
    result = RunElevated();
    if (result == Result::Repaired) {
      HDEVINFO refreshed = SetupDiGetClassDevsW(
          nullptr, nullptr, nullptr, DIGCF_ALLCLASSES | DIGCF_PRESENT);
      if (refreshed == INVALID_HANDLE_VALUE) {
        result = Result::Failed;
      } else {
        const auto after = FindCandidates(refreshed);
        result = after.size() == 1 && after[0].usesWinUsb ? Result::Repaired
                                                          : Result::Failed;
        SetupDiDestroyDeviceInfoList(refreshed);
      }
    }
  }

  std::cout << "{\"status\":\"" << Status(result) << "\"}\n";
  return 0;
}
