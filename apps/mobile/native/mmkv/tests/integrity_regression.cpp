#include "MMKV.h"
#include "MMKVMetaInfo.hpp"
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>
#include <unistd.h>

using namespace mmkv;
static const std::string storageID = "onekey-app-storage-v1";
static const char *marker = "__onekey_internal_app_storage_migration_v1__";
static void require(bool condition, const char *message) {
    if (!condition) throw std::runtime_error(message);
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
static MMKV *seed() {
    auto kv = MMKV::mmkvWithID(storageID);
    require(kv != nullptr, "fixture creation failed");
    kv->clearAll();
    require(kv->set(std::string("1"), marker), "marker write failed");
    require(kv->set(std::string("synthetic-value"), "fixture"), "value write failed");
    require(MMKV::syncExisting(storageID) == 0, "fixture ACK failed");
    return kv;
}
int main(int argc, char **argv) {
    require(argc == 2, "pass a temporary fixture directory");
    std::string pattern = std::string(argv[1]) + "/integrity.XXXXXX";
    auto directory = mkdtemp(pattern.data());
    require(directory != nullptr, "mkdtemp failed");
    const std::string root(directory);
    const auto dataPath = root + "/" + storageID;
    const auto crcPath = dataPath + ".crc";
    MMKV::initializeMMKV(root, MMKVLogNone);
    try {
        // A new empty store must remain usable; healthy explicit clearing is unchanged.
        auto kv = seed();
        kv->close();
        kv = MMKV::mmkvWithID(storageID);
        std::string value;
        require(kv->getString("fixture", value) && value == "synthetic-value", "healthy reopen failed");
        kv->close();

        for (const auto fault : {"crc", "data", "length", "version", "legacy-flags"}) {
            kv = seed();
            kv->close();
            const auto healthyData = readFile(dataPath);
            const auto healthyCRC = readFile(crcPath);
            auto data = healthyData;
            auto crc = healthyCRC;
            MMKVMetaInfo meta;
            meta.read(crc.data());
            // The valid checkpoint contains only the empty serialization holder.
            require(meta.m_lastConfirmedMetaInfo.lastActualSize == 4, "fixture checkpoint changed");
            if (std::string(fault) == "data") {
                data[4] ^= 1;
            } else if (std::string(fault) == "crc") {
                meta.m_crcDigest ^= 1;
            } else if (std::string(fault) == "length") {
                meta.m_actualSize = data.size();
            } else if (std::string(fault) == "version") {
                meta.m_version = MMKVVersionHolder;
            } else {
                meta.m_version = MMKVVersionActualSize;
                meta.m_flags = 1;
                meta.m_crcDigest ^= 1;
            }
            std::memcpy(crc.data(), &meta, sizeof(meta));
            writeFile(dataPath, data);
            writeFile(crcPath, crc);
            for (int retry = 0; retry < 2; ++retry) {
                require(MMKV::mmkvWithID(storageID) == nullptr, "invalid store passed factory validation");
                require(MMKV::syncExisting(storageID) != 0, "invalid store passed durable sync");
                require(readFile(dataPath) == data && readFile(crcPath) == crc, "factory/retry changed evidence");
            }
            // Repair is explicit and data preserving; reopening validates the repaired pair.
            writeFile(dataPath, healthyData);
            writeFile(crcPath, healthyCRC);
            kv = MMKV::mmkvWithID(storageID);
            require(kv != nullptr && kv->getString(marker, value) && value == "1", "repaired factory retry failed");
            require(kv->set(std::string("after-repair"), "fixture"), "repaired store stayed unavailable");
            require(MMKV::syncExisting(storageID) == 0, "repaired fixture ACK failed");
            kv->close();
            std::cout << fault << ": preserved and repairable\n";
        }
        // Disposable caches keep the upstream recovery policy.
        require(MMKV::isWriteProtectedStorage("onekey-app-storage-v1"), "app storage must be write-protected");
        require(MMKV::isWriteProtectedStorage("onekey-jotai-states"), "jotai states must be write-protected");
        require(MMKV::isWriteProtectedStorage("onekey-app-setting"), "app setting must be write-protected");
        require(MMKV::isWriteProtectedStorage("onekey-local-secret-envelope"), "local secret envelope must be write-protected");
        require(!MMKV::isWriteProtectedStorage("onekey-app-dev-setting"), "dev setting must not be write-protected");
        require(!MMKV::isWriteProtectedStorage("onekey-display-snapshot-simple-db-cache"), "simple-db snapshot must not be write-protected");
        require(!MMKV::isWriteProtectedStorage("onekey-display-snapshot-jotai-cache"), "jotai snapshot must not be write-protected");
        MMKV::setWriteProtectedStorage("custom-toggle-store", true);
        require(MMKV::isWriteProtectedStorage("custom-toggle-store"), "setWriteProtectedStorage(true) failed");
        MMKV::setWriteProtectedStorage("custom-toggle-store", false);
        require(!MMKV::isWriteProtectedStorage("custom-toggle-store"), "setWriteProtectedStorage(false) failed");

        const std::string cacheID = "disposable-cache";
        kv = MMKV::mmkvWithID(cacheID);
        require(kv->set(std::string("cached"), "fixture"), "cache write failed");
        kv->sync(MMKV_SYNC);
        kv->close();
        auto cacheCRC = readFile(root + "/" + cacheID + ".crc");
        MMKVMetaInfo cacheMeta;
        cacheMeta.read(cacheCRC.data());
        cacheMeta.m_crcDigest ^= 1;
        std::memcpy(cacheCRC.data(), &cacheMeta, sizeof(cacheMeta));
        writeFile(root + "/" + cacheID + ".crc", cacheCRC);
        kv = MMKV::mmkvWithID(cacheID);
        require(!kv->getString("fixture", value), "cache recovery behavior changed");
        require(kv->set(std::string("refilled"), "fixture"), "cache became unavailable");
        kv->close();
        const auto tracePath = dataPath + ".integrity.trace";
#if defined(DEBUG) && DEBUG
        // A checked sync rejects an evicted mapping without reloading it.
        kv = MMKV::mmkvWithID(storageID);
        require(kv != nullptr && kv->getString("fixture", value), "trace sync fixture failed");
        kv->clearMemoryCache();
        require(MMKV::syncExisting(storageID) != 0, "evicted mapping passed checked sync");
        kv->close();
        const auto traceBytes = readFile(tracePath);
        const std::string trace(traceBytes.begin(), traceBytes.end());
        require(trace.find("phase=load-rejected") != std::string::npos, "validation evidence missing");
        require(trace.find("phase=rewrite-begin") != std::string::npos, "rewrite start missing");
        require(trace.find("phase=rewrite-return") != std::string::npos, "rewrite return missing");
        require(trace.find("phase=sync-error") != std::string::npos, "sync error evidence missing");
        require(trace.find("synthetic-value") == std::string::npos && trace.find(marker) == std::string::npos,
                "diagnostic contains fixture keys or values");
        kv = MMKV::mmkvWithID(storageID);
        for (int i = 0; i < 600; ++i) {
            require(kv->set(std::string("private-diagnostic-fixture-") + std::to_string(i), "fixture"), "diagnostic loop write failed");
            require(MMKV::syncExisting(storageID) == 0, "diagnostic affected successful sync");
        }
        require(std::filesystem::exists(tracePath + ".previous"), "trace did not rotate");
        for (const auto &file : {tracePath, tracePath + ".previous"}) {
            require(std::filesystem::file_size(file) <= 129 * 1024, "trace exceeded its bound");
            const auto contentBytes = readFile(file);
            const std::string content(contentBytes.begin(), contentBytes.end());
            require(content.find("private-diagnostic-fixture-") == std::string::npos, "rotated trace exposed values");
        }
        const auto victim = root + "/synthetic-diagnostic-victim";
        const std::vector<char> sentinel{'s', 'a', 'f', 'e'};
        writeFile(victim, sentinel);
        std::filesystem::remove(tracePath);
        std::filesystem::create_symlink(victim, tracePath);
        require(kv->set(std::string("symlink-case"), "fixture"), "trace symlink affected write");
        require(MMKV::syncExisting(storageID) == 0, "trace symlink affected sync");
        require(readFile(victim) == sentinel, "trace followed a symlink");
        std::filesystem::remove(tracePath);
        std::filesystem::create_hard_link(victim, tracePath);
        require(kv->set(std::string("hardlink-case"), "fixture"), "trace hardlink affected write");
        require(MMKV::syncExisting(storageID) == 0, "trace hardlink affected sync");
        require(readFile(victim) == sentinel, "trace wrote through a hardlink");
        kv->close();
#else
        require(!std::filesystem::exists(tracePath), "non-debug build emitted diagnostics");
#endif
        std::filesystem::remove_all(root);
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
