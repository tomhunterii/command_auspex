// Public surface for integration tests in src-tauri/tests/.
// The Tauri binary in src/main.rs declares its own `mod sync;` for
// runtime use; this lib re-exports the same module so external
// (cargo test --test ...) consumers can reach it.

pub mod sync;
