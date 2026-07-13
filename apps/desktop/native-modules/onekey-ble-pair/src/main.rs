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
use std::sync::atomic::AtomicU64;
#[cfg(windows)]
use std::sync::OnceLock;
#[cfg(windows)]
use std::time::Instant;

#[cfg(windows)]
static START: OnceLock<Instant> = OnceLock::new();
/// Set by the PairingRequested delegate so we can report Accept -> result delta.
#[cfg(windows)]
static ACCEPT_MS: AtomicU64 = AtomicU64::new(u64::MAX);

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

    diag(&format!("helper start command={command} address={address:?}"));

    let result = pollster::block_on(async {
        match command {
            "pair" => win::run_pair(address).await,
            "is-paired" => win::run_is_paired(address).await,
            "forget" => win::run_forget(address).await,
            // Read-only forensics: safe to run any time, changes no bond state.
            "inspect" => win::run_inspect(address).await,
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
    use std::sync::atomic::Ordering;
    use windows::{
        core::{IInspectable, Ref},
        Devices::Bluetooth::{BluetoothAddressType, BluetoothLEDevice},
        Devices::Enumeration::{
            DeviceInformation, DeviceInformationCustomPairing, DeviceInformationPairing,
            DevicePairingKinds, DevicePairingRequestedEventArgs, DevicePairingResultStatus,
            DeviceUnpairingResultStatus,
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

    /// List every BLE device Windows currently considers paired. A stale bond
    /// here — especially one whose address differs from the one we are pairing —
    /// is the signature of the "half bond under a previous RPA" theory, and is
    /// exactly what makes the device un-scannable/un-connectable afterwards.
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

    pub async fn run_pair(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;

        dump_paired_inventory("before").await;

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

        let custom = pairing.Custom().map_err(we)?;

        // On ConfirmPinMatch, surface the pin for numeric comparison and auto-
        // accept (mirrors Suite; the user verifies it against the device screen).
        let handler = TypedEventHandler::<
            DeviceInformationCustomPairing,
            DevicePairingRequestedEventArgs,
        >::new(move |_sender, args: Ref<DevicePairingRequestedEventArgs>| {
            if let Ok(args) = args.ok() {
                let kind = args.PairingKind()?;
                diag(&format!("PairingRequested kind={kind:?}"));
                if kind == DevicePairingKinds::ConfirmPinMatch {
                    let pin = args.Pin()?;
                    super::emit(&format!(r#"{{"type":"pairing","pin":"{pin}"}}"#));
                    args.Accept()?;
                    ACCEPT_MS.store(t_ms(), Ordering::SeqCst);
                    diag("accepted ConfirmPinMatch (device confirmation now pending)");
                } else {
                    diag(&format!("unhandled pairing kind {kind:?}"));
                }
            }
            Ok(())
        });
        custom.PairingRequested(&handler).map_err(we)?;

        diag("calling PairAsync(ConfirmPinMatch)");
        let result = custom
            .PairAsync(DevicePairingKinds::ConfirmPinMatch)
            .map_err(we)?
            .await
            .map_err(we)?;

        let accepted_at = ACCEPT_MS.load(Ordering::SeqCst);
        let since_accept = if accepted_at == u64::MAX {
            "never-accepted".to_string()
        } else {
            format!("{}ms", t_ms().saturating_sub(accepted_at))
        };
        let status = result.Status().map_err(we)?;
        diag(&format!(
            "PairAsync returned status={status:?} sinceAccept={since_accept}"
        ));

        // State AFTER the ceremony but BEFORE our cleanup unpair — this is the
        // window in which "Failed but actually bonded" would be visible, and the
        // cleanup below would otherwise destroy the evidence.
        describe_device(&device, &pairing, "after");

        match status {
            DevicePairingResultStatus::Paired => {
                super::emit(r#"{"type":"paired"}"#);
                Ok(())
            }
            status => {
                // Best-effort cleanup: a failed ceremony can leave a half-bond
                // that makes the device un-scannable/un-connectable next time
                // (the "device disappears" dead-end). Unpair so the next attempt
                // starts clean. Ignore errors — we're already failing.
                diag(&format!("failed status {status:?}, unpairing to clean up"));
                if let Ok(op) = pairing.UnpairAsync() {
                    match op.await {
                        Ok(r) => diag(&format!(
                            "cleanup unpair status={:?}",
                            r.Status().unwrap_or(DeviceUnpairingResultStatus::Failed)
                        )),
                        Err(e) => diag(&format!("cleanup unpair error: {e}")),
                    }
                }
                dump_paired_inventory("after").await;
                Err(format!("pairing failed with status {status:?}"))
            }
        }
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
        dump_paired_inventory("forget-before").await;
        let (device, pairing) = open_pairing(addr).await?;
        describe_device(&device, &pairing, "forget-before");
        let result = pairing.UnpairAsync().map_err(we)?.await.map_err(we)?;
        let status = result.Status().map_err(we)?;
        diag(&format!("unpair status={status:?}"));
        dump_paired_inventory("forget-after").await;
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
}

/// Diagnostics go out as their own stdout JSON line (so the parent logs them
/// individually and they carry a monotonic timestamp — stderr chunks get merged
/// by the pipe and lose ordering), and are mirrored to stderr as a fallback.
#[cfg(windows)]
fn diag(message: &str) {
    let t = t_ms();
    emit(&format!(
        r#"{{"type":"diag","t_ms":{t},"msg":"{}"}}"#,
        json_escape(message)
    ));
    eprintln!("[pair +{t}ms] {message}");
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
