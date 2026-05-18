// On-launch datasheet sync against datasheets-40k on GitHub.
//
// Flow:
//   1. Fetch <base_url>/manifest.json (a JSON object: { files: { "<path>": "<sha256-hex>" } }).
//   2. For each file in the manifest, hash the local copy under <dst>.
//      If absent or hash differs, fetch <base_url>/<path> and write it.
//   3. Never propagate errors: any failure (offline, 5xx, parse error)
//      returns Ok(SyncReport { ..., errors: [...] }) — startup never blocks.

use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Deserialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Default)]
pub struct SyncReport {
    pub fetched: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

#[derive(Deserialize)]
struct Manifest {
    files: BTreeMap<String, String>,
}

const DEFAULT_BASE_URL: &str =
    "https://raw.githubusercontent.com/tomhunterii/datasheets-40k/main";

const TIMEOUT_SECS: u64 = 10;

pub fn sync_datasheets(dst: &Path) -> Result<SyncReport, Box<dyn std::error::Error>> {
    Ok(sync_datasheets_from(DEFAULT_BASE_URL, dst).unwrap_or_else(|e| SyncReport {
        fetched: 0,
        skipped: 0,
        errors: vec![format!("sync_datasheets_from: {}", e)],
    }))
}

pub fn sync_datasheets_from(
    base_url: &str,
    dst: &Path,
) -> Result<SyncReport, Box<dyn std::error::Error>> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build();

    let manifest_url = format!("{}/manifest.json", base_url.trim_end_matches('/'));
    let manifest_bytes = match fetch_bytes(&agent, &manifest_url) {
        Ok(b) => b,
        Err(e) => {
            return Ok(SyncReport {
                fetched: 0,
                skipped: 0,
                errors: vec![format!("manifest fetch failed: {}", e)],
            });
        }
    };

    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)?;

    let mut report = SyncReport::default();
    for (rel_path, expected_hash) in &manifest.files {
        if rel_path.contains("..") || rel_path.starts_with('/') {
            report.errors.push(format!("rejected unsafe path: {}", rel_path));
            continue;
        }
        let local: PathBuf = dst.join(rel_path);
        if local_hash_matches(&local, expected_hash) {
            report.skipped += 1;
            continue;
        }
        let file_url = format!("{}/{}", base_url.trim_end_matches('/'), rel_path);
        match fetch_bytes(&agent, &file_url) {
            Ok(bytes) => {
                if let Some(parent) = local.parent() {
                    if let Err(e) = fs::create_dir_all(parent) {
                        report.errors.push(format!("mkdir {}: {}", parent.display(), e));
                        continue;
                    }
                }
                if let Err(e) = fs::write(&local, &bytes) {
                    report.errors.push(format!("write {}: {}", local.display(), e));
                    continue;
                }
                report.fetched += 1;
            }
            Err(e) => {
                report.errors.push(format!("fetch {}: {}", file_url, e));
            }
        }
    }
    Ok(report)
}

fn fetch_bytes(agent: &ureq::Agent, url: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let resp = agent.get(url).call()?;
    let mut bytes = Vec::new();
    resp.into_reader().take(10 * 1024 * 1024).read_to_end(&mut bytes)?;
    Ok(bytes)
}

fn local_hash_matches(path: &Path, expected_hex: &str) -> bool {
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let mut h = Sha256::new();
    h.update(&bytes);
    let actual = format!("{:x}", h.finalize());
    actual == expected_hex
}
