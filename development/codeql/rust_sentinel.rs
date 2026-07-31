// This maintenance branch predates the repository's production Rust sources,
// while the repository-wide CodeQL default setup still scans Rust. Keep one
// analyzable source file so CodeQL can initialize its Rust database without
// affecting any product build.
#[allow(dead_code)]
fn codeql_rust_sentinel() {}
