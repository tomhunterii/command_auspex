// Filesystem walking helpers — replacements for `listMarkdownFiles` and
// `listSubdirs` from scripts/build-catalogue.js. Returns missing dirs as
// empty vecs (matches JS's `if (!existsSync(dir)) return []`).

use std::path::{Path, PathBuf};

/// Return every `*.md` file directly under `dir` (NOT recursive).
/// Missing dir returns an empty vec.
pub fn list_markdown_files(dir: &Path) -> Vec<PathBuf> {
    if !dir.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            out.push(path);
        }
    }
    // Sort for determinism — file system iteration order is platform-
    // dependent and the JS `readdirSync` is alphabetical on macOS but not
    // guaranteed elsewhere. Sorted output makes the JS-vs-Rust diff stable.
    out.sort();
    out
}

/// Return every immediate subdirectory of `dir`. Missing dir returns empty.
pub fn list_subdirs(dir: &Path) -> Vec<PathBuf> {
    if !dir.exists() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            out.push(path);
        }
    }
    out.sort();
    out
}

/// Strip `<base>/` prefix and convert separators so source_path values
/// are stable on Windows too (always forward slashes, matching the JS
/// builder's path.replace(REPO + '/', '')).
pub fn relative_source_path(base: &Path, full: &Path) -> String {
    let stripped = full.strip_prefix(base).unwrap_or(full);
    stripped
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

/// Slug-from-path: filename minus `.md` extension. Mirrors slugFromPath().
pub fn slug_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string()
}
