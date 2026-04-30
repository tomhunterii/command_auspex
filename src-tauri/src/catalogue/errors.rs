// Catalogue build errors. Two tiers:
//
//   * CatalogueError — hard failures that abort the build (DB open, schema
//     apply, missing required tables). Bubbles up to the caller.
//   * ParseWarning — per-file failures that accumulate and don't block the
//     build. Mirrors the JS builder's "log and skip" behavior so a single
//     malformed datasheet can't take down startup.

use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CatalogueError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("yaml error in {path:?}: {source}")]
    Yaml {
        path: PathBuf,
        #[source]
        source: serde_yaml::Error,
    },

    #[error("json serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("{0}")]
    #[allow(dead_code)] // reserved for future single-entity reparse paths
    Other(String),
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ParseWarning {
    pub source_path: String,
    pub kind: String,
    pub message: String,
}

impl ParseWarning {
    pub fn new(source_path: impl Into<String>, kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            source_path: source_path.into(),
            kind: kind.into(),
            message: message.into(),
        }
    }
}
