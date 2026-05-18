// Integration test for the sync module: spin up a local HTTP server
// that serves a manifest and a few markdown files, point the sync
// module at it, and verify the files land in the destination dir
// with the right content.

use std::fs;
use std::sync::Arc;
use std::thread;
use tempfile::TempDir;
use tiny_http::{Response, Server};

use command_auspex::sync::sync_datasheets_from;

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

fn start_server(routes: Vec<(&'static str, Vec<u8>)>) -> (String, thread::JoinHandle<()>) {
    let server = Arc::new(Server::http("127.0.0.1:0").unwrap());
    let url = format!("http://{}", server.server_addr());
    let s2 = server.clone();
    let h = thread::spawn(move || {
        for req in s2.incoming_requests() {
            let url = req.url().to_string();
            let mut matched: Option<Vec<u8>> = None;
            for (route, body) in &routes {
                if url == *route {
                    matched = Some(body.clone());
                    break;
                }
            }
            let resp = match matched {
                Some(body) => Response::from_data(body),
                None => Response::from_string("not found").with_status_code(404),
            };
            let _ = req.respond(resp);
        }
    });
    (url, h)
}

#[test]
fn sync_fetches_new_files_when_manifest_differs_from_local() {
    let dst = TempDir::new().unwrap();

    let unit_md = b"# Test Unit\n\n## Profile\n\n| M | T | Sv | W | Ld | OC |\n|---|---|---|---|---|---|\n| 6\" | 4 | 3+ | 2 | 6+ | 2 |\n";
    let unit_hash = sha256_hex(unit_md);

    let manifest = format!(
        r#"{{"generated":"2026-05-18T00:00:00Z","files":{{"space-marines/units/test-unit.md":"{}"}}}}"#,
        unit_hash
    );

    let (base_url, _handle) = start_server(vec![
        ("/manifest.json", manifest.into_bytes()),
        ("/space-marines/units/test-unit.md", unit_md.to_vec()),
    ]);

    sync_datasheets_from(&base_url, dst.path()).expect("sync should succeed");

    let written = dst.path().join("space-marines/units/test-unit.md");
    assert!(written.exists(), "file should have been written");
    assert_eq!(fs::read(&written).unwrap(), unit_md);
}

#[test]
fn sync_skips_files_whose_local_hash_matches_manifest() {
    let dst = TempDir::new().unwrap();
    let unit_md = b"# Already Current\n";
    let unit_hash = sha256_hex(unit_md);
    let path = dst.path().join("space-marines/units/already-current.md");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, unit_md).unwrap();

    let manifest = format!(
        r#"{{"generated":"2026-05-18T00:00:00Z","files":{{"space-marines/units/already-current.md":"{}"}}}}"#,
        unit_hash
    );

    // Note: NO route for the unit file — if sync tried to fetch it,
    // it would get 404 and the test would fail.
    let (base_url, _handle) = start_server(vec![
        ("/manifest.json", manifest.into_bytes()),
    ]);

    let result = sync_datasheets_from(&base_url, dst.path()).expect("sync should succeed");
    assert_eq!(result.fetched, 0);
    assert_eq!(result.skipped, 1);
}

#[test]
fn sync_returns_ok_when_manifest_fetch_fails() {
    let dst = TempDir::new().unwrap();
    // Point at an unreachable URL.
    let result = sync_datasheets_from("http://127.0.0.1:1", dst.path());
    assert!(result.is_ok(), "sync must never propagate network errors");
}
