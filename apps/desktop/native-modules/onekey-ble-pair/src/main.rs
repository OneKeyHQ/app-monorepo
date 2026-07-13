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
//! `PairingRequested` delegate, so our auto-accept never ran, Windows showed
//! its own dialog, and pairing ended as Failed(19). We also init a
//! multithreaded apartment so the delegate is dispatched on a pool thread.
//!
//! stdout protocol — one JSON object per line, flushed immediately:
//!   {"type":"pairing","pin":"123456"}      pin to compare with the device screen
//!   {"type":"paired"} / {"type":"already-paired"}
//!   {"type":"is-paired","paired":true}
//!   {"type":"unpaired"}
//!   {"type":"error","message":"..."}         (also non-zero exit)
//!
//! Usage: onekey-ble-pair <pair|is-paired|forget> --address AA:BB:CC:DD:EE:FF

#[cfg(windows)]
fn main() {
    // Multithreaded apartment so WinRT event delegates (PairingRequested) are
    // dispatched on thread-pool threads while we wait for PairAsync.
    unsafe {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("");
    let address = get_flag(&args, "--address");

    let result = pollster::block_on(async {
        match command {
            "pair" => win::run_pair(address).await,
            "is-paired" => win::run_is_paired(address).await,
            "forget" => win::run_forget(address).await,
            other => Err(format!("unknown command: '{other}'")),
        }
    });

    if let Err(message) = result {
        emit_error(&message);
        std::process::exit(1);
    }
}

#[cfg(windows)]
mod win {
    use windows::{
        core::Ref,
        Devices::Bluetooth::BluetoothLEDevice,
        Devices::Enumeration::{
            DeviceInformationCustomPairing, DeviceInformationPairing, DevicePairingKinds,
            DevicePairingRequestedEventArgs, DevicePairingResultStatus,
            DeviceUnpairingResultStatus,
        },
        Foundation::TypedEventHandler,
    };

    fn we(e: windows::core::Error) -> String {
        e.to_string()
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

    pub async fn run_pair(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr).await?;

        if pairing.IsPaired().map_err(we)? {
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
                eprintln!("[pair] PairingRequested kind={kind:?}");
                if kind == DevicePairingKinds::ConfirmPinMatch {
                    let pin = args.Pin()?;
                    super::emit(&format!(r#"{{"type":"pairing","pin":"{pin}"}}"#));
                    args.Accept()?;
                    eprintln!("[pair] accepted ConfirmPinMatch");
                } else {
                    eprintln!("[pair] unhandled pairing kind {kind:?}");
                }
            }
            Ok(())
        });
        custom.PairingRequested(&handler).map_err(we)?;

        eprintln!("[pair] calling PairAsync(ConfirmPinMatch)");
        let result = custom
            .PairAsync(DevicePairingKinds::ConfirmPinMatch)
            .map_err(we)?
            .await
            .map_err(we)?;
        eprintln!("[pair] PairAsync returned");

        match result.Status().map_err(we)? {
            DevicePairingResultStatus::Paired => {
                super::emit(r#"{"type":"paired"}"#);
                Ok(())
            }
            status => {
                // Best-effort cleanup: a failed ceremony can leave a half-bond
                // that makes the device un-scannable/un-connectable next time
                // (the "device disappears" dead-end). Unpair so the next attempt
                // starts clean. Ignore errors — we're already failing.
                eprintln!("[pair] failed status {status:?}, unpairing to clean up");
                if let Ok(op) = pairing.UnpairAsync() {
                    let _ = op.await;
                }
                Err(format!("pairing failed with status {status:?}"))
            }
        }
    }

    pub async fn run_is_paired(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr).await?;
        let paired = pairing.IsPaired().map_err(we)?;
        super::emit(&format!(r#"{{"type":"is-paired","paired":{paired}}}"#));
        Ok(())
    }

    pub async fn run_forget(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr).await?;
        let result = pairing.UnpairAsync().map_err(we)?.await.map_err(we)?;
        match result.Status().map_err(we)? {
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
