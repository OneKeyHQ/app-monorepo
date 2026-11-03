#include "MMKV.h"
#include "MMKVMetaInfo.hpp"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdarg>
#include <cstring>
#include <dlfcn.h>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

using namespace mmkv;
namespace fs = std::filesystem;
static const std::string id = "onekey-app-storage-v1";
static std::string root;
static std::string fault;
static int faultOccurrence = 1, observed = 0;
static bool killFault = false;
static size_t snapshotBytes = 0, snapshots = 0;
static std::vector<char> acknowledgedPrefix, acknowledgedMeta;
static uintmax_t acknowledgedFileSize = 0;
static bool shortWrite = false, interruptWrite = false, interruptSync = false, interruptOpen = false;
static void require(bool condition, const char *message) {
    if (!condition) { throw std::runtime_error(message); }
}
static std::string descriptorPath(int fd) {
    char path[4096] = {};
#ifdef __APPLE__
    if (fcntl(fd, F_GETPATH, path) == 0) { return path; }
#else
    const auto link = "/proc/self/fd/" + std::to_string(fd);
    auto size = readlink(link.c_str(), path, sizeof(path) - 1);
    if (size >= 0) { return std::string(path, size); }
#endif
    return {};
}
static std::string classify(int fd) {
    struct stat status = {};
    if (fstat(fd, &status) != 0) { return {}; }
    const auto path = descriptorPath(fd);
    if (path.find(root) != 0) { return {}; }
    if (S_ISDIR(status.st_mode)) { return "dir"; }
    if (path == root + "/" + id) { return "data"; }
    if (path == root + "/" + id + ".crc") { return "meta"; }
    if (path == root + "/" + id + ".onekey-undo.tmp") { return "journal"; }
    return {};
}
static bool inject(const std::string &phase, bool after) {
    if (phase != fault || after != killFault || ++observed != faultOccurrence) { return false; }
    if (killFault) { kill(getpid(), SIGKILL); _exit(90); }
    errno = EIO;
    return true;
}
extern "C" int open(const char *path, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) { va_list args; va_start(args, flags); mode = va_arg(args, int); va_end(args); }
    auto real = reinterpret_cast<int (*)(const char *, int, ...)>(dlsym(RTLD_NEXT, "open"));
    const bool journal = std::string(path) == root + "/" + id + ".onekey-undo.tmp";
    if (journal && interruptOpen) { interruptOpen = false; errno = EINTR; return -1; }
    if (journal && inject("open-journal", false)) { return -1; }
    return real(path, flags, mode);
}
extern "C" int fsync(int fd) {
    auto real = reinterpret_cast<int (*)(int)>(dlsym(RTLD_NEXT, "fsync"));
    const auto kind = classify(fd);
    if (!kind.empty() && interruptSync) { interruptSync = false; errno = EINTR; return -1; }
    const auto phase = "fsync-" + kind;
    if (inject(phase, false)) { return -1; }
    const int result = real(fd);
    if (result == 0) { inject(phase, true); }
    return result;
}
extern "C" ssize_t pwrite(int fd, const void *bytes, size_t length, off_t offset) {
    auto real = reinterpret_cast<ssize_t (*)(int, const void *, size_t, off_t)>(dlsym(RTLD_NEXT, "pwrite"));
    const auto kind = classify(fd);
    if (kind == "journal" && interruptWrite) { interruptWrite = false; errno = EINTR; return -1; }
    if (kind == "journal" && shortWrite) { shortWrite = false; return real(fd, bytes, std::max<size_t>(1, length / 2), offset); }
    if (kind == "journal") { snapshotBytes += length; if (offset == 0) { ++snapshots; } }
    const auto phase = "pwrite-" + kind;
    if (inject(phase, false)) { return -1; }
    const auto result = real(fd, bytes, length, offset);
    if (result >= 0) { inject(phase, true); }
    return result;
}
extern "C" int ftruncate(int fd, off_t length) {
    auto real = reinterpret_cast<int (*)(int, off_t)>(dlsym(RTLD_NEXT, "ftruncate"));
    const auto phase = "truncate-" + classify(fd);
    if (inject(phase, false)) { return -1; }
    const int result = real(fd, length);
    if (result == 0) { inject(phase, true); }
    return result;
}
extern "C" int rename(const char *from, const char *to) {
    auto real = reinterpret_cast<int (*)(const char *, const char *)>(dlsym(RTLD_NEXT, "rename"));
    const bool journal = std::string(to) == root + "/" + id + ".onekey-undo";
    if (journal && inject("publish", false)) { return -1; }
    const int result = real(from, to);
    if (journal && result == 0) { inject("publish", true); }
    return result;
}
extern "C" int unlink(const char *path) {
    auto real = reinterpret_cast<int (*)(const char *)>(dlsym(RTLD_NEXT, "unlink"));
    const bool journal = std::string(path) == root + "/" + id + ".onekey-undo";
    if (journal && inject("unlink", false)) { return -1; }
    const int result = real(path);
    if (journal && result == 0) { inject("unlink", true); }
    return result;
}
static std::vector<char> readFile(const std::string &path) {
    std::ifstream file(path, std::ios::binary);
    require(file.good(), "fixture read failed");
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}
static void writeFile(const std::string &path, const std::vector<char> &bytes) {
    std::ofstream file(path, std::ios::binary | std::ios::trunc);
    file.write(bytes.data(), bytes.size());
    require(file.good(), "fixture write failed");
}
template<class Action> static int process(Action action) {
    const auto child = fork();
    require(child >= 0, "fork failed");
    if (!child) {
        try {
            MMKV::initializeMMKV(root, MMKVLogNone);
            action();
            _exit(0);
        } catch (const std::exception &error) {
            std::cerr << error.what() << std::endl;
            _exit(1);
        }
    }
    int status;
    require(waitpid(child, &status, 0) == child, "wait failed");
    return status;
}
template<class Action> static void success(Action action) {
    require(process(action) == 0, "fixture worker failed");
}
static MMKV *openStore() {
    auto kv = MMKV::mmkvWithID(id);
    require(kv != nullptr, "store rejected");
    return kv;
}
static void captureAcknowledged() {
    const auto path = root + "/" + id;
    acknowledgedMeta = readFile(path + ".crc");
    MMKVMetaInfo meta; meta.read(acknowledgedMeta.data());
    auto data = readFile(path);
    require(meta.m_actualSize <= data.size() - 4, "invalid acknowledged fixture length");
    acknowledgedPrefix.assign(data.begin(), data.begin() + 4 + meta.m_actualSize);
    acknowledgedFileSize = data.size();
}
static void seed() {
    success([] {
        auto kv = openStore();
        require(kv->set(std::string("acknowledged"), "value"), "seed value failed");
        require(kv->set(std::string("1"), "marker"), "seed marker failed");
        require(MMKV::syncExisting(id) == 0, "seed ACK failed");
    });
    captureAcknowledged();
}
static void expect(const std::string &expected) {
    success([&] {
        auto kv = openStore();
        std::string value;
        require(kv->getString("value", value) && value == expected, "reopen returned incorrect state");
        require(kv->getString("marker", value) && value == "1", "reopen lost acknowledged marker");
        auto keys = kv->allKeys(false);
        std::sort(keys.begin(), keys.end());
        require(keys == std::vector<std::string>{"marker", "value"}, "reopen mixed key generations");
        require(MMKV::syncExisting(id) == 0, "reopen checked sync failed");
    });
    const auto path = root + "/" + id;
    auto data = readFile(path);
    require(data.size() == acknowledgedFileSize && data.size() >= acknowledgedPrefix.size() &&
            std::equal(acknowledgedPrefix.begin(), acknowledgedPrefix.end(), data.begin()) &&
            readFile(path + ".crc") == acknowledgedMeta, "recovery changed acknowledged active bytes, metadata, or allocated length");
}
static void configure(const std::string &phase, bool killing, int occurrence = 1) {
    fault = phase; killFault = killing; faultOccurrence = occurrence; observed = 0;
}
int main(int argc, char **argv) {
    require(argc == 2, "pass a fixture build directory");
    std::string pattern = std::string(argv[1]) + "/transaction.XXXXXX";
    auto directory = mkdtemp(pattern.data());
    require(directory != nullptr, "mkdtemp failed");
    root = fs::absolute(directory).string();
    const auto path = root + "/" + id;
    const auto pending = path + ".onekey-undo";
    try {
        seed();
        expect("acknowledged");
        success([] {
            auto kv = openStore();
            require(kv->set(std::string("uncommitted"), "value"), "dirty set failed");
            kv->sync(MMKV_SYNC);
            require(fs::exists(root + "/" + id + ".onekey-undo"), "ordinary sync committed a transaction");
        });
        expect("acknowledged");
        success([] {
            auto kv = openStore();
            require(kv->set(std::string("cache-owner"), "value"), "cache fixture write failed");
            kv->clearMemoryCache();
            std::string value;
            require(kv->getString("value", value) && value == "cache-owner", "own pending group was rolled back on cache eviction");
            require(MMKV::syncExisting(id) == 0, "cache owner ACK failed");
        });
        captureAcknowledged();
        expect("cache-owner");
        seed();
        // Destructive API operations belong to the same unacknowledged group.
        for (const auto &operation : {"grow", "trim", "clear", "bulk-remove", "rekey", "expiry"}) {
            success([&] {
                auto kv = openStore();
                if (std::string(operation) == "grow") { require(kv->set(std::string(20000, 'x'), "value"), "growth failed"); }
                if (std::string(operation) == "trim") { require(kv->set(std::string(20000, 'x'), "transient"), "trim growth failed"); kv->removeValueForKey("transient"); kv->trim(); }
                if (std::string(operation) == "clear") { kv->clearAll(); }
                if (std::string(operation) == "bulk-remove") { require(kv->removeValuesForKeys({"value", "marker"}), "bulk removal failed"); }
                if (std::string(operation) == "rekey") { require(kv->reKey("synthetic-only-key"), "rekey failed"); }
                if (std::string(operation) == "expiry") { require(kv->enableAutoKeyExpire(0), "expiry rewrite failed"); }
            });
            expect("acknowledged");
        }
        success([] {
            auto kv = openStore();
            require(kv->reKey("synthetic-only-key"), "successful rekey failed");
            require(MMKV::syncExisting(id) == 0, "successful rekey could not ACK");
            require(kv->reKey(""), "successful decrypt failed");
            require(MMKV::syncExisting(id) == 0, "successful decrypt could not ACK");
            require(kv->enableAutoKeyExpire(0), "successful expiry conversion failed");
            require(MMKV::syncExisting(id) == 0, "successful expiry conversion could not ACK");
            require(kv->disableAutoKeyExpire(), "successful expiry removal failed");
            require(MMKV::syncExisting(id) == 0, "successful expiry removal could not ACK");
        });
        captureAcknowledged(); expect("acknowledged");
        // Every externally visible durability boundary is killed after its real syscall.
        for (const auto &phase : {"pwrite-journal", "fsync-journal", "publish", "fsync-dir", "fsync-data", "fsync-meta", "unlink"}) {
            std::cout << "kill boundary: " << phase << std::endl;
            auto status = process([&] {
                auto kv = openStore();
                std::string value; kv->getString("value", value);
                configure(phase, true);
                require(kv->set(std::string(20000, 'n'), "value"), "kill-point set failed");
                require(MMKV::syncExisting(id) == 0, "kill-point sync failed");
            });
            require(WIFSIGNALED(status) && WTERMSIG(status) == SIGKILL, "fault boundary did not kill its worker");
            if (std::string(phase) == "unlink") {
                success([] { auto kv = openStore(); std::string value; require(kv->getString("value", value) && value == std::string(20000, 'n'), "complete unacknowledged new state was lost"); });
                seed();
            } else { expect("acknowledged"); }
        }
        // Publication failure must leave canonical bytes untouched and poison later ACKs.
        for (const auto &phase : {"open-journal", "pwrite-journal", "fsync-journal", "publish", "fsync-dir"}) {
            const auto data = readFile(path), meta = readFile(path + ".crc");
            success([&] {
                auto kv = openStore(); std::string value; kv->getString("value", value);
                configure(phase, false);
                require(!kv->set(std::string("refused"), "value"), "publication failure accepted a write");
                fault.clear();
                require(MMKV::syncExisting(id) != 0, "publication error was falsely ACKed");
                require(!kv->set(std::string("also-refused"), "value"), "sticky publication error allowed another write");
            });
            require(readFile(path) == data && readFile(path + ".crc") == meta, "publication failure modified canonical bytes");
            expect("acknowledged");
        }
        for (const auto &phase : {"fsync-data", "fsync-meta", "unlink", "fsync-dir"}) {
            success([&] {
                auto kv = openStore();
                require(kv->set(std::string("not-acked"), "value"), "commit failure fixture set failed");
                configure(phase, false);
                require(MMKV::syncExisting(id) != 0, "commit failure falsely ACKed");
                fault.clear();
                require(!kv->set(std::string("forbidden-next-group"), "value"), "uncertain commit mixed in another transaction");
                require(MMKV::syncExisting(id) != 0, "sticky commit failure was falsely ACKed");
            });
            if (std::string(phase) == "fsync-dir") { captureAcknowledged(); expect("not-acked"); seed(); }
            else { expect("acknowledged"); }
        }
        for (const auto &operation : {"trim", "clear", "bulk-remove"}) {
            const auto data = readFile(path), meta = readFile(path + ".crc");
            success([&] {
                auto kv = openStore(); std::string value; kv->getString("value", value);
                configure("publish", false);
                if (std::string(operation) == "trim") { kv->trim(); }
                if (std::string(operation) == "clear") { kv->clearAll(); }
                if (std::string(operation) == "bulk-remove") { require(!kv->removeValuesForKeys({"value", "marker"}), "failed bulk removal returned success"); }
                fault.clear();
                require(MMKV::syncExisting(id) != 0, "void/false mutation failure was falsely ACKed");
                require(!kv->getString("value", value) && kv->count() == 0, "failed mutation exposed an incomplete dictionary");
            });
            require(readFile(path) == data && readFile(path + ".crc") == meta, "failed destructive mutation changed canonical bytes");
            expect("acknowledged");
        }
        success([] {
            auto kv = openStore(); std::string value; kv->getString("value", value);
            shortWrite = interruptWrite = interruptSync = interruptOpen = true;
            require(kv->set(std::string("retry-fixture"), "value"), "journal short-write/EINTR retry failed");
            require(MMKV::syncExisting(id) == 0, "journal retry ACK failed");
        });
        captureAcknowledged(); expect("retry-fixture"); seed();
        // Recovery must remain repeatable after another kill between restoring the pair.
        for (const auto &phase : {"truncate-data", "pwrite-data", "fsync-data", "truncate-meta", "pwrite-meta", "fsync-meta"}) {
            success([] { require(openStore()->set(std::string(20000, 'r'), "value"), "recovery fixture set failed"); });
            const int status = process([&] { configure(phase, true); openStore(); });
            require(WIFSIGNALED(status) && WTERMSIG(status) == SIGKILL, "recovery fault did not kill worker");
            expect("acknowledged");
        }
        success([] { require(openStore()->set(std::string("pending"), "value"), "corruption fixture failed"); });
        auto journal = readFile(pending);
        const auto data = readFile(path), meta = readFile(path + ".crc");
        for (const auto &damage : {"checksum", "magic", "version", "truncated"}) {
            auto corrupt = journal;
            if (std::string(damage) == "checksum") { corrupt.back() ^= 1; }
            if (std::string(damage) == "magic") { corrupt[0] ^= 1; }
            if (std::string(damage) == "version") { corrupt[16] ^= 1; }
            if (std::string(damage) == "truncated") { corrupt.resize(10); }
            writeFile(pending, corrupt);
            success([] { require(MMKV::mmkvWithID(id) == nullptr, "corrupt journal was accepted"); });
            require(readFile(path) == data && readFile(path + ".crc") == meta && readFile(pending) == corrupt, "corrupt journal rejection altered evidence");
        }
        writeFile(pending, journal);
        fs::rename(path, path + ".old-inode"); writeFile(path, data);
        success([] { require(MMKV::mmkvWithID(id) == nullptr, "journal accepted a replaced canonical inode"); });
        require(readFile(path) == data && readFile(path + ".crc") == meta && readFile(pending) == journal, "identity rejection altered evidence");
        fs::remove(path); fs::rename(path + ".old-inode", path);
        success([] { MMKVConfig config; config.mode = MMKV_READ_ONLY; require(MMKV::mmkvWithID(id, config) == nullptr, "readonly open recovered pending data"); });
        expect("acknowledged");
        success([] {
            auto kv = openStore();
            MMKVConfig config; config.mode = MMKV_MULTI_PROCESS;
            require(MMKV::mmkvWithID(id, config) == nullptr, "cached target accepted unsupported mode");
            require(kv->set(std::string("pending"), "value"), "unsafe API fixture failed");
            require(!MMKV::removeStorage(id), "removeStorage erased a pending journal");
            require(!MMKV::backupOneToDirectory(id, root + "/backup"), "backup copied an uncommitted pair");
        });
        expect("acknowledged");
        success([] {
            auto kv = openStore();
            MMKVConfig destinationConfig;
            const auto destinationRoot = root + "/live-destination";
            fs::create_directories(destinationRoot);
            destinationConfig.rootPath = &destinationRoot;
            auto destination = MMKV::mmkvWithID(id, destinationConfig);
            require(destination != nullptr && destination->set(std::string("destination-only"), "sentinel"), "backup target fixture failed");
            require(!MMKV::backupOneToDirectory(id, destinationRoot), "backup replaced a live protected destination");
            (void) kv;
        });
        success([] {
            auto kv = openStore();
            for (int i = 0; i < 16; ++i) { require(kv->set(std::string(166400, 'a'), "payload-" + std::to_string(i)), "performance seed failed"); }
            require(MMKV::syncExisting(id) == 0, "performance seed ACK failed");
            snapshots = snapshotBytes = 0;
            std::vector<double> times;
            for (int i = 0; i < 32; ++i) {
                auto start = std::chrono::steady_clock::now();
                require(kv->set(std::string("update-") + std::to_string(i), "value"), "performance set failed");
                require(MMKV::syncExisting(id) == 0, "performance sync failed");
                times.push_back(std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count());
            }
            const auto dirty = snapshots, bytes = snapshotBytes;
            for (int i = 0; i < 24; ++i) { require(MMKV::syncExisting(id) == 0, "clean sync failed"); }
            require(snapshots == dirty && dirty == 32, "clean sync created a journal or dirty groups were duplicated");
            double total = 0, maximum = 0;
            for (const auto elapsed : times) { total += elapsed; maximum = std::max(maximum, elapsed); }
            std::cout << "synthetic payloadBytes=2662400 dirtyTransactions=" << dirty << " snapshotBytes=" << bytes
                      << " setAndSyncTotalMs=" << total << " meanMs=" << total / times.size() << " maxMs=" << maximum << std::endl;
        });
        fs::remove_all(root);
        std::cout << "native undo transaction regressions passed" << std::endl;
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << " (synthetic fixture retained)" << std::endl;
        return 1;
    }
}
