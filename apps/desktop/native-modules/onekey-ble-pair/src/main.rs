//! One-shot Windows BLE pairing helper for OneKey desktop.
//!
//! Why this exists: noble's WinRT backend never initiates OS BLE bonding, so a
//! Trezor Safe 7 (whose GATT is encryption-gated) fails at service discovery
//! with "Device is unreachable". This helper performs the WinRT
//! `DeviceInformationCustomPairing` ceremony (ConfirmPinMatch) BEFORE noble
//! connects, then exits. The Electron main process spawns it, reads the JSON
//! lines below from stdout, shows the pin for numeric comparison, and — once
//! "paired" — hands the (now bonded) device back to noble for GATT.
//!
//! It is a near-verbatim port of trezor-suite `transport-bluetooth`
//! `src/server/platform/windows.rs` `try_to_pair` (same `windows` crate).
//! Difference: Suite is a resident daemon that also does GATT via btleplug and
//! streams status over a socket; we only borrow the pairing step and exit, so
//! there is no channel/daemon — the PairingRequested handler writes straight to
//! stdout, and process teardown closes the device handle (no explicit Close).
//!
//! stdout protocol — one JSON object per line, flushed immediately:
//!   {"type":"pairing","pin":"123456"}      pin to compare with the device screen
//!   {"type":"paired"}                       OS bond established
//!   {"type":"already-paired"}               device was already bonded
//!   {"type":"is-paired","paired":true}      result of the `is-paired` command
//!   {"type":"unpaired"}                      `forget` succeeded
//!   {"type":"error","message":"..."}         failure (also non-zero exit)
//!
//! Usage: onekey-ble-pair <pair|is-paired|forget> --address AA:BB:CC:DD:EE:FF

#[cfg(windows)]
fn main() {
    // Multithreaded apartment so WinRT event delegates (PairingRequested) are
    // dispatched on thread-pool threads and fire while we block on
    // PairAsync().get(). Without this the handler never runs → Windows shows a
    // fallback dialog and pairing ends as Failed(19).
    unsafe {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("");
    let address = get_flag(&args, "--address");

    let result = match command {
        "pair" => run_pair(address),
        "is-paired" => run_is_paired(address),
        "forget" => run_forget(address),
        other => Err(format!("unknown command: '{other}'")),
    };

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
    /// handle. The device is returned so the caller keeps it alive for the
    /// duration of the (async) pairing call.
    fn open_pairing(addr: u64) -> Result<(BluetoothLEDevice, DeviceInformationPairing), String> {
        let device = BluetoothLEDevice::FromBluetoothAddressAsync(addr)
            .map_err(we)?
            .get()
            .map_err(we)?;
        let pairing = device
            .DeviceInformation()
            .map_err(we)?
            .Pairing()
            .map_err(we)?;
        Ok((device, pairing))
    }

    pub fn run_pair(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr)?;

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
            .get()
            .map_err(we)?;
        eprintln!("[pair] PairAsync returned");

        match result.Status().map_err(we)? {
            DevicePairingResultStatus::Paired => {
                super::emit(r#"{"type":"paired"}"#);
                Ok(())
            }
            status => Err(format!("pairing failed with status {status:?}")),
        }
    }

    pub fn run_is_paired(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr)?;
        let paired = pairing.IsPaired().map_err(we)?;
        super::emit(&format!(r#"{{"type":"is-paired","paired":{paired}}}"#));
        Ok(())
    }

    pub fn run_forget(address: Option<String>) -> Result<(), String> {
        let addr = super::require_address(address)?;
        let (_device, pairing) = open_pairing(addr)?;
        let result = pairing.UnpairAsync().map_err(we)?.get().map_err(we)?;
        match result.Status().map_err(we)? {
            DeviceUnpairingResultStatus::Unpaired | DeviceUnpairingResultStatus::AlreadyUnpaired => {
                super::emit(r#"{"type":"unpaired"}"#);
                Ok(())
            }
            status => Err(format!("unpair failed with status {status:?}")),
        }
    }
}

#[cfg(windows)]
use win::{run_forget, run_is_paired, run_pair};

// ----- shared helpers (Windows only; the stub main below needs none) -----

#[cfg(windows)]
fn emit(line: &str) {
    use std::io::Write;
    // Locked + flushed so the pin reaches the parent immediately: the process
    // then blocks in PairAsync, so an unflushed line would never be seen in time.
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

/// Parse a BLE address into the u64 that
/// `BluetoothLEDevice::FromBluetoothAddressAsync` expects (AA is the most
/// significant byte). Accepts "AA:BB:CC:DD:EE:FF", dash-separated, or the bare
/// "AABBCCDDEEFF" form — whichever noble hands us. NOTE: still confirm the
/// exact format/endianness against noble's `address` field on-device (the app
/// logs it); this is the most likely thing to need a tweak.
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
    // is disabled on Linux (platformEnv.isSupportDesktopBle). This stub keeps
    // the crate compiling for local dev on non-Windows hosts.
    eprintln!("onekey-ble-pair is only supported on Windows");
    std::process::exit(2);
}
