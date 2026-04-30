// CLI entrypoint that builds the catalogue from a given input dir without
// the Tauri runtime. Used by:
//   * CI to diff against the JS builder's output
//   * `cargo test` integration tests
//   * Manual debugging during the JS → Rust migration
//
// Usage:
//   catalogue-build <source-root> <out-db-path>
//
// <source-root> must contain `datasheets/` and `missions/` subdirectories
// with the same layout the JS builder expects.

use std::path::PathBuf;
use std::process::ExitCode;

// Pull in the catalogue module from the binary crate. We can't `use
// command_auspex::catalogue` because main.rs isn't a library crate today;
// instead we re-include the module tree directly. Keep this file thin so
// the duplication stays trivial.
#[path = "../catalogue/mod.rs"]
mod catalogue;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: {} <source-root> <out-db-path>", args[0]);
        return ExitCode::from(64);
    }
    let source_root = PathBuf::from(&args[1]);
    let db_path = PathBuf::from(&args[2]);
    match catalogue::build_catalogue(&source_root, &db_path) {
        Ok(result) => {
            println!(
                "catalogue.db built: {} units ({} enriched), {} missions → {}",
                result.unit_count,
                result.enriched_count,
                result.mission_count,
                db_path.display(),
            );
            if !result.warnings.is_empty() {
                eprintln!("warnings ({}):", result.warnings.len());
                for w in &result.warnings {
                    eprintln!("  [{}] {} — {}", w.kind, w.source_path, w.message);
                }
            }
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("catalogue build failed: {e}");
            ExitCode::FAILURE
        }
    }
}
