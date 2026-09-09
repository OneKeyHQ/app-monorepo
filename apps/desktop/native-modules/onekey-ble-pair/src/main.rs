//! One-shot Windows BLE pairing helper for OneKey desktop.
//!
//! Why this exists: noble's WinRT backend never initiates OS BLE bonding, so a
//! Trezor Safe 7 (encryption-gated GATT) fails at service discovery with
//! "Device is unreachable". This helper performs the WinRT
//! `DeviceInformationCustomPairing` ceremony (ConfirmPinMatch) BEFORE noble
//! connects, then exits. Ported from trezor-suite `transport-bluetooth`
//! `src/server/platform/windows.rs` `try_to_pair`.
//!
//! Concurrency matches suite: the WinRT async ops are `.await`ed (driven by a
//! minimal block_on), NOT blocked with `.get()`. Blocking starved the
//! `PairingRequested` delegate, so our auto-accept never ran. That is fixed and
//! confirmed by the logs (the delegate fires) — do NOT re-tweak it.
//!
//! `PairAsync` still returns `Failed(19)`, WinRT's opaque catch-all, ~12s after
//! we Accept. 19 carries no reason, so this build records everything needed to
//! tell the candidates apart from a SINGLE failing run (rebuilds are expensive):
//!   - address type + RPA bit pattern     -> is the device using a rotating
//!                                           Resolvable Private Address?
//!   - inventory of already-paired BLE    -> is there a stale/half bond, maybe
//!     devices, before and after            under a previous RPA?
//!   - link up/down during the ceremony   -> did the device drop the link, or
//!                                           did we time out while connected?
//!   - IsPaired() *before* the cleanup    -> did the bond actually get stored
//!     unpair                               despite the Failed status?
//!   - monotonic ms on every line         -> is the ~12s a fixed OS timeout or
//!                                           human latency?
//!
//! stdout protocol — one JSON object per line, flushed immediately:
//!   {"type":"diag","t_ms":123,"msg":"..."}   diagnostics (mirrored on stderr)
//!   {"type":"pairing","pin":"123456"}        pin to compare with the device
//!   {"type":"paired"} / {"type":"already-paired"}
//!   {"type":"is-paired","paired":true}
//!   {"type":"unpaired"}
//!   {"type":"error","message":"..."}         (also non-zero exit)
//!
//! Usage: onekey-ble-pair <pair|is-paired|forget|inspect> --address AA:BB:..:FF

#[cfg(windows)]
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
#[cfg(windows)]
use std::sync::{Mutex, OnceLock};
#[cfg(windows)]
use std::time::Instant;

#[cfg(windows)]
static START: OnceLock<Instant> = OnceLock::new();
/// Every emitted line is also appended here, so a standalone run leaves a single
/// self-contained log the user can hand back verbatim (stdout and stderr get
/// interleaved/reordered by the terminal; this does not).
#[cfg(windows)]
static LOG_FILE: OnceLock<Mutex<std::fs::File>> = OnceLock::new();

#[cfg(windows)]
fn log_line(line: &str) {
    use std::io::Write;
    if let Some(lock) = LOG_FILE.get() {
        if let Ok(mut f) = lock.lock() {
            let _ = writeln!(f, "{line}");
            let _ = f.flush();
        }
    }
}

/// Open `onekey-ble-pair.log` next to the exe (fallback: cwd). Best-effort — if
/// it can't be opened we just don't file-log.
#[cfg(windows)]
fn init_log_file() {
    let path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("onekey-ble-pair.log")))
        .unwrap_or_else(|| std::path::PathBuf::from("onekey-ble-pair.log"));
    if let Ok(file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = LOG_FILE.set(Mutex::new(file));
        log_line(&format!("===== onekey-ble-pair run, log at {} =====", path.display()));
    }
}
/// Set by the PairingRequested delegate so we can report Accept -> result delta.
#[cfg(windows)]
static ACCEPT_MS: AtomicU64 = AtomicU64::new(u64::MAX);

// The host's half of the numeric comparison, fed by the parent over stdin.
// Accepting unconditionally skips that comparison and leaves no way to cancel:
// after Accept() an abort can only drop the link, which reads as a dead peer.
#[cfg(windows)]
const DECISION_PENDING: u8 = 0;
#[cfg(windows)]
const DECISION_CONFIRM: u8 = 1;
#[cfg(windows)]
const DECISION_CANCEL: u8 = 2;
#[cfg(windows)]
static DECISION: AtomicU8 = AtomicU8::new(DECISION_PENDING);

/// Poll interval while the delegate waits for the parent's decision.
#[cfg(windows)]
const DECISION_POLL_MS: u64 = 25;

/// Backstop so a parent that never answers cannot wedge the helper; the device
/// gives up on its own pairing window long before this.
#[cfg(windows)]
const DECISION_TIMEOUT_MS: u64 = 120_000;

/// Hold the ceremony until the parent decides, then Accept (or not) and release
/// the deferral. Completing WITHOUT Accept is what makes Windows send the device
/// an SMP Pairing Failed, so it shows the cancel and leaves pairing mode.
#[cfg(windows)]
fn await_decision(
    args: &windows::Devices::Enumeration::DevicePairingRequestedEventArgs,
    kind: &str,
) -> windows::core::Result<()> {
    let deferral = args.GetDeferral()?;
    let started = t_ms();
    diag(&format!("{kind}: awaiting host confirmation"));

    let decision = loop {
        let current = DECISION.load(Ordering::SeqCst);
        if current != DECISION_PENDING {
            break current;
        }
        if t_ms().saturating_sub(started) >= DECISION_TIMEOUT_MS {
            // Treat silence as refusal: never bond a device nobody confirmed.
            break DECISION_CANCEL;
        }
        std::thread::sleep(std::time::Duration::from_millis(DECISION_POLL_MS));
    };

    let waited = t_ms().saturating_sub(started);
    if decision == DECISION_CONFIRM {
        args.Accept()?;
        ACCEPT_MS.store(t_ms(), Ordering::SeqCst);
        diag(&format!(
            "accepted {kind} after {waited}ms (device confirmation pending)"
        ));
    } else {
        diag(&format!(
            "declined {kind} after {waited}ms; the device is told via SMP Pairing Failed"
        ));
    }
    deferral.Complete()?;
    Ok(())
}

/// Watch stdin for a `confirm` / `cancel` line. EOF (parent closed the pipe or
/// died) counts as a cancel, so the device is told rather than left to time out.
#[cfg(windows)]
fn spawn_decision_reader() {
    std::thread::spawn(|| {
        use std::io::BufRead;
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            let Ok(line) = line else { break };
            let decision = match line.trim() {
                "confirm" => DECISION_CONFIRM,
                "cancel" => DECISION_CANCEL,
                _ => continue,
            };
            // First decision wins; a later line cannot flip a settled ceremony.
            let _ = DECISION.compare_exchange(
                DECISION_PENDING,
                decision,
                Ordering::SeqCst,
                Ordering::SeqCst,
            );
            return;
        }
        let _ = DECISION.compare_exchange(
            DECISION_PENDING,
            DECISION_CANCEL,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
    });
}

#[cfg(windows)]
fn t_ms() -> u64 {
    START
        .get_or_init(Instant::now)
        .elapsed()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[cfg(windows)]
fn main() {
    START.get_or_init(Instant::now);
    init_log_file();

    // Multithreaded apartment so WinRT event delegates (PairingRequested,
    // ConnectionStatusChanged) are dispatched on thread-pool threads while we
    // wait for PairAsync.
    unsafe {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("");
    let address = get_flag(&args, "--address");
    let seconds = get_flag(&args, "--seconds")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(60);

    diag(&format!("helper start command={command} address={address:?}"));

    // Leave the link up after bonding instead of closing it. The device holds the
    // link and waits for the host anyway ("wait connection" on screen), so
    // closing may be pointless — or may be the only thing that lets it advertise
    // again. Runtime-selectable so both halves can be tried from one build.
    let keep_link = args.iter().any(|a| a == "--keep-link");

    // Only `pair` has a ceremony to gate; the read-only commands never block on
    // a decision, and starting the reader for them would just hold their stdin.
    if command == "pair" {
        spawn_decision_reader();
    }

    let result = pollster::block_on(async {
        match command {
            "pair" => win::run_pair(address, keep_link).await,
            "is-paired" => win::run_is_paired(address).await,
            "forget" => win::run_forget(address).await,
            // Read-only forensics: safe to run any time, changes no bond state.
            "inspect" => win::run_inspect(address).await,
            // Raw advertisement dump — run standalone, no app rebuild needed.
            "watch" => win::run_watch(seconds).await,
            other => Err(format!("unknown command: '{other}'")),
        }
    });

    diag(&format!("helper exit ok={}", result.is_ok()));

    if let Err(message) = result {
        emit_error(&message);
        std::process::exit(1);
    }
}

#[cfg(windows)]
mod win {
    use super::{diag, t_ms, ACCEPT_MS};
    use std::collections::HashSet;
    use std::sync::atomic::Ordering;
    use std::sync::Mutex;
    use windows::{
        core::{IInspectable, Ref},
        Devices::Bluetooth::Advertisement::{
            BluetoothLEAdvertisementReceivedEventArgs, BluetoothLEAdvertisementWatcher,
            BluetoothLEScanningMode,
        },
        Devices::Bluetooth::{BluetoothAddressType, BluetoothLEDevice},
        Devices::Enumeration::{
            DeviceInformation, DeviceInformationCustomPairing, DeviceInformationPairing,
            DeviceInformationUpdate, DevicePairingKinds, DevicePairingRequestedEventArgs,
            DevicePairingResultStatus, DeviceUnpairingResultStatus, DeviceWatcher,
        },
        Foundation::TypedEventHandler,
    };

    fn we(e: windows::core::Error) -> String {
        e.to_string()
    }

    /// Classify the address from its top two bits (BLE core spec). This does not
    /// depend on WinRT reporting anything, so it is the ground truth for "is the
    /// device advertising a rotating Resolvable Private Address?".
    ///   0b01 -> Resolvable Private (rotates; needs an IRK from a bond to track)
    ///   0b11 -> Static Random (stable for the power cycle)
    ///   0b00 -> Non-Resolvable Private (rotates, unbondable as an identity)
    fn classify_random_address(addr: u64) -> &'static str {
        let msb = ((addr >> 40) & 0xff) as u8;
        match msb >> 6 {
            0b01 => "ResolvablePrivate(rotating)",
            0b11 => "StaticRandom",
            0b00 => "NonResolvablePrivate(rotating)",
            _ => "Reserved",
        }
    }

    fn addr_type_name(t: BluetoothAddressType) -> &'static str {
        if t == BluetoothAddressType::Public {
            "Public"
        } else if t == BluetoothAddressType::Random {
            "Random"
        } else {
            "Unspecified"
        }
    }

    /// Dump everything WinRT will tell us about the target device. Read-only.
    fn describe_device(device: &BluetoothLEDevice, pairing: &DeviceInformationPairing, tag: &str) {
        let addr = device.BluetoothAddress().unwrap_or(0);
        let addr_type = device
            .BluetoothAddressType()
            .map(addr_type_name)
            .unwrap_or("<err>");
        let random_kind = classify_random_address(addr);
        let name = device
            .Name()
            .map(|v| v.to_string())
            .unwrap_or_else(|_| "<err>".into());
        // Contains "<adapter addr>-<device addr>"; useful to spot a stale entry
        // bound to a previous (rotated) address.
        let device_id = device
            .DeviceId()
            .map(|v| v.to_string())
            .unwrap_or_else(|_| "<err>".into());
        let conn = device
            .ConnectionStatus()
            .map(|v| format!("{v:?}"))
            .unwrap_or_else(|_| "<err>".into());
        let is_paired = pairing.IsPaired().unwrap_or(false);
        let can_pair = pairing.CanPair().unwrap_or(false);
        let protection = pairing
            .ProtectionLevel()
            .map(|v| format!("{v:?}"))
            .unwrap_or_else(|_| "<err>".into());

        diag(&format!(
            "[{tag}] addr={addr:012x} addrType={addr_type} randomKind={random_kind} \
             name='{name}' connection={conn} isPaired={is_paired} canPair={can_pair} \
             protectionLevel={protection} deviceId='{device_id}'"
        ));
    }

    /// Every BLE bond Windows currently holds. Manual `inspect` only — the ids
    /// embed real MACs of the user's other peripherals, so this must not run in
    /// the automatic pairing flow, whose log gets exported.
    async fn dump_paired_inventory(tag: &str) {
        let selector = match BluetoothLEDevice::GetDeviceSelectorFromPairingState(true) {
            Ok(s) => s,
            Err(e) => {
                diag(&format!("[{tag}] paired-inventory selector error: {e}"));
                return;
            }
        };
        let collection = match DeviceInformation::FindAllAsyncAqsFilter(&selector) {
            Ok(op) => match op.await {
                Ok(c) => c,
                Err(e) => {
                    diag(&format!("[{tag}] paired-inventory find error: {e}"));
                    return;
                }
            },
            Err(e) => {
                diag(&format!("[{tag}] paired-inventory find error: {e}"));
                return;
            }
        };
        let size = collection.Size().unwrap_or(0);
        diag(&format!("[{tag}] paired BLE devices: {size}"));
        for i in 0..size {
            if let Ok(info) = collection.GetAt(i) {
                let id = info
                    .Id()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|_| "<err>".into());
                let name = info
                    .Name()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|_| "<err>".into());
                let paired = info
                    .Pairing()
                    .and_then(|p| p.IsPaired())
                    .unwrap_or(false);
                diag(&format!(
                    "[{tag}]   #{i} paired={paired} name='{name}' id='{id}'"
                ));
            }
        }
    }

    /// A BLE `DeviceInformation.Id` looks like
    /// `BluetoothLE#BluetoothLE<adapter-addr>-<device-addr>`. For a BONDED
    /// device the trailing address is the device's IDENTITY address — the stable
    /// one, as opposed to the rotating RPA we had to pair against. That identity
    /// is the only durable handle on a privacy-mode device like the Safe 7.
    fn identity_from_device_id(id: &str) -> Option<String> {
        id.rsplit('-').next().filter(|a| a.len() == 17).map(str::to_string)
    }

    /// After bonding, find the device's identity address from the OS bond record.
    /// Prefers a name match; falls back to the sole bonded device when there is
    /// exactly one (the common case on a clean machine).
    async fn find_bonded_identity(device_name: &str) -> Option<String> {
        let selector = BluetoothLEDevice::GetDeviceSelectorFromPairingState(true).ok()?;
        let collection = DeviceInformation::FindAllAsyncAqsFilter(&selector)
            .ok()?
            .await
            .ok()?;
        let size = collection.Size().unwrap_or(0);
        let mut candidates: Vec<(String, String)> = Vec::new();
        for i in 0..size {
            if let Ok(info) = collection.GetAt(i) {
                let id = info.Id().map(|v| v.to_string()).unwrap_or_default();
                let name = info.Name().map(|v| v.to_string()).unwrap_or_default();
                if let Some(identity) = identity_from_device_id(&id) {
                    candidates.push((name, identity));
                }
            }
        }
        if let Some((_, identity)) = candidates.iter().find(|(n, _)| n == device_name) {
            return Some(identity.clone());
        }
        if candidates.len() == 1 {
            return Some(candidates[0].1.clone());
        }
        None
    }

    /// Open the device by address and return it together with its pairing
    /// handle. The device is returned so the caller keeps it alive across the
    /// (async) pairing call.
    async fn open_pairing(
        addr: u64,
    ) -> Result<(BluetoothLEDevice, DeviceInformationPairing), String> {
        let device = BluetoothLEDevice::FromBluetoothAddressAsync(addr)
            .map_err(we)?
            .await
            .map_err(we)?;
        let pairing = device
            .DeviceInformation()
            .map_err(we)?
            .Pairing()
            .map_err(we)?;
        Ok((device, pairing))
    }

    /// Watch the link go up/down for the duration of the ceremony. This is the
    /// single most decisive signal we are missing: if the device drops the link
    /// mid-ceremony we will see Disconnected here, which rules out "we merely
    /// timed out waiting for a user who was still connected".
    fn watch_connection(device: &BluetoothLEDevice) {
        let handler = TypedEventHandler::<BluetoothLEDevice, IInspectable>::new(
            move |sender, _args: Ref<IInspectable>| {
                if let Ok(dev) = sender.ok() {
                    let status = dev
                        .ConnectionStatus()
                        .map(|v| format!("{v:?}"))
                        .unwrap_or_else(|_| "<err>".into());
                    diag(&format!("link connectionStatus -> {status}"));
                }
                Ok(())
            },
        );
        if let Err(e) = device.ConnectionStatusChanged(&handler) {
            diag(&format!("ConnectionStatusChanged subscribe error: {e}"));
        }
        // Handler intentionally leaked for the lifetime of this one-shot process;
        // the token is not needed since we exit right after pairing.
        std::mem::forget(handler);
    }

    /// Find this device's ASSOCIATION ENDPOINT among the system's unpaired BLE
    /// AEPs — the same object the Windows Settings pairing wizard pairs.
    ///
    /// This is the one structural difference left between Settings (pairs fine
    /// on this machine) and us (link never forms): we have been pairing the
    /// DeviceInformation hanging off `BluetoothLEDevice.FromBluetoothAddressAsync`,
    /// which is a DeviceInterface-kind object. Settings pairs the
    /// AssociationEndpoint-kind DeviceInformation produced by discovery, and
    /// Microsoft's own DeviceEnumerationAndPairing sample does the same. The two
    /// kinds do not behave identically under PairAsync.
    ///
    /// Discovers with a DeviceWatcher, because that is what actually MINTS the
    /// AEP entries — Settings' device list is a DeviceWatcher. The first
    /// implementation used `FindAllAsyncAqsFilter`, a snapshot query: with the
    /// unpaired-BLE selector it blocked ~30s per call and still missed a device
    /// that was advertising loudly (184s burned in the field, which also let the
    /// device's pairing window lapse). The watcher delivers an Added event within
    /// a second or two, and the deadline here is kept short for the same reason.
    async fn find_unpaired_aep(addr: u64, timeout_ms: u64) -> Option<DeviceInformation> {
        let b = addr.to_be_bytes(); // 8 bytes; the MAC is the low 6
        let suffix = format!(
            "-{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
            b[2], b[3], b[4], b[5], b[6], b[7]
        );
        let selector = BluetoothLEDevice::GetDeviceSelectorFromPairingState(false).ok()?;
        let watcher = DeviceInformation::CreateWatcherAqsFilter(&selector).ok()?;

        let found: &'static Mutex<Option<DeviceInformation>> =
            Box::leak(Box::new(Mutex::new(None)));
        let added = {
            let suffix = suffix.clone();
            TypedEventHandler::<DeviceWatcher, DeviceInformation>::new(
                move |_, info: Ref<DeviceInformation>| {
                    if let Ok(info) = info.ok() {
                        let id = info.Id()?.to_string().to_lowercase();
                        if id.ends_with(&suffix) {
                            diag(&format!("AEP watcher matched: id='{id}'"));
                            if let Ok(mut slot) = found.lock() {
                                *slot = Some(info.clone());
                            }
                        }
                    }
                    Ok(())
                },
            )
        };
        // Updated/Removed must be subscribed before Start() for an AEP watcher;
        // no-ops are fine, we only care about Added.
        let noop = TypedEventHandler::<DeviceWatcher, DeviceInformationUpdate>::new(|_, _| Ok(()));
        watcher.Added(&added).ok()?;
        watcher.Updated(&noop).ok()?;
        watcher.Removed(&noop).ok()?;
        watcher.Start().ok()?;
        diag(&format!(
            "AEP watcher started (settings-style discovery), waiting up to {timeout_ms}ms for {suffix}"
        ));

        let started = std::time::Instant::now();
        let result = loop {
            if let Ok(mut slot) = found.lock() {
                if slot.is_some() {
                    break slot.take();
                }
            }
            if started.elapsed().as_millis() as u64 >= timeout_ms {
                break None;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        };
        let _ = watcher.Stop();
        result
    }

    pub async fn run_pair(address: Option<String>, keep_link: bool) -> Result<(), String> {
        let addr = super::require_address(address)?;
        diag(&format!("run_pair keepLink={keep_link}"));


        let (device, pairing) = open_pairing(addr).await?;
        describe_device(&device, &pairing, "before");
        watch_connection(&device);

        if pairing.IsPaired().map_err(we)? {
            diag("already paired, nothing to do");
            super::emit(r#"{"type":"already-paired"}"#);
            return Ok(());
        }
        if !pairing.CanPair().map_err(we)? {
            return Err("device reports CanPair = false".into());
        }

        // Settings-style pairing: prefer the AEP; fall back to the old
        // device-interface pairing only if the AEP cannot be found.
        let ceremony_pairing: DeviceInformationPairing = match find_unpaired_aep(addr, 12_000).await
        {
            Some(info) => {
                diag("pairing via AEP DeviceInformation (settings-style)");
                info.Pairing().map_err(we)?
            }
            None => {
                diag("AEP not found; falling back to device-interface pairing (legacy path)");
                pairing.clone()
            }
        };

        let custom = ceremony_pairing.Custom().map_err(we)?;

        // Only request kinds we actually accept. A Safe 7 has a screen and, on
        // every real pairing observed, negotiates ConfirmPinMatch; DisplayPin
        // is kept as a fallback since it is handled the same way (surface the
        // code, accept). ConfirmOnly/ProvidePin are neither accepted nor
        // rejected by the handler below (see the `other` arm) — requesting
        // them let a negotiation silently land there and hang until Windows'
        // own pairing timeout. Not requesting them makes Windows fail that
        // negotiation immediately instead.
        let kinds = DevicePairingKinds::DisplayPin | DevicePairingKinds::ConfirmPinMatch;

        let handler = TypedEventHandler::<
            DeviceInformationCustomPairing,
            DevicePairingRequestedEventArgs,
        >::new(move |_sender, args: Ref<DevicePairingRequestedEventArgs>| {
            if let Ok(args) = args.ok() {
                let kind = args.PairingKind()?;
                diag(&format!("PairingRequested kind={kind:?}"));
                match kind {
                    // Numeric comparison: surface the pin, then hold the
                    // ceremony until the parent says the user matched it.
                    DevicePairingKinds::ConfirmPinMatch => {
                        let pin = args.Pin()?;
                        super::emit(&format!(
                            r#"{{"type":"pairing","pin":"{}"}}"#,
                            super::json_escape(&pin.to_string())
                        ));
                        super::await_decision(&args, "ConfirmPinMatch")?;
                    }
                    // Device shows a pin; Windows just needs a yes. Same gate:
                    // the user is still confirming a code they can read.
                    DevicePairingKinds::DisplayPin => {
                        if let Ok(pin) = args.Pin() {
                            super::emit(&format!(
                                r#"{{"type":"pairing","pin":"{}"}}"#,
                                super::json_escape(&pin.to_string())
                            ));
                        }
                        super::await_decision(&args, "DisplayPin")?;
                    }
                    // Just-works: no code, so nothing ties the bond to the device
                    // in front of the user. A Safe 7 has a screen and always
                    // offers a code-based ceremony, so this can only be a device
                    // impersonating one — refuse rather than bond silently.
                    DevicePairingKinds::ConfirmOnly => {
                        diag("refused ConfirmOnly: Safe 7 must pair with a code");
                    }
                    // We do not have a pin to type in; log so the failure is legible.
                    other => diag(&format!("cannot satisfy pairing kind {other:?}")),
                }
            }
            Ok(())
        });
        custom.PairingRequested(&handler).map_err(we)?;

        // Keep an advertisement watcher running for the whole ceremony, the way
        // Trezor Suite does. Suite pairs WITHOUT stopping its scan
        // (connect_device never calls stop_scan; the start_scan loop stays live),
        // so on Windows the radio is actively watching the device throughout
        // PairAsync. Our helper otherwise pairs silently, and the SMP handshake
        // stalls: the device sits in `wait_ble_host_confirmation` and drops the
        // link at ~22s -> Failed(19). Our pairing code is byte-for-byte Suite's,
        // so this ambient scan is the remaining structural difference. Dropped
        // (Stop) as soon as PairAsync returns.
        let scan_watcher = BluetoothLEAdvertisementWatcher::new().ok();
        if let Some(w) = &scan_watcher {
            let _ = w.SetScanningMode(BluetoothLEScanningMode::Active);
            // WinRT REQUIRES a Received handler before Start(), else Start fails
            // with 0x8000000E ("must register at least one Received handler").
            // The handler body does nothing — we only need the radio scanning,
            // not the results — but it must exist.
            let sink = TypedEventHandler::<
                BluetoothLEAdvertisementWatcher,
                BluetoothLEAdvertisementReceivedEventArgs,
            >::new(|_, _| Ok(()));
            match w.Received(&sink) {
                Ok(_) => match w.Start() {
                    Ok(()) => diag("started ambient advertisement watcher for pairing"),
                    Err(e) => diag(&format!("ambient watcher start error: {e}")),
                },
                Err(e) => diag(&format!("ambient watcher Received-subscribe error: {e}")),
            }
        } else {
            diag("ambient watcher unavailable");
        }

        diag(&format!("calling PairAsync(kinds={kinds:?})"));
        let result = custom.PairAsync(kinds).map_err(we)?.await.map_err(we)?;

        if let Some(w) = &scan_watcher {
            let _ = w.Stop();
        }

        let accepted_at = ACCEPT_MS.load(Ordering::SeqCst);
        let since_accept = if accepted_at == u64::MAX {
            "never-accepted".to_string()
        } else {
            format!("{}ms", t_ms().saturating_sub(accepted_at))
        };
        let status = result.Status().map_err(we)?;
        // ProtectionLevelUsed tells us what security tier the ceremony actually
        // negotiated (None/Encryption/EncryptionAndAuthentication) — a mismatch
        // here vs the device's required level is one concrete way SMP fails.
        let prot_used = result
            .ProtectionLevelUsed()
            .map(|v| format!("{v:?}"))
            .unwrap_or_else(|_| "<err>".into());
        diag(&format!(
            "PairAsync returned status={status:?} protectionLevelUsed={prot_used} sinceAccept={since_accept}"
        ));

        // Deep probe on FAILURE: separate "never connected" from "connected but
        // SMP/GATT failed". Status 19 flattens both. We ask three questions the
        // device can only answer if the link is actually reachable:
        //   - ConnectionStatus right now
        //   - whether an unpaired GATT service query reaches it (the earliest
        //     failures in this whole saga were GetGattServicesAsync=Unreachable,
        //     which is far more specific than 19)
        //   - the current DeviceAccessInformation
        if status != DevicePairingResultStatus::Paired {
            let conn = device
                .ConnectionStatus()
                .map(|v| format!("{v:?}"))
                .unwrap_or_else(|_| "<err>".into());
            diag(&format!("[probe] connectionStatus={conn}"));

            match device.GetGattServicesAsync() {
                Ok(op) => match op.await {
                    Ok(res) => {
                        let gatt_status = res
                            .Status()
                            .map(|v| format!("{v:?}"))
                            .unwrap_or_else(|_| "<err>".into());
                        let count = res.Services().and_then(|s| s.Size()).unwrap_or(0);
                        diag(&format!(
                            "[probe] GetGattServices status={gatt_status} serviceCount={count} \
                             (Unreachable => link never formed; Success => link is fine, SMP is the problem)"
                        ));
                    }
                    Err(e) => diag(&format!("[probe] GetGattServices await error: {e}")),
                },
                Err(e) => diag(&format!("[probe] GetGattServices call error: {e}")),
            }
        }

        // State AFTER the ceremony but BEFORE our cleanup unpair — this is the
        // window in which "Failed but actually bonded" would be visible, and the
        // cleanup below would otherwise destroy the evidence.
        describe_device(&device, &pairing, "after");

        match status {
            DevicePairingResultStatus::Paired => {

                // The RPA we just paired against is disposable — the device will
                // rotate it. Hand the caller the identity address from the bond
                // record so it can address the device durably; a connectId keyed
                // on the RPA is dead the moment it rotates.
                let name = device.Name().map(|v| v.to_string()).unwrap_or_default();
                match find_bonded_identity(&name).await {
                    Some(identity) => {
                        diag(&format!(
                            "bonded identity address={identity} (paired via RPA {addr:012x})"
                        ));
                        super::emit(&format!(
                            r#"{{"type":"identity","address":"{identity}"}}"#
                        ));
                    }
                    None => diag("could not resolve bonded identity address"),
                }

                // Suite does exactly this ("disconnect after successful pairing
                // and proceed to discover_services()"). Pairing leaves the link
                // UP, and a connected BLE peripheral stops advertising — so
                // noble's scan finds nothing and connect fails with "device not
                // found". Dropping the link lets it advertise again.
                if keep_link {
                    diag("keepLink=true: NOT closing the device handle");
                } else {
                    match device.Close() {
                        Ok(()) => diag("closed device handle after pairing"),
                        Err(e) => diag(&format!("close after pairing failed: {e}")),
                    }
                }
                drop(device);

                // One immediate link check, no waits: the device holds the
                // pairing link through the settle window anyway, and the app
                // auto-retries the first connect after a fresh bond.
                match BluetoothLEDevice::FromBluetoothAddressAsync(addr) {
                    Ok(op) => match op.await {
                        Ok(dev) => {
                            let status = dev
                                .ConnectionStatus()
                                .map(|v| format!("{v:?}"))
                                .unwrap_or_else(|_| "<err>".into());
                            diag(&format!(
                                "post-close link check: connection={status} \
                                 (Connected => device will NOT advertise => noble cannot find it)"
                            ));
                            let _ = dev.Close();
                        }
                        Err(e) => diag(&format!("post-close link check: {e}")),
                    },
                    Err(e) => diag(&format!("post-close link check: {e}")),
                }

                super::emit(r#"{"type":"paired"}"#);
                Ok(())
            }
            status => {
                // Best-effort cleanup: a failed ceremony can leave a half-bond
                // that makes the device un-scannable/un-connectable next time
                // (the "device disappears" dead-end). Unpair so the next attempt
                // starts clean. Ignore errors — we're already failing.
                diag(&format!("failed status {status:?}, unpairing to clean up"));
                // Clean up on the same object the ceremony ran on.
                if let Ok(op) = ceremony_pairing.UnpairAsync() {
                    match op.await {
                        Ok(r) => diag(&format!(
                            "cleanup unpair status={:?}",
                            r.Status().unwrap_or(DeviceUnpairingResultStatus::Failed)
                        )),
                        Err(e) => diag(&format!("cleanup unpair error: {e}")),
                    }
                }
                Err(format!("pairing failed with status {status:?}"))
            }
        }
    }

    /// Raw advertisement dump. ACTIVE scanning (so scan-response payloads are
    /// included) with NO service-UUID filter — this is deliberately everything
    /// noble's filtered scan could be hiding. Answers, without any of our own
    /// stack in the way:
    ///   - is the device advertising at all, or does it go quiet for minutes?
    ///   - does it advertise the Trezor service UUID in the ADV packet, or only
    ///     in the scan response (which a passive filtered scan would miss)?
    ///   - is it connectable, and under which (rotating) address?
    /// Each address is reported on first sighting, then again with a total count
    /// at the end, so the output stays readable.
    pub async fn run_watch(seconds: u64) -> Result<(), String> {
        let watcher = BluetoothLEAdvertisementWatcher::new().map_err(we)?;
        watcher
            .SetScanningMode(BluetoothLEScanningMode::Active)
            .map_err(we)?;

        let seen: &'static Mutex<HashSet<u64>> = Box::leak(Box::new(Mutex::new(HashSet::new())));
        // (addr, name, count, rssi_min, rssi_max). No per-packet logging — a scan
        // sees hundreds of adverts and printing each one buries the pairing flow.
        // Signal is kept as a min/max range per device, summarized once at the end.
        let hits: &'static Mutex<Vec<(u64, String, u32, i16, i16)>> =
            Box::leak(Box::new(Mutex::new(vec![])));

        let handler = TypedEventHandler::<
            BluetoothLEAdvertisementWatcher,
            BluetoothLEAdvertisementReceivedEventArgs,
        >::new(move |_sender, args: Ref<BluetoothLEAdvertisementReceivedEventArgs>| {
            if let Ok(args) = args.ok() {
                let addr = args.BluetoothAddress()?;
                let rssi = args.RawSignalStrengthInDBm().unwrap_or(0);
                let addr_type = args
                    .BluetoothAddressType()
                    .map(addr_type_name)
                    .unwrap_or("<err>");
                let adv = args.Advertisement()?;
                let name = adv
                    .LocalName()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|_| String::new());

                // Accumulate only — no per-packet log line. Track the signal as a
                // min/max range and keep the advert count.
                let r = rssi as i16;
                if let Ok(mut hits) = hits.lock() {
                    if let Some(e) = hits.iter_mut().find(|(a, ..)| *a == addr) {
                        e.2 += 1;
                        if r < e.3 { e.3 = r; }
                        if r > e.4 { e.4 = r; }
                    } else {
                        hits.push((addr, name.clone(), 1, r, r));
                    }
                }
                // Log ONLY the first time we ever see a Trezor, so the pairing
                // address is easy to grab without scrolling through the summary.
                if name.contains("Trezor")
                    && seen.lock().map(|mut s| s.insert(addr)).unwrap_or(false)
                {
                    diag(&format!(
                        "found {name} addr={addr:012x} addrType={addr_type} randomKind={} rssi={rssi}",
                        classify_random_address(addr)
                    ));
                }
            }
            Ok(())
        });

        watcher.Received(&handler).map_err(we)?;
        watcher.Start().map_err(we)?;
        diag(&format!("watching advertisements for {seconds}s (active scan, no filter)"));

        std::thread::sleep(std::time::Duration::from_secs(seconds));

        let _ = watcher.Stop();
        if let Ok(hits) = hits.lock() {
            let trezor: Vec<_> = hits.iter().filter(|(_, n, ..)| n.contains("Trezor")).collect();
            let named = hits.iter().filter(|(_, n, ..)| !n.is_empty()).count();
            diag(&format!(
                "watch done: {} devices ({} named, {} Trezor)",
                hits.len(),
                named,
                trezor.len()
            ));
            // Only Trezors get a line, with the signal range — everything else is
            // ambient noise and would bury it.
            for (addr, name, count, rmin, rmax) in trezor {
                diag(&format!(
                    "  TREZOR addr={addr:012x} name='{name}' adverts={count} rssi=[{rmax}..{rmin}]dBm"
                ));
            }
        }
        Ok(())
    }

    /// Read-only forensics — dumps device + bond state and changes nothing.
    pub async fn run_inspect(address: Option<String>) -> Result<(), String> {
        dump_paired_inventory("inspect").await;
        if let Some(addr) = address {
            if let Some(addr) = super::parse_address(&addr) {
                let (device, pairing) = open_pairing(addr).await?;
                describe_device(&device, &pairing, "inspect");
            }
        }
        Ok(())
    }

    pub async fn run_is_paired(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (device, pairing) = open_pairing(addr).await?;
        describe_device(&device, &pairing, "is-paired");
        let paired = pairing.IsPaired().map_err(we)?;
        super::emit(&format!(r#"{{"type":"is-paired","paired":{paired}}}"#));
        Ok(())
    }

    pub async fn run_forget(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (device, pairing) = open_pairing(addr).await?;
        describe_device(&device, &pairing, "forget-before");
        let result = pairing.UnpairAsync().map_err(we)?.await.map_err(we)?;
        let status = result.Status().map_err(we)?;
        diag(&format!("unpair status={status:?}"));
        match status {
            DeviceUnpairingResultStatus::Unpaired | DeviceUnpairingResultStatus::AlreadyUnpaired => {
                super::emit(r#"{"type":"unpaired"}"#);
                Ok(())
            }
            status => Err(format!("unpair failed with status {status:?}")),
        }
    }
}

// ----- shared helpers (Windows only; the stub main below needs none) -----

#[cfg(windows)]
fn emit(line: &str) {
    use std::io::Write;
    // Locked + flushed so the pin reaches the parent immediately.
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{line}");
    let _ = out.flush();
    // stdout carries the pin to the parent; the log file must not keep it —
    // it authorizes the bond while the ceremony is on screen.
    if line.contains(r#""type":"pairing""#) {
        log_line(r#"{"type":"pairing","pin":"[redacted]"}"#);
    } else {
        log_line(line);
    }
}

/// Diagnostics go out as their own stdout JSON line (so the parent logs them
/// individually and they carry a monotonic timestamp — stderr chunks get merged
/// by the pipe and lose ordering), mirrored to stderr, and appended to the log
/// file in human-readable form.
#[cfg(windows)]
fn diag(message: &str) {
    let t = t_ms();
    emit(&format!(
        r#"{{"type":"diag","t_ms":{t},"msg":"{}"}}"#,
        json_escape(message)
    ));
    let human = format!("[pair +{t}ms] {message}");
    eprintln!("{human}");
    log_line(&human);
}

#[cfg(windows)]
fn emit_error(message: &str) {
    emit(&format!(
        r#"{{"type":"error","message":"{}"}}"#,
        json_escape(message)
    ));
}

#[cfg(windows)]
fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\n', '\r'], " ")
}

#[cfg(windows)]
fn get_flag(args: &[String], flag: &str) -> Option<String> {
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == flag {
            return it.next().cloned();
        }
        if let Some(v) = a.strip_prefix(&format!("{flag}=")) {
            return Some(v.to_string());
        }
    }
    None
}

#[cfg(windows)]
fn require_address(address: Option<String>) -> Result<u64, String> {
    let s = address.ok_or_else(|| "missing --address".to_string())?;
    parse_address(&s).ok_or_else(|| format!("invalid --address: {s}"))
}

/// Parse a BLE address into the u64 `FromBluetoothAddressAsync` expects (AA is
/// the most significant byte). Accepts "AA:BB:CC:DD:EE:FF", dash-separated, or
/// bare "AABBCCDDEEFF".
#[cfg(windows)]
fn parse_address(s: &str) -> Option<u64> {
    let s = s.trim();
    let hex: String = if s.contains(':') || s.contains('-') {
        s.split([':', '-']).collect()
    } else {
        s.to_string()
    };
    if hex.len() != 12 {
        return None;
    }
    u64::from_str_radix(&hex, 16).ok()
}

#[cfg(not(windows))]
fn main() {
    // Windows-only: on macOS CoreBluetooth bonds transparently, and desktop BLE
    // is disabled on Linux. This stub keeps the crate compiling on non-Windows.
    eprintln!("onekey-ble-pair is only supported on Windows");
    std::process::exit(2);
}
