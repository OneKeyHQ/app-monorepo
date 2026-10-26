#include "MMKV.h"
#include "MMKVMetaInfo.hpp"
#include <zlib.h>
#include <atomic>
#include <cerrno>
#include <cstdarg>
#include <sys/stat.h>
#include <vector>
#include <chrono>
#include <condition_variable>
#include <dlfcn.h>
#include <fcntl.h>
#include <filesystem>
#include <iostream>
#include <mutex>
#include <string>
#include <sys/mman.h>
#include <thread>
#include <unistd.h>
using namespace std::chrono_literals;
static std::string root;
using namespace mmkv;
#ifdef MMKV_APPLE
using TestMMKV = mmkv::MMKV;
#define TEST_KEY @"key"
#else
using TestMMKV = MMKV;
#define TEST_KEY "key"
#endif
static bool active = false;
static int openCalls = 0, failOpen = 0;
static bool interruptOpen = false;
static std::vector<char> dataSnapshot, crcSnapshot;
extern "C" int open(const char *path, int flags, ...) {
    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args; va_start(args, flags); mode = va_arg(args, int); va_end(args);
    }
    auto real = reinterpret_cast<int (*)(const char *, int, ...)>(dlsym(RTLD_NEXT, "open"));
    if (active) {
        ++openCalls;
        if (interruptOpen) { interruptOpen = false; errno = EINTR; return -1; }
        if (failOpen == openCalls) { errno = EACCES; return -1; }
    }
    return real(path, flags, mode);
}
static int fsyncCalls = 0, msyncCalls = 0, failFsync = 0, failMsync = 0;
static bool interruptFsync = false, interruptMsync = false, race = false, interleaved = false;
static std::atomic<bool> attempting = false;
static std::atomic<bool> finished = false;
static std::mutex gate;
static std::condition_variable wake;
static std::chrono::milliseconds observationTimeout = 100ms;
extern "C" int fsync(int fd) {
    auto real = reinterpret_cast<int (*)(int)>(dlsym(RTLD_NEXT, "fsync"));
    if (!active) return real(fd);
    ++fsyncCalls;
    if (interruptFsync) { interruptFsync = false; errno = EINTR; return -1; }
    if (failFsync == fsyncCalls) { errno = EIO; return -1; }
    int result = real(fd);
    if (race && fsyncCalls <= 2) {
        struct stat status = {}; fstat(fd, &status);
        auto &snapshot = fsyncCalls == 1 ? dataSnapshot : crcSnapshot;
        snapshot.resize(status.st_size);
        pread(fd, snapshot.data(), snapshot.size(), 0);
    }
    if (race && fsyncCalls == 1) {
        std::unique_lock<std::mutex> lock(gate);
        attempting = true;
        wake.notify_all();
        // Writers/close must wait for the barrier; unrelated cached lookups must
        // proceed. Observe the actual lock with a bounded completion window.
        interleaved = wake.wait_for(lock, observationTimeout, [] { return finished.load(); });
    }
    return result;
}
extern "C" int msync(void *ptr, size_t size, int flags) {
    auto real = reinterpret_cast<int (*)(void *, size_t, int)>(dlsym(RTLD_NEXT, "msync"));
    if (active) {
        ++msyncCalls;
        if (interruptMsync) { interruptMsync = false; errno = EINTR; return -1; }
        if (failMsync == msyncCalls) { errno = EIO; return -1; }
    }
    return real(ptr, size, flags);
}
static int barrier(const std::string &id) {
#ifdef NEW_API
    return TestMMKV::syncExisting(id);
#else
    // Exact ordering of PR 13971's native bridges, using real MMKV Core.
    auto kv = TestMMKV::mmkvWithID(id);
    if (!kv) return ENOENT;
    kv->sync();
    for (const auto &suffix : {"", ".crc"}) {
        int fd;
        do { fd = open((root + "/" + id + suffix).c_str(), O_RDWR | O_CLOEXEC); }
        while (fd < 0 && errno == EINTR);
        if (fd < 0) return errno;
        int result;
        do { result = fsync(fd); } while (result < 0 && errno == EINTR);
        int error = result < 0 ? errno : 0;
        close(fd);
        if (error) return error;
    }
    return 0;
#endif
}
static int descriptorCount() {
    int count = 0;
    for (int fd = 0; fd < 1024; ++fd) {
        if (fcntl(fd, F_GETFD) >= 0) ++count;
    }
    return count;
}
static int failures = 0;
static void check(bool success, const std::string &name) {
    std::cout << (success ? "PASS " : "FAIL ") << name << std::endl;
    if (!success) ++failures;
}
static void reset() {
    active = false; fsyncCalls = msyncCalls = failFsync = failMsync = openCalls = failOpen = 0;
    interruptOpen = false;
    interruptFsync = interruptMsync = race = interleaved = false;
    attempting = finished = false;
    observationTimeout = 100ms;
}
int main() {
    char pattern[] = "/tmp/pr13971-core-test.XXXXXX";
    root = mkdtemp(pattern);
    TestMMKV::initializeMMKV(root, MMKVLogNone);
    auto kv = TestMMKV::mmkvWithID("healthy");
    kv->set(std::string("version-1"), TEST_KEY);
    active = true;
    check(barrier("healthy") == 0 && fsyncCalls == 2, "healthy initialized store checks both files");
    reset(); active = true;
    check(barrier("never-created") != 0 && !std::filesystem::exists(root + "/never-created"), "sync never initializes an absent store");
    for (const auto &suffix : {"", ".crc"}) {
        reset(); auto lost = TestMMKV::mmkvWithID("cold-missing");
        lost->set(std::string("fixture"), TEST_KEY); lost->close();
        std::filesystem::remove(root + "/cold-missing" + suffix);
        active = true;
        check(barrier("cold-missing") != 0 && !std::filesystem::exists(root + "/cold-missing" + suffix), std::string("cold missing file not recreated: ") + suffix);
        reset(); TestMMKV::removeStorage("cold-missing");
    }
    reset(); race = true; active = true;
    std::thread writer([&] {
        { std::unique_lock<std::mutex> lock(gate); wake.wait(lock, [] { return attempting.load(); }); }
        kv->set(std::string("version-2"), TEST_KEY);
        finished = true; wake.notify_all();
    });
    int result = barrier("healthy"); writer.join(); active = false;
    check(result == 0 && finished && !interleaved, "Core writer cannot run between data and CRC fsync");
    // Modern MMKV stores the current length in metadata rather than the old
    // data-file header. Validate the same byte range used by Core on reload.
    mmkv::MMKVMetaInfo metadata;
    metadata.read(crcSnapshot.data());
    check(metadata.m_actualSize <= dataSnapshot.size() - 4 &&
          crc32(0, reinterpret_cast<const Bytef *>(dataSnapshot.data() + 4), metadata.m_actualSize) == metadata.m_crcDigest,
          "captured fsync snapshots have matching data/CRC");
    reset();
    auto unrelated = TestMMKV::mmkvWithID("unrelated-cached");
    race = true; active = true; observationTimeout = 2s;
    std::atomic<bool> foundCached = false;
    std::thread lookup([&] {
        { std::unique_lock<std::mutex> lock(gate); wake.wait(lock, [] { return attempting.load(); }); }
        foundCached = TestMMKV::mmkvWithID("unrelated-cached") == unrelated;
        finished = true; wake.notify_all();
    });
    result = barrier("healthy"); lookup.join();
    check(result == 0 && foundCached && interleaved,
          "unrelated cached factory lookup completes during the paused flush");
    reset(); unrelated->close();
    auto closing = TestMMKV::mmkvWithID("close-during-flush");
    closing->set(std::string("fixture"), TEST_KEY);
    race = true; active = true;
    std::thread closer([&] {
        { std::unique_lock<std::mutex> lock(gate); wake.wait(lock, [] { return attempting.load(); }); }
        closing->close();
        finished = true; wake.notify_all();
    });
    result = barrier("close-during-flush"); closer.join();
    check(result == 0 && finished && !interleaved,
          "concurrent close waits for both flushes before destroying the instance");
    reset();
    bool descriptorsClosed = true;
    for (int stage : {1, 2}) {
        int before = descriptorCount();
        reset(); failFsync = stage; active = true;
        check(barrier("healthy") != 0, "fsync failure " + std::to_string(stage));
        descriptorsClosed &= descriptorCount() == before;
        reset(); failMsync = stage; active = true;
        check(barrier("healthy") != 0, "msync failure " + std::to_string(stage));
        descriptorsClosed &= descriptorCount() == before;
    }
    for (int stage : {1, 2}) {
        int before = descriptorCount();
        reset(); failOpen = stage; active = true;
        check(barrier("healthy") != 0, "open failure " + std::to_string(stage));
        descriptorsClosed &= descriptorCount() == before;
    }
    check(descriptorsClosed, "all failure paths close their opened descriptors");
    reset(); interruptOpen = true; active = true;
    check(barrier("healthy") == 0, "open EINTR is retried");
    reset(); interruptFsync = true; active = true;
    check(barrier("healthy") == 0, "fsync EINTR is retried");
    reset(); interruptMsync = true; active = true;
    check(barrier("healthy") == 0, "msync EINTR is retried");
    for (const auto &suffix : {"", ".crc"}) {
        reset(); auto warm = TestMMKV::mmkvWithID("warm-missing");
        warm->set(std::string("fixture"), TEST_KEY);
        std::filesystem::remove(root + "/warm-missing" + suffix);
        active = true;
        check(barrier("warm-missing") != 0 && !std::filesystem::exists(root + "/warm-missing" + suffix), std::string("warm missing file not recreated: ") + suffix);
        reset(); warm->close(); TestMMKV::removeStorage("warm-missing");
        auto replaced = TestMMKV::mmkvWithID("replaced");
        replaced->set(std::string("fixture"), TEST_KEY);
        std::filesystem::rename(root + "/replaced" + suffix, root + "/old-inode");
        int fd = open((root + "/replaced" + suffix).c_str(), O_RDWR | O_CREAT, 0600);
        ftruncate(fd, 4096); close(fd);
        active = true;
        check(barrier("replaced") != 0, std::string("replaced mapped inode rejected: ") + suffix);
        reset(); replaced->close(); TestMMKV::removeStorage("replaced");
        std::filesystem::remove(root + "/old-inode");
    }
    reset(); auto empty = TestMMKV::mmkvWithID("initialized-empty"); active = true;
    check(barrier("initialized-empty") == 0, "ordinary factory initialization of an empty store remains valid");
    reset(); empty->close();
    // A closed instance may leave healthy files. Sync must not reopen it.
    active = true;
    check(barrier("initialized-empty") != 0, "closed instance rejected without a creating lookup");
    reset();
#ifdef NEW_API
    std::atomic<int> unexpected = 0;
    std::thread creator([&] {
        for (int i = 0; i < 200; ++i) {
            auto store = TestMMKV::mmkvWithID("concurrent-init");
            store->set(std::string("fixture"), TEST_KEY);
            store->close();
        }
    });
    for (int i = 0; i < 200; ++i) {
        int error = barrier("concurrent-init");
        if (error != 0 && error != ENOENT) ++unexpected;
    }
    creator.join();
    check(unexpected == 0, "concurrent factory/close cannot invalidate an existing-only sync");
#else
    std::cout << "SKIP concurrent close stress: baseline factory returns an unpinned pointer" << std::endl;
#endif
    reset(); kv->close();
    TestMMKV::onExit();
    std::filesystem::remove_all(root); // Only this process's mkdtemp fixture.
    return failures ? 1 : 0;
}
