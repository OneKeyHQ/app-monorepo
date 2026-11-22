#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <bcrypt.h>
#include <shlobj.h>
#include <softpub.h>
#include <wintrust.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdio>
#include <cstring>
#include <limits>
#include <map>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "uuid.lib")

#if !defined(ONEKEY_RECOVERY_TEST) && !defined(ONEKEY_RECOVERY_PUBLISHERS)
#error Production recovery requires an approved Authenticode publisher certificate.
#endif

namespace {
// Signed installer contract: prepare stages files, promote publishes them, then commit
// checks registration. Recover restores only before publication and otherwise asks
// the matching installer to finish registration. See README.md for exit codes.
[[maybe_unused]] constexpr wchar_t kInstallKey[] = L"Software\\c63242f1-2b62-5725-b853-31b79889ccf8";
[[maybe_unused]] constexpr wchar_t kUninstallKey[] =
    L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\c63242f1-2b62-5725-b853-31b79889ccf8";
[[maybe_unused]] constexpr wchar_t kJournalKey[] = L"Software\\OneKey\\InstallerDirectoryRecovery";
constexpr wchar_t kUninstaller[] = L"Uninstall OneKey.exe";
constexpr wchar_t kExecutable[] = L"OneKey.exe";
constexpr wchar_t kInventory[] = L"OneKeyInstallerInventory.dll";
constexpr wchar_t kEnrollment[] = L"InventoryEnrolledV1";
constexpr wchar_t kRecord[] = L"TransactionV1";
constexpr size_t kPathCapacity = 1024;
constexpr size_t kDigestLength = 64;
constexpr size_t kInventoryLimit = 8 * 1024 * 1024;
constexpr size_t kCarrierLimit = kInventoryLimit + 256 * 1024;

enum Result { Ok = 0, Ineligible = 10, Restored = 11, Resume = 12, Blocked = 13 };
enum class Phase : DWORD { Creating = 1, Staging, Swapping, Restoring, Promoted };

struct Error {
  const char* operation;
  DWORD code;
  Result result;
};

[[noreturn]] void fail(const char* operation, DWORD code = ERROR_INVALID_DATA,
                       Result result = Blocked) {
  throw Error{operation, code, result};
}

void check(BOOL ok, const char* operation) {
  if (!ok) fail(operation, GetLastError());
}

void checkReg(LSTATUS status, const char* operation) {
  if (status != ERROR_SUCCESS) fail(operation, static_cast<DWORD>(status));
}

struct Handle {
  HANDLE value = INVALID_HANDLE_VALUE;
  explicit Handle(HANDLE handle = INVALID_HANDLE_VALUE) : value(handle) {}
  ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value(other.value) { other.value = INVALID_HANDLE_VALUE; }
};

struct FindHandle {
  HANDLE value;
  ~FindHandle() { if (value != INVALID_HANDLE_VALUE) FindClose(value); }
};

struct RegKey {
  HKEY value = nullptr;
  ~RegKey() { if (value) RegCloseKey(value); }
  RegKey() = default;
  RegKey(const RegKey&) = delete;
  RegKey& operator=(const RegKey&) = delete;
  RegKey(RegKey&& other) noexcept : value(other.value) { other.value = nullptr; }
};

bool missing(DWORD error) {
  return error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND;
}

bool equal(const std::wstring& left, const std::wstring& right) {
  return CompareStringOrdinal(left.c_str(), -1, right.c_str(), -1, TRUE) == CSTR_EQUAL;
}

struct CaseInsensitive {
  bool operator()(const std::wstring& left, const std::wstring& right) const {
    return CompareStringOrdinal(left.c_str(), -1, right.c_str(), -1, TRUE) == CSTR_LESS_THAN;
  }
};

bool hex(const std::wstring& text, size_t size) {
  return text.size() == size && text.find_first_not_of(L"0123456789abcdef") == std::wstring::npos;
}

bool overlap(const std::wstring& first, const std::wstring& second) {
  if (equal(first, second)) return true;
  auto contains = [](const std::wstring& parent, const std::wstring& child) {
    return child.size() > parent.size() && child[parent.size()] == L'\\' &&
           equal(parent, child.substr(0, parent.size()));
  };
  return contains(first, second) || contains(second, first);
}

bool safeLeaf(const std::wstring& leaf) {
  return !leaf.empty() && leaf.back() != L'.' && leaf.back() != L' ' &&
         leaf.find_first_of(L"\\/:*?\"<>|") == std::wstring::npos &&
         leaf.find_first_of(std::wstring(L"\0\t\r\n", 4)) == std::wstring::npos;
}

bool safeRelease(const std::wstring& release) {
  return !release.empty() && release.size() <= 63 &&
         release.find_first_not_of(L"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz._+-") ==
             std::wstring::npos && release.front() != L'.' && release.front() != L'_' &&
         release.front() != L'+' && release.front() != L'-';
}

std::wstring canonical(std::wstring path, Result invalid = Blocked) {
  while (path.size() > 3 && path.back() == L'\\') path.pop_back();
  if (path.size() < 4 || path.size() >= kPathCapacity - 44 || path[1] != L':' ||
      path[2] != L'\\' ||
      !((path.front() >= L'A' && path.front() <= L'Z') ||
        (path.front() >= L'a' && path.front() <= L'z'))) {
    fail("expected absolute local path", ERROR_INVALID_DATA, invalid);
  }
  for (size_t start = 3; start < path.size();) {
    const auto end = path.find(L'\\', start);
    if (!safeLeaf(path.substr(start, end - start))) {
      fail("invalid path segment", ERROR_INVALID_DATA, invalid);
    }
    if (end == std::wstring::npos) break;
    start = end + 1;
  }
  return path;
}

std::wstring extended(const std::wstring& path) { return L"\\\\?\\" + path; }

Handle openPath(const std::wstring& path, DWORD access, DWORD share) {
  return Handle(CreateFileW(extended(path).c_str(), access, share, nullptr, OPEN_EXISTING,
                            FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS, nullptr));
}

using Identity = FILE_ID_INFO;

bool sameId(const Identity& first, const Identity& second) {
  return first.VolumeSerialNumber == second.VolumeSerialNumber &&
         std::memcmp(first.FileId.Identifier, second.FileId.Identifier,
                     sizeof(first.FileId.Identifier)) == 0;
}

Identity directoryId(HANDLE handle) {
  FILE_ATTRIBUTE_TAG_INFO attributes{};
  check(GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes,
                                    sizeof(attributes)), "read directory attributes");
  if (!(attributes.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) ||
      attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
    fail("directory is a reparse point or not a directory");
  }
  Identity id{};
  check(GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)), "read file ID");
  return id;
}

std::optional<Identity> directoryAt(const std::wstring& path) {
  auto handle = openPath(path, FILE_READ_ATTRIBUTES,
                         FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE);
  if (handle.value == INVALID_HANDLE_VALUE) {
    const DWORD error = GetLastError();
    if (missing(error)) return std::nullopt;
    fail("open directory", error);
  }
  return directoryId(handle.value);
}

enum class AncestorSpelling { Canonical, AllowShortNames };

std::vector<Handle> lockParents(const std::wstring& target,
                                AncestorSpelling spelling = AncestorSpelling::Canonical) {
  const auto drive = target.substr(0, 3);
  wchar_t fs[16]{};
  if (GetDriveTypeW(drive.c_str()) != DRIVE_FIXED ||
      !GetVolumeInformationW(drive.c_str(), nullptr, 0, nullptr, nullptr, nullptr,
                             fs, static_cast<DWORD>(std::size(fs))) ||
      !equal(fs, L"NTFS")) {
    fail("install path must be on a fixed NTFS volume");
  }
  std::vector<Handle> handles;
  for (size_t end = target.find(L'\\', 3); end != std::wstring::npos;
       end = target.find(L'\\', end + 1)) {
    const auto path = target.substr(0, end);
    auto handle = openPath(path, FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE);
    check(handle.value != INVALID_HANDLE_VALUE, "open install ancestor");
    directoryId(handle.value);
    wchar_t actual[kPathCapacity]{};
    const auto written = GetFinalPathNameByHandleW(handle.value, actual,
                                                  static_cast<DWORD>(std::size(actual)), 0);
    if (!written || written >= std::size(actual)) fail("resolve install ancestor", GetLastError());
    const auto requested = extended(path);
    if (!equal(requested, actual)) {
      wchar_t expanded[kPathCapacity]{};
      const auto length = spelling == AncestorSpelling::AllowShortNames
          ? GetLongPathNameW(requested.c_str(), expanded, static_cast<DWORD>(std::size(expanded)))
          : 0;
      if (!length || length >= std::size(expanded) || !equal(expanded, actual)) {
        fail("install ancestor is not a canonical directory");
      }
    }
    handles.push_back(std::move(handle));
  }
  return handles;
}

std::optional<std::wstring> readString(HKEY root, const std::wstring& key,
                                       const wchar_t* name, REGSAM view) {
  wchar_t data[kPathCapacity]{};
  DWORD bytes = sizeof(data);
  const auto status = RegGetValueW(root, key.c_str(), name,
                                   RRF_RT_REG_SZ | RRF_NOEXPAND | view, nullptr, data, &bytes);
  if (missing(static_cast<DWORD>(status))) return std::nullopt;
  checkReg(status, "read installation registration");
  if (!bytes || bytes % sizeof(wchar_t) || data[bytes / sizeof(wchar_t) - 1] ||
      wcslen(data) + 1 != bytes / sizeof(wchar_t)) fail("invalid registration string");
  return data;
}

struct Scope {
  HKEY root;
  std::wstring install;
  std::wstring uninstall;
  std::wstring journal;
};

struct Options {
  std::wstring command;
  std::wstring target;
  std::wstring release;
#if defined(ONEKEY_RECOVERY_TEST) && !defined(ONEKEY_RECOVERY_PUBLISHERS)
  std::wstring oldInventory;
#endif
  std::wstring newInventory;
  DWORD ownerPid = 0;
  bool machine = false;
#if defined(ONEKEY_RECOVERY_TEST)
  std::wstring fixture;
  std::wstring fault;
#endif
};

Options parse(int argc, wchar_t** argv) {
  if (argc < 2 || argc % 2 != 0) fail("invalid command line");
  Options options;
  options.command = argv[1];
  std::map<std::wstring, std::wstring> args;
  for (int i = 2; i < argc; i += 2) {
    if (!args.emplace(argv[i], argv[i + 1]).second) fail("duplicate option");
  }
  auto take = [&args](const wchar_t* name) {
    const auto found = args.find(name);
    if (found == args.end()) return std::wstring{};
    auto value = found->second;
    args.erase(found);
    return value;
  };
  const auto scope = take(L"--scope");
  if (scope != L"user" && scope != L"machine") fail("expected user or machine scope");
  options.machine = scope == L"machine";
  options.target = take(L"--target");
  if (options.target.empty()) fail("install directory is required");
  options.release = take(L"--release");
  if (!safeRelease(options.release)) fail("invalid release");
#if defined(ONEKEY_RECOVERY_TEST) && !defined(ONEKEY_RECOVERY_PUBLISHERS)
  options.oldInventory = take(L"--old-inventory");
#endif
  options.newInventory = take(L"--new-inventory");
  const auto pid = take(L"--owner-pid");
  if (!pid.empty()) {
    if (pid.find_first_not_of(L"0123456789") != std::wstring::npos) fail("invalid installer PID");
    const auto numeric = std::stoull(pid);
    if (!numeric || numeric > std::numeric_limits<DWORD>::max()) fail("invalid installer PID");
    options.ownerPid = static_cast<DWORD>(numeric);
  }
#if !defined(ONEKEY_RECOVERY_TEST)
  if (!options.ownerPid) fail("installer PID is required");
#endif
#if defined(ONEKEY_RECOVERY_TEST)
  options.fixture = take(L"--fixture");
  options.fault = take(L"--fault");
  if (!hex(options.fixture, 32)) fail("expected isolated fixture token");
#endif
  if (!args.empty()) fail("unknown option");
  return options;
}

Scope scopeFor([[maybe_unused]] const Options& options, bool machine) {
#if defined(ONEKEY_RECOVERY_TEST)
  const auto prefix = L"Software\\OneKeyInstallerRecoveryTests\\" + options.fixture +
                      (machine ? L"\\Machine\\" : L"\\User\\");
  return {HKEY_CURRENT_USER, prefix + L"Install", prefix + L"Uninstall", prefix + L"Journal"};
#else
  return {machine ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER,
          kInstallKey, kUninstallKey, kJournalKey};
#endif
}

[[maybe_unused]] std::wstring knownFolder(REFKNOWNFOLDERID id) {
  PWSTR raw = nullptr;
  const auto result = SHGetKnownFolderPath(id, KF_FLAG_DONT_VERIFY, nullptr, &raw);
  std::wstring path = raw ? raw : L"";
  CoTaskMemFree(raw);
  if (FAILED(result)) fail("resolve install root", static_cast<DWORD>(result));
  return canonical(path);
}

std::wstring machineProgramFiles() {
  // The ProgramFilesX64 known-folder lookup is unavailable from an x86 process.
  const auto path = readString(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion",
                               L"ProgramFilesDir", RRF_SUBKEY_WOW6464KEY);
  if (!path) fail("read native Program Files directory");
  return canonical(*path);
}

bool supportedTarget(const Options& options) {
#if defined(ONEKEY_RECOVERY_TEST)
  wchar_t temp[kPathCapacity]{};
  const auto length = GetTempPathW(static_cast<DWORD>(std::size(temp)), temp);
  if (!length || length >= std::size(temp)) fail("locate fixture root");
  wchar_t longTemp[kPathCapacity]{};
  const auto normalized = GetLongPathNameW(temp, longTemp, static_cast<DWORD>(std::size(longTemp)));
  if (!normalized || normalized >= std::size(longTemp)) fail("normalize fixture root");
  const auto root = canonical(longTemp) + L"\\onekey-recovery-" + options.fixture;
#else
  const auto root = options.machine ? machineProgramFiles() : knownFolder(FOLDERID_UserProgramFiles);
#endif
  return equal(options.target, root + L"\\OneKey");
}

std::wstring resolvedRegistration(const std::wstring& path) {
  if (GetDriveTypeW(path.substr(0, 3).c_str()) != DRIVE_FIXED) {
    fail("another scope's installation is not on a fixed local volume");
  }
  std::vector<Handle> directories;
  auto resolved = path;
  for (size_t start = 3; start < path.size();) {
    const auto end = std::min(path.size(), path.find(L'\\', start));
    const auto prefix = path.substr(0, end);
    auto directory = openPath(prefix, FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE);
    if (directory.value == INVALID_HANDLE_VALUE) {
      const auto error = GetLastError();
      if (missing(error)) break;
      fail("open another scope's installation path", error);
    }
    directoryId(directory.value);
    wchar_t actual[kPathCapacity]{};
    const auto length = GetFinalPathNameByHandleW(directory.value, actual,
                                                 static_cast<DWORD>(std::size(actual)), 0);
    if (length < 7 || length >= std::size(actual) || std::wstring(actual, 4) != L"\\\\?\\") {
      fail("resolve another scope's installation path");
    }
    resolved = canonical(std::wstring(actual + 4) + path.substr(end));
    directories.push_back(std::move(directory));
    start = end + 1;
  }
  return resolved;
}

void checkOtherScope(const Options& options, const std::wstring& staging = L"",
                     const std::wstring& backup = L"") {
  const auto other = scopeFor(options, !options.machine);
  for (const auto view : {RRF_SUBKEY_WOW6464KEY, RRF_SUBKEY_WOW6432KEY}) {
    const auto location = readString(other.root, other.install, L"InstallLocation", view);
    if (!location) continue;
    const auto path = canonical(*location);
    const auto resolved = resolvedRegistration(path);
    for (const auto* candidate : {&options.target, &staging, &backup}) {
      if (!candidate->empty() && (overlap(path, *candidate) || overlap(resolved, *candidate))) {
        fail("other scope overlaps an installer directory");
      }
    }
  }
}

bool checkRegistration(const Options& options, const Scope& scope) {
  const auto registered = readString(scope.root, scope.install, L"InstallLocation",
                                      RRF_SUBKEY_WOW6464KEY);
  if (registered && !equal(canonical(*registered), options.target)) {
    fail("target does not match scope registration");
  }
  const auto alternate = readString(scope.root, scope.install, L"InstallLocation",
                                     RRF_SUBKEY_WOW6432KEY);
  if (alternate && !equal(canonical(*alternate), options.target)) {
    fail("installation registration differs across registry views");
  }
  return registered.has_value();
}

void checkUninstallerRegistration(const Options& options, const Scope& scope) {
  const auto uninstall = readString(scope.root, scope.uninstall, L"UninstallString",
                                     RRF_SUBKEY_WOW6464KEY);
  const auto expected = L"\"" + options.target + L"\\" + kUninstaller + L"\" " +
                        (options.machine ? L"/allusers" : L"/currentuser");
  const auto quiet = readString(scope.root, scope.uninstall, L"QuietUninstallString",
                                  RRF_SUBKEY_WOW6464KEY);
  if (!uninstall || !equal(*uninstall, expected) || !quiet ||
      !equal(*quiet, expected + L" /S")) fail("uninstaller registration differs");
}

std::wstring displayVersion(const Scope& scope) {
  const auto version = readString(scope.root, scope.uninstall, L"DisplayVersion",
                                   RRF_SUBKEY_WOW6464KEY);
  if (!version || !safeRelease(*version)) fail("invalid registered release");
  return *version;
}

class Sha256 {
 public:
  Sha256() {
    if (BCryptOpenAlgorithmProvider(&provider_, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0) {
      fail("open SHA-256 provider");
    }
  }
  ~Sha256() { BCryptCloseAlgorithmProvider(provider_, 0); }
  Sha256(const Sha256&) = delete;
  Sha256& operator=(const Sha256&) = delete;

  std::wstring read(HANDLE file, std::string* contents = nullptr,
                    size_t contentsLimit = kInventoryLimit) const {
    BCRYPT_HASH_HANDLE hash{};
    if (BCryptCreateHash(provider_, &hash, nullptr, 0, nullptr, 0, 0) < 0) {
      fail("initialize SHA-256");
    }
    struct HashGuard {
      BCRYPT_HASH_HANDLE value;
      ~HashGuard() { BCryptDestroyHash(value); }
    } guard{hash};
    std::array<BYTE, 64 * 1024> buffer{};
    for (;;) {
      DWORD count{};
      check(ReadFile(file, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr),
            "read file for inventory");
      if (!count) break;
      if (BCryptHashData(hash, buffer.data(), count, 0) < 0) fail("update SHA-256");
      if (contents) {
        if (contents->size() + count > contentsLimit) fail("inventory exceeds size limit");
        contents->append(reinterpret_cast<const char*>(buffer.data()), count);
      }
    }
    std::array<BYTE, 32> digest{};
    if (BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) < 0) {
      fail("finish SHA-256");
    }
    return encode(digest);
  }

  std::wstring certificate(PCCERT_CONTEXT cert) const {
    std::array<BYTE, 32> digest{};
    if (BCryptHash(provider_, nullptr, 0, cert->pbCertEncoded, cert->cbCertEncoded,
                   digest.data(), static_cast<ULONG>(digest.size())) < 0) {
      fail("hash publisher certificate");
    }
    return encode(digest);
  }

 private:
  static std::wstring encode(const std::array<BYTE, 32>& digest) {
    constexpr wchar_t digits[] = L"0123456789abcdef";
    std::wstring result;
    for (const auto byte : digest) {
      result += digits[byte >> 4];
      result += digits[byte & 15];
    }
    return result;
  }

  BCRYPT_ALG_HANDLE provider_{};
};

std::wstring utf16(const std::string& text) {
  const auto size = static_cast<int>(text.size());
  const auto count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(),
                                         size, nullptr, 0);
  if (!count) fail("inventory is not valid UTF-8");
  std::wstring result(static_cast<size_t>(count), L'\0');
  check(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), size, result.data(),
                            count) == count, "decode inventory");
  return result;
}

struct Inventory {
  std::wstring digest;
  std::map<std::wstring, std::wstring, CaseInsensitive> entries;
};

#if defined(ONEKEY_RECOVERY_PUBLISHERS)
template <typename Entry>
Entry imageEntry(const std::string& image, size_t offset) {
  if (offset > image.size() || sizeof(Entry) > image.size() - offset) {
    fail("invalid inventory image offset");
  }
  Entry entry{};
  std::memcpy(&entry, image.data() + offset, sizeof(entry));
  return entry;
}

std::string inventorySection(const std::string& image) {
  const auto dos = imageEntry<IMAGE_DOS_HEADER>(image, 0);
  if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < static_cast<LONG>(sizeof(IMAGE_DOS_HEADER)) ||
      dos.e_lfanew > 4096) fail("invalid inventory image header");
  const auto offset = static_cast<size_t>(dos.e_lfanew);
  const auto pe = imageEntry<IMAGE_NT_HEADERS32>(image, offset);
  const auto section = imageEntry<IMAGE_SECTION_HEADER>(image, offset + sizeof(pe));
  const auto& attributes = pe.FileHeader;
  const auto& optional = pe.OptionalHeader;
  const auto& signature = optional.DataDirectory[IMAGE_DIRECTORY_ENTRY_SECURITY];
  const auto raw = static_cast<size_t>(section.PointerToRawData);
  const auto size = static_cast<size_t>(section.Misc.VirtualSize);
  const auto sectionSize = static_cast<size_t>(section.SizeOfRawData);
  if (pe.Signature != IMAGE_NT_SIGNATURE || attributes.Machine != IMAGE_FILE_MACHINE_I386 ||
      attributes.SizeOfOptionalHeader != sizeof(optional) || attributes.NumberOfSections != 1 ||
      !(attributes.Characteristics & IMAGE_FILE_DLL) ||
      optional.Magic != IMAGE_NT_OPTIONAL_HDR32_MAGIC || optional.AddressOfEntryPoint ||
      optional.NumberOfRvaAndSizes != IMAGE_NUMBEROF_DIRECTORY_ENTRIES ||
      optional.FileAlignment != 512 || optional.SectionAlignment != 4096 ||
      raw < offset + sizeof(pe) + sizeof(section) || raw != optional.SizeOfHeaders ||
      raw % optional.FileAlignment || raw > image.size() ||
      std::memcmp(section.Name, ".okinv\0", IMAGE_SIZEOF_SHORT_NAME) ||
      section.Characteristics != (IMAGE_SCN_CNT_INITIALIZED_DATA | IMAGE_SCN_MEM_READ) ||
      !size || size > kInventoryLimit || sectionSize != ((size + 511) / 512) * 512 ||
      sectionSize > image.size() - raw || signature.VirtualAddress != raw + sectionSize ||
      !signature.Size || signature.Size != image.size() - signature.VirtualAddress) {
    fail("invalid signed inventory image layout");
  }
  return image.substr(raw, size);
}

template <typename Function>
Function systemFunction(HMODULE library, const char* name) {
  const auto address = GetProcAddress(library, name);
  if (!address) fail("resolve Windows trust function", GetLastError());
  Function function{};
  static_assert(sizeof(function) == sizeof(address));
  std::memcpy(&function, &address, sizeof(function));
  return function;
}

void verifyPublisher(HANDLE file, const std::wstring& source, const Sha256& sha) {
  const auto library = LoadLibraryExW(L"wintrust.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
  check(library != nullptr, "load Windows trust provider");
  struct ModuleGuard {
    HMODULE value;
    ~ModuleGuard() { FreeLibrary(value); }
  } module{library};
  const auto verifyTrust = systemFunction<decltype(&WinVerifyTrust)>(library, "WinVerifyTrust");
  const auto providerData = systemFunction<decltype(&WTHelperProvDataFromStateData)>(
      library, "WTHelperProvDataFromStateData");
  const auto providerSigner = systemFunction<decltype(&WTHelperGetProvSignerFromChain)>(
      library, "WTHelperGetProvSignerFromChain");

  const auto fullPath = extended(source);
  WINTRUST_FILE_INFO subject{};
  subject.cbStruct = sizeof(subject);
  subject.pcwszFilePath = fullPath.c_str();
  subject.hFile = file;
  WINTRUST_DATA trust{};
  trust.cbStruct = sizeof(trust);
  trust.dwUIChoice = WTD_UI_NONE;
  trust.fdwRevocationChecks = WTD_REVOKE_NONE;
  trust.dwUnionChoice = WTD_CHOICE_FILE;
  trust.pFile = &subject;
  trust.dwStateAction = WTD_STATEACTION_VERIFY;
  trust.dwProvFlags = WTD_CACHE_ONLY_URL_RETRIEVAL | WTD_DISABLE_MD2_MD4;
  GUID action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  const auto status = verifyTrust(nullptr, &action, &trust);
  struct TrustGuard {
    decltype(&WinVerifyTrust) verify;
    GUID& action;
    WINTRUST_DATA& trust;
    ~TrustGuard() {
      trust.dwStateAction = WTD_STATEACTION_CLOSE;
      verify(nullptr, &action, &trust);
    }
  } trusted{verifyTrust, action, trust};
#if defined(ONEKEY_RECOVERY_TEST)
  // The fixture's disposable certificate is deliberately absent from trusted roots.
  if (status && status != CERT_E_UNTRUSTEDROOT) {
#else
  if (status) {
#endif
    fail("OneKey Authenticode verification failed", static_cast<DWORD>(status));
  }
  const auto provider = providerData(trust.hWVTStateData);
  const auto signer = provider ? providerSigner(provider, 0, FALSE, 0) : nullptr;
  if (!signer || !signer->csCertChain || !signer->pasCertChain ||
      !signer->pasCertChain[0].pCert || !signer->psSigner ||
      !signer->psSigner->HashAlgorithm.pszObjId ||
      std::strcmp(signer->psSigner->HashAlgorithm.pszObjId, szOID_NIST_sha256)) {
    fail("file lacks a verified SHA-256 publisher signature");
  }
  const auto pin = sha.certificate(signer->pasCertChain[0].pCert);
  constexpr const wchar_t* approved[] = {ONEKEY_RECOVERY_PUBLISHERS};
  if (std::find(std::begin(approved), std::end(approved), pin) == std::end(approved)) {
    fail("file publisher is not approved");
  }
}
#endif

Inventory parseInventory(std::string contents, const std::wstring& release, std::wstring digest) {
  Inventory result{std::move(digest), {}};
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
  constexpr char header[] = "onekey-inventory-v2\n";
#else
  constexpr char header[] = "onekey-inventory-v1\n";
  (void)release;
#endif
  auto offset = sizeof(header) - 1;
  if (contents.compare(0, offset, header)) fail("invalid inventory header");
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
  const auto releaseEnd = contents.find('\n', offset);
  if (releaseEnd == std::string::npos || releaseEnd - offset > 63 ||
      utf16(contents.substr(offset, releaseEnd - offset)) != release) {
    fail("inventory release differs from installer or registration");
  }
  offset = releaseEnd + 1;
#endif
  for (; offset < contents.size();) {
    const auto lineEnd = contents.find('\n', offset);
    const auto tab = contents.find('\t', offset);
    if (lineEnd == std::string::npos || tab >= lineEnd || tab == offset) {
      fail("malformed inventory record");
    }
    const auto field = utf16(contents.substr(offset, tab - offset));
    auto path = utf16(contents.substr(tab + 1, lineEnd - tab - 1));
    if (field != L"d" && !hex(field, kDigestLength)) fail("invalid file digest");
    for (size_t start = 0;;) {
      const auto end = path.find(L'\\', start);
      if (!safeLeaf(path.substr(start, end - start))) fail("invalid relative inventory path");
      if (end == std::wstring::npos) break;
      start = end + 1;
    }
    if (!result.entries.emplace(std::move(path), field).second) fail("duplicate inventory path");
    offset = lineEnd + 1;
  }
  for (const auto* required : {kExecutable, kUninstaller}) {
    const auto found = result.entries.find(required);
    if (found == result.entries.end() || found->second == L"d") fail("inventory is incomplete");
  }
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
  if (!result.entries.emplace(kInventory, result.digest).second) {
    fail("inventory includes its signature carrier");
  }
#endif
  return result;
}

void checkLooseFile(HANDLE file) {
  BY_HANDLE_FILE_INFORMATION info{};
  check(GetFileInformationByHandle(file, &info), "read signed file attributes");
  if (info.dwFileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY) ||
      info.nNumberOfLinks != 1) {
    fail("signed installer file is not an ordinary file");
  }
}

std::optional<Inventory> loadInventory(const std::wstring& source, const std::wstring& release,
                                       const Sha256& sha) {
  if (source.empty()) fail("signed installer inventory is required");
  const auto path = canonical(source);
  const auto parents = lockParents(path, AncestorSpelling::AllowShortNames);
  const auto file = openPath(path, GENERIC_READ, FILE_SHARE_READ);
  if (file.value == INVALID_HANDLE_VALUE) {
    const auto error = GetLastError();
    if (missing(error)) return std::nullopt;
    fail("open installer inventory", error);
  }
  checkLooseFile(file.value);
  std::string contents;
  auto digest = sha.read(file.value, &contents, kCarrierLimit);
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
  auto section = inventorySection(contents);
  check(SetFilePointerEx(file.value, LARGE_INTEGER{}, nullptr, FILE_BEGIN), "rewind inventory image");
  verifyPublisher(file.value, path, sha);
  return parseInventory(std::move(section), release, std::move(digest));
#else
  return parseInventory(std::move(contents), release, std::move(digest));
#endif
}

Inventory inventory(const std::wstring& source, const std::wstring& release, const Sha256& sha) {
  auto result = loadInventory(source, release, sha);
  if (!result) fail("installer inventory is missing");
  return std::move(*result);
}

std::wstring oldInventorySource([[maybe_unused]] const Options& options,
                                [[maybe_unused]] const std::wstring& directory) {
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
  return directory + L"\\" + kInventory;
#else
  return options.oldInventory;
#endif
}

void checkStreams(const std::wstring& path) {
  WIN32_FIND_STREAM_DATA stream{};
  auto name = extended(path);
  FindHandle found{FindFirstStreamW(name.c_str(), FindStreamInfoStandard, &stream, 0)};
  if (found.value == INVALID_HANDLE_VALUE) {
    if (GetLastError() == ERROR_HANDLE_EOF) return;
    fail("enumerate named file streams", GetLastError());
  }
  if (std::wstring(stream.cStreamName) != L"::$DATA" || FindNextStreamW(found.value, &stream)) {
    fail("unexpected alternate data stream");
  }
  if (GetLastError() != ERROR_HANDLE_EOF) fail("enumerate named file streams", GetLastError());
}

void verifyContents(const std::wstring& root, const std::wstring& relative,
                      const Inventory& expected, const Sha256& sha,
                      std::set<std::wstring, CaseInsensitive>& seen, unsigned depth = 0) {
  if (depth > 64) fail("inventory directory depth exceeds limit");
  const auto directory = relative.empty() ? root : root + L"\\" + relative;
  auto guard = openPath(directory, FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE);
  check(guard.value != INVALID_HANDLE_VALUE, "open inventory directory");
  directoryId(guard.value);
  checkStreams(directory);
  WIN32_FIND_DATAW entry{};
  FindHandle found{FindFirstFileW((extended(directory) + L"\\*").c_str(), &entry)};
  if (found.value == INVALID_HANDLE_VALUE) {
    if (GetLastError() == ERROR_FILE_NOT_FOUND) return;
    fail("enumerate install directory", GetLastError());
  }
  do {
    std::wstring name = entry.cFileName;
    if (name == L"." || name == L"..") continue;
    auto subpath = relative.empty() ? name : relative + L"\\" + name;
    const auto match = expected.entries.find(subpath);
    if (match == expected.entries.end() || !seen.insert(subpath).second ||
        (entry.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) {
      fail("install directory contains an unexpected entry");
    }
    if (entry.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
      if (match->second != L"d") fail("expected an application file");
      verifyContents(root, subpath, expected, sha, seen, depth + 1);
      continue;
    }
    const auto path = directory + L"\\" + name;
    auto file = openPath(path, GENERIC_READ, FILE_SHARE_READ);
    check(file.value != INVALID_HANDLE_VALUE, "open application file");
    BY_HANDLE_FILE_INFORMATION info{};
    check(GetFileInformationByHandle(file.value, &info), "read application file attributes");
    if (info.dwFileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY) ||
        info.nNumberOfLinks != 1 || match->second == L"d") {
      fail("application file is linked or has the wrong type");
    }
    checkStreams(path);
    if (sha.read(file.value) != match->second) fail("application file differs from inventory");
  } while (FindNextFileW(found.value, &entry));
  if (GetLastError() != ERROR_NO_MORE_FILES) fail("enumerate install directory", GetLastError());
}

void verify(const std::wstring& root, const Inventory& expected, const Sha256& sha) {
  std::set<std::wstring, CaseInsensitive> seen;
  verifyContents(root, L"", expected, sha, seen);
  if (seen.size() != expected.entries.size()) {
    fail("application directory is incomplete");
  }
}

struct Owner {
  DWORD pid;
  FILETIME created;
};

struct Record {
  DWORD magic;
  Phase phase;
  Identity original;
  Identity staging;
  Owner owner;
  wchar_t target[kPathCapacity];
  wchar_t token[33];
  wchar_t oldRelease[64];
  wchar_t release[64];
  wchar_t oldInventory[kDigestLength + 1];
  wchar_t newInventory[kDigestLength + 1];
};

constexpr DWORD kRecordMagic = 0x31524b4f;

RegKey journalKey(const Scope& scope, bool create, REGSAM access) {
  RegKey key;
  if (create) {
    checkReg(RegCreateKeyExW(scope.root, scope.journal.c_str(), 0, nullptr,
                             REG_OPTION_NON_VOLATILE, access | KEY_WOW64_64KEY,
                             nullptr, &key.value, nullptr), "open transaction journal");
  } else {
    const auto status = RegOpenKeyExW(scope.root, scope.journal.c_str(), 0,
                                      access | KEY_WOW64_64KEY, &key.value);
    if (!missing(static_cast<DWORD>(status))) checkReg(status, "open transaction journal");
  }
  return key;
}

template <size_t N>
std::wstring field(const wchar_t (&value)[N]) {
  const auto end = std::find(std::begin(value), std::end(value), L'\0');
  if (end == std::end(value)) fail("invalid transaction record string");
  return {std::begin(value), end};
}

template <size_t N>
void assign(wchar_t (&value)[N], const std::wstring& text) {
  if (text.size() >= N) fail("transaction field exceeds its size limit");
  std::copy(text.begin(), text.end(), value);
  value[text.size()] = L'\0';
}

std::optional<Record> load(const Scope& scope) {
  auto key = journalKey(scope, false, KEY_QUERY_VALUE);
  if (!key.value) return std::nullopt;
  Record record{};
  DWORD type{};
  DWORD bytes = sizeof(record);
  const auto status = RegQueryValueExW(key.value, kRecord, nullptr, &type,
                                       reinterpret_cast<BYTE*>(&record), &bytes);
  if (missing(static_cast<DWORD>(status))) return std::nullopt;
  checkReg(status, "read transaction record");
  if (type != REG_BINARY || bytes != sizeof(record) || record.magic != kRecordMagic ||
      record.phase < Phase::Creating || record.phase > Phase::Promoted ||
      !hex(field(record.token), 32) || !safeRelease(field(record.oldRelease)) ||
      !safeRelease(field(record.release)) || !hex(field(record.oldInventory), kDigestLength) ||
      !hex(field(record.newInventory), kDigestLength)) {
    fail("invalid transaction record");
  }
  return record;
}

void save(const Scope& scope, const Record& record) {
  auto key = journalKey(scope, true, KEY_SET_VALUE | KEY_QUERY_VALUE);
  checkReg(RegSetValueExW(key.value, kRecord, 0, REG_BINARY,
                          reinterpret_cast<const BYTE*>(&record), sizeof(record)),
           "write transaction intent");
  checkReg(RegFlushKey(key.value), "flush transaction intent");
}

void clear(const Scope& scope) {
  auto key = journalKey(scope, false, KEY_SET_VALUE | KEY_QUERY_VALUE);
  if (!key.value) return;
  checkReg(RegDeleteValueW(key.value, kRecord), "clear transaction record");
  checkReg(RegFlushKey(key.value), "flush transaction completion");
}

bool enrolled(const Scope& scope) {
  auto key = journalKey(scope, false, KEY_QUERY_VALUE);
  if (!key.value) return false;
  DWORD type{};
  DWORD marker{};
  DWORD bytes = sizeof(marker);
  const auto status = RegQueryValueExW(key.value, kEnrollment, nullptr, &type,
                                       reinterpret_cast<BYTE*>(&marker), &bytes);
  if (missing(static_cast<DWORD>(status))) return false;
  checkReg(status, "read inventory enrollment");
  if (type != REG_DWORD || bytes != sizeof(marker) || marker != 1) {
    fail("invalid inventory enrollment");
  }
  return true;
}

void markEnrolled(const Scope& scope) {
  auto key = journalKey(scope, true, KEY_SET_VALUE);
  const DWORD marker = 1;
  checkReg(RegSetValueExW(key.value, kEnrollment, 0, REG_DWORD,
                          reinterpret_cast<const BYTE*>(&marker), sizeof(marker)),
           "write inventory enrollment");
  checkReg(RegFlushKey(key.value), "flush inventory enrollment");
}

std::wstring makeToken() {
  GUID id{};
  if (FAILED(CoCreateGuid(&id))) fail("generate staging directory name");
  wchar_t guid[40]{};
  if (!StringFromGUID2(id, guid, static_cast<int>(std::size(guid)))) fail("encode staging name");
  std::wstring token;
  for (const wchar_t ch : guid) {
    if (ch >= L'A' && ch <= L'F') token += static_cast<wchar_t>(ch - L'A' + L'a');
    if ((ch >= L'0' && ch <= L'9') || (ch >= L'a' && ch <= L'f')) token += ch;
  }
  if (!hex(token, 32)) fail("invalid staging directory name");
  return token;
}

struct Paths {
  std::wstring final;
  std::wstring staging;
  std::wstring backup;

  explicit Paths(const Record& record)
      : final(field(record.target)),
        staging(final + L".new-" + field(record.token)),
        backup(final + L".old-" + field(record.token)) {}
};

std::optional<Owner> liveOwner(DWORD pid) {
  if (!pid) return std::nullopt;
  Handle process(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, pid));
  if (!process.value) {
    const auto error = GetLastError();
    if (error == ERROR_INVALID_PARAMETER) return std::nullopt;
    fail("query installer process", error);
  }
  const auto running = WaitForSingleObject(process.value, 0);
  if (running == WAIT_OBJECT_0) return std::nullopt;
  if (running != WAIT_TIMEOUT) fail("check installer lifetime", GetLastError());
  Owner owner{pid, {}};
  FILETIME exited{}, kernel{}, user{};
  check(GetProcessTimes(process.value, &owner.created, &exited, &kernel, &user),
        "query installer lifetime");
  return owner;
}

bool sameOwner(const Owner& a, const Owner& b) {
  return a.pid == b.pid && CompareFileTime(&a.created, &b.created) == 0;
}

void lockTransaction(const Record& record, const Owner& caller) {
  const auto previous = liveOwner(record.owner.pid);
  if (previous && sameOwner(*previous, record.owner) && !sameOwner(*previous, caller)) {
    fail("another installer is processing this transaction", ERROR_BUSY);
  }
}

void interruptAt(const Options& options, const wchar_t* point) {
#if defined(ONEKEY_RECOVERY_TEST)
  if (options.fault == point) TerminateProcess(GetCurrentProcess(), 99);
#else
  (void)options;
  (void)point;
#endif
}

void renameOwned(const std::wstring& source, const Identity& expected,
                  const std::wstring& destination) {
  const auto slash = source.find_last_of(L'\\');
  if (!equal(source.substr(0, slash), destination.substr(0, destination.find_last_of(L'\\')))) {
    fail("directory rename crosses a parent directory");
  }
  const auto name = extended(destination);
  constexpr auto nameOffset = offsetof(FILE_RENAME_INFO, FileName);
  const auto nameBytes = static_cast<DWORD>(name.size() * sizeof(wchar_t));
  // FILE_RENAME_INFO needs alignment for its HANDLE member.
  std::vector<std::max_align_t> storage(
      (nameOffset + nameBytes + sizeof(wchar_t) + sizeof(std::max_align_t) - 1) /
      sizeof(std::max_align_t));
  auto* info = reinterpret_cast<FILE_RENAME_INFO*>(storage.data());
  info->ReplaceIfExists = FALSE;
  info->RootDirectory = nullptr;
  info->FileNameLength = nameBytes;
  std::memcpy(info->FileName, name.c_str(), nameBytes + sizeof(wchar_t));
  for (DWORD attempt = 0; ; ++attempt) {
    auto handle = openPath(source, DELETE | FILE_READ_ATTRIBUTES,
                           FILE_SHARE_READ | FILE_SHARE_WRITE);
    DWORD error{};
    if (handle.value == INVALID_HANDLE_VALUE) {
      error = GetLastError();
    } else {
      if (!sameId(directoryId(handle.value), expected)) fail("directory changed before rename");
      if (SetFileInformationByHandle(handle.value, FileRenameInfo, info,
                                     static_cast<DWORD>(nameOffset + nameBytes + sizeof(wchar_t)))) {
        return;
      }
      error = GetLastError();
    }
    if (attempt == 3 ||
        (error != ERROR_ACCESS_DENIED && error != ERROR_SHARING_VIOLATION &&
         error != ERROR_LOCK_VIOLATION)) {
      fail("rename installer directory", error);
    }
    Sleep(100 * (attempt + 1));
  }
}

Inventory inspectBound(const std::wstring& source, const std::wstring& release,
                       const std::wstring& digest, const Sha256& sha) {
  const auto result = inventory(source, release, sha);
  if (result.digest != digest) fail("inventory differs from the recorded installer");
  return result;
}

bool matches(const std::optional<Identity>& actual, const Identity& expected) {
  return actual && sameId(*actual, expected);
}

void checkOldRegistration(const Options& options, const Scope& scope, const Record& record) {
  checkUninstallerRegistration(options, scope);
  if (displayVersion(scope) != field(record.oldRelease)) {
    fail("original installation registration changed during replacement");
  }
}

Result finishRestore(const Options& options, const Scope& scope, Record& record,
                     const Paths& paths, const Sha256& sha, bool moved) {
  checkOldRegistration(options, scope, record);
  const auto& originalPath = moved ? paths.backup : paths.final;
  const auto oldFiles = inspectBound(oldInventorySource(options, originalPath), field(record.oldRelease),
                                     field(record.oldInventory), sha);
  if (moved) {
    verify(paths.backup, oldFiles, sha);
    record.phase = Phase::Restoring;
    save(scope, record);
    interruptAt(options, L"before-restore");
#if defined(ONEKEY_RECOVERY_TEST)
    if (options.fault == L"fail-restore") fail("injected restore failure", ERROR_ACCESS_DENIED);
#endif
    renameOwned(paths.backup, record.original, paths.final);
    interruptAt(options, L"after-restore");
  } else {
    verify(paths.final, oldFiles, sha);
  }
  if (!matches(directoryAt(paths.final), record.original) || directoryAt(paths.backup)) {
    fail("restored directory identity could not be confirmed");
  }
  clear(scope);
  return Restored;
}

Result recover(const Options& options, const Scope& scope, Record& record, const Owner& owner,
               const Sha256& sha, bool commit) {
  const Paths paths(record);
  checkOtherScope(options, paths.staging, paths.backup);
  const auto final = directoryAt(paths.final);
  const auto backup = directoryAt(paths.backup);
  const auto staging = directoryAt(paths.staging);
  const bool published = record.phase == Phase::Promoted ||
                         (record.phase == Phase::Swapping && matches(final, record.staging));
  if (published) {
    if (field(record.release) != options.release || !matches(final, record.staging) ||
        !matches(backup, record.original) || staging) {
      fail("published installation requires its matching installer and original backup");
    }
    verify(paths.final, inspectBound(options.newInventory, field(record.release), field(record.newInventory), sha), sha);
    if (commit) {
      checkUninstallerRegistration(options, scope);
      if (displayVersion(scope) != options.release) fail("new release registration is incomplete");
      markEnrolled(scope);
      clear(scope);
      return Ok;
    }
    record.phase = Phase::Promoted;
    record.owner = owner;
    save(scope, record);
    return Resume;
  }
  if (commit) fail("no published release to commit");

  if (matches(final, record.original) && !backup) {
    return finishRestore(options, scope, record, paths, sha, false);
  }
  if ((record.phase == Phase::Swapping || record.phase == Phase::Restoring) &&
      !final && matches(backup, record.original)) {
    return finishRestore(options, scope, record, paths, sha, true);
  }
  fail("unrecognized transaction state; directories retained");
}

Result prepare(const Options& options, const Scope& scope, const Owner& owner,
               const Inventory& newFiles, bool hasEnrollment, const Sha256& sha) {
  checkOtherScope(options);
  const auto original = directoryAt(options.target);
  if (!original) {
    if (hasEnrollment) fail("enrolled application directory is missing");
    return Ineligible;
  }
  const auto oldRelease = displayVersion(scope);
  const auto oldFiles = loadInventory(oldInventorySource(options, options.target), oldRelease, sha);
  if (!oldFiles) {
    if (hasEnrollment) fail("enrolled inventory is missing");
    return Ineligible;
  }
  checkUninstallerRegistration(options, scope);
  verify(options.target, *oldFiles, sha);
  if (!matches(directoryAt(options.target), *original)) fail("original directory changed");

  Record record{};
  record.magic = kRecordMagic;
  record.phase = Phase::Creating;
  record.original = *original;
  record.owner = owner;
  assign(record.target, options.target);
  assign(record.token, makeToken());
  assign(record.oldRelease, oldRelease);
  assign(record.release, options.release);
  assign(record.oldInventory, oldFiles->digest);
  assign(record.newInventory, newFiles.digest);
  const Paths paths(record);
  checkOtherScope(options, paths.staging, paths.backup);
  save(scope, record);
  interruptAt(options, L"before-create-stage");
  check(CreateDirectoryW(extended(paths.staging).c_str(), nullptr), "create staging directory");
  interruptAt(options, L"after-create-stage");
  const auto identity = directoryAt(paths.staging);
  if (!identity || identity->VolumeSerialNumber != record.original.VolumeSerialNumber) {
    fail("staging directory is not on the install volume");
  }
  record.staging = *identity;
  record.phase = Phase::Staging;
  save(scope, record);
  interruptAt(options, L"after-stage-intent");
  // Return ASCII so the caller can construct the Unicode staging path itself.
  for (const auto ch : field(record.token)) std::putchar(static_cast<char>(ch));
  std::putchar('\n');
  return Ok;
}

Result promote(const Options& options, const Scope& scope, Record& record, const Sha256& sha) {
  if (record.phase != Phase::Staging || field(record.release) != options.release) {
    fail("staging transaction requires its matching installer");
  }
  checkOldRegistration(options, scope, record);
  const Paths paths(record);
  checkOtherScope(options, paths.staging, paths.backup);
  if (!matches(directoryAt(paths.final), record.original) ||
      !matches(directoryAt(paths.staging), record.staging) || directoryAt(paths.backup)) {
    fail("installation or staging directory changed before replacement");
  }
  verify(paths.final, inspectBound(oldInventorySource(options, paths.final), field(record.oldRelease),
                                   field(record.oldInventory), sha), sha);
  verify(paths.staging, inspectBound(options.newInventory, field(record.release), field(record.newInventory), sha), sha);
  record.phase = Phase::Swapping;
  save(scope, record);
  interruptAt(options, L"before-backup");
  renameOwned(paths.final, record.original, paths.backup);
  interruptAt(options, L"after-backup");
  try {
#if defined(ONEKEY_RECOVERY_TEST)
    if (options.fault == L"fail-promote") fail("injected promotion failure", ERROR_ACCESS_DENIED);
#endif
    renameOwned(paths.staging, record.staging, paths.final);
  } catch (const Error& error) {
    std::fprintf(stderr, "%s (Windows error %lu)\n", error.operation, error.code);
    return finishRestore(options, scope, record, paths, sha, true);
  }
  interruptAt(options, L"after-promote");
  record.phase = Phase::Promoted;
  save(scope, record);
  interruptAt(options, L"after-promote-intent");
  return Ok;
}

Result enroll(const Options& options, const Scope& scope, const Inventory& files, const Sha256& sha) {
  checkOtherScope(options);
  checkUninstallerRegistration(options, scope);
  if (displayVersion(scope) != options.release) fail("release registration is incomplete");
  const auto installed = directoryAt(options.target);
  if (!installed) fail("installed application directory is missing");
  verify(options.target, files, sha);
  if (!matches(directoryAt(options.target), *installed)) fail("installed directory changed");
  markEnrolled(scope);
  return Ok;
}

Result run(Options options) {
  const bool checkingProcessTarget = options.command == L"check-process-target";
  const bool preparing = options.command == L"prepare";
  const bool promoting = options.command == L"promote";
  const bool recovering = options.command == L"recover";
  const bool committing = options.command == L"commit";
  const bool enrolling = options.command == L"enroll";
  if (!checkingProcessTarget && !preparing && !promoting && !recovering && !committing &&
      !enrolling) fail("unknown command");

#if defined(ONEKEY_RECOVERY_TEST)
  const auto mutexName = L"Local\\OneKeyInstallerRecoveryTest-" + options.fixture;
#else
  const std::wstring mutexName = L"Global\\OneKeyInstallerDirectoryRecovery";
#endif
  Handle mutex(CreateMutexW(nullptr, FALSE, mutexName.c_str()));
  if (!mutex.value) fail("open transaction lock", GetLastError());
  const auto lock = WaitForSingleObject(mutex.value, 5000);
  if (lock != WAIT_OBJECT_0 && lock != WAIT_ABANDONED) fail("acquire transaction lock", ERROR_BUSY);
  struct LockGuard {
    HANDLE value;
    ~LockGuard() { ReleaseMutex(value); }
  } unlock{mutex.value};

  const auto scope = scopeFor(options, options.machine);
  if (load(scopeFor(options, !options.machine))) {
    fail("another scope has a pending installation transaction");
  }
  auto record = load(scope);
  if (!record && !checkingProcessTarget && !preparing && !enrolling) return Ineligible;
  const bool hasEnrollment = (preparing || enrolling) && enrolled(scope);
  options.target = canonical(std::move(options.target), (record || hasEnrollment) ? Blocked : Ineligible);
  if (record && (checkingProcessTarget || preparing || enrolling ||
                 !equal(field(record->target), options.target))) {
    fail("an installation transaction is already active in this scope");
  }
  const auto caller = liveOwner(options.ownerPid);
  if (options.ownerPid && !caller) fail("installer process is unavailable");
  Owner owner = caller.value_or(Owner{});
  if (record) {
    lockTransaction(*record, owner);
    if ((promoting || committing) && !sameOwner(record->owner, owner)) {
      fail("recover the interrupted transaction before proceeding");
    }
  }
  // Legacy custom locations can still be updated. Only authorize stopping a
  // process when the scope owns an existing directory without another scope's overlap.
  if (checkingProcessTarget) {
    if (!checkRegistration(options, scope)) return Ineligible;
    const auto parents = lockParents(options.target, AncestorSpelling::AllowShortNames);
    if (!directoryAt(options.target)) return Ineligible;
    options.target = resolvedRegistration(options.target);
    checkOtherScope(options);
    return Ok;
  }

  if (!supportedTarget(options)) {
    if (!record && !hasEnrollment) return Ineligible;
    fail("unsupported install directory for an enrolled or pending installation");
  }
  const Sha256 sha;
  std::optional<Inventory> newFiles;
  if (preparing || enrolling) newFiles = inventory(options.newInventory, options.release, sha);
  if (!checkRegistration(options, scope)) {
    if (preparing && !hasEnrollment) {
      checkOtherScope(options);
      return Ineligible;
    }
    fail("installation registration is missing");
  }
  const auto parents = lockParents(options.target);
  if (enrolling) return enroll(options, scope, *newFiles, sha);
  if (preparing) return prepare(options, scope, owner, *newFiles, hasEnrollment, sha);
  if (promoting) return promote(options, scope, *record, sha);
  return recover(options, scope, *record, owner, sha, committing);
}
}  // namespace

int wmain(int argc, wchar_t** argv) {
  try {
#if defined(ONEKEY_RECOVERY_PUBLISHERS)
    if (argc == 4 && std::wstring(argv[1]) == L"verify-inventory") {
      const std::wstring release = argv[2];
      if (!safeRelease(release)) fail("invalid release");
      const Sha256 sha;
      inventory(argv[3], release, sha);
      return Ok;
    }
#endif
#if defined(ONEKEY_RECOVERY_TEST)
    if (argc == 3 && std::wstring(argv[1]) == L"verify-machine-root") {
      if (!equal(machineProgramFiles(), canonical(argv[2]))) fail("native Program Files differs");
      return Ok;
    }
#endif
    return run(parse(argc, argv));
  } catch (const Error& error) {
    std::fprintf(stderr, "%s (Windows error %lu)\n", error.operation, error.code);
    return error.result;
  } catch (const std::exception& error) {
    std::fprintf(stderr, "%s\n", error.what());
    return Blocked;
  }
}
