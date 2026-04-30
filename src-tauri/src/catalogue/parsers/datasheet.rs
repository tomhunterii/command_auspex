// Datasheet markdown parser — port of app/lib/datasheet-parser.js.
//
// Datasheets follow the repo convention: `# Name`, then `## Base`, `## Profile`,
// `## Ranged Weapons`, `## Melee Weapons`, etc. Frontmatter (YAML) is parsed
// separately by `frontmatter.rs`; this parser operates on the body and
// extracts the structured sections.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;

#[derive(Debug, Clone, Default, Serialize)]
pub struct Base {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diameter_mm: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length_mm: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width_mm: Option<f64>,
    pub flight_stem: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub per_model: Vec<PerModelBase>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PerModelBase {
    pub submodel: String,
    pub shape: String,
    pub diameter_mm: f64,
}

/// A profile-table value: either an integer (for keys like T, W, OC) or a
/// string (for keys like M ("5\""), Sv ("3+"), Ld ("6+"), InvSv ("4+")).
/// Stored unparsed in the JS version via the `parseInt` round-trip check.
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum ProfileValue {
    Int(i64),
    String(String),
}

#[derive(Debug, Clone, Default)]
pub struct Profile {
    pub entries: Vec<(String, ProfileValue)>, // preserves header order
}

impl Profile {
    pub fn get(&self, key: &str) -> Option<&ProfileValue> {
        self.entries.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }
    pub fn set(&mut self, key: impl Into<String>, value: ProfileValue) {
        let k = key.into();
        if let Some(slot) = self.entries.iter_mut().find(|(existing, _)| existing == &k) {
            slot.1 = value;
        } else {
            self.entries.push((k, value));
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Datasheet {
    pub name: Option<String>,
    pub base: Option<Base>,
    pub profile: Option<Profile>,
    pub ranges_in: Vec<i64>,
    pub max_range_in: Option<i64>,
}

// ── Section extraction ────────────────────────────────────────────────────

/// Find a `## Heading` section's body (text up to the next `## ` or EOF).
/// Mirrors the JS extractSection split-based approach.
pub fn extract_section<'a>(text: &'a str, heading: &str) -> Option<&'a str> {
    // Split on lines starting with `## ` (line-anchored). Then pick the part
    // that begins with the heading name + newline.
    static SPLIT_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)^## ").unwrap());
    // We need byte positions to slice without copy. Walk SPLIT_RE matches.
    let mut last_end = 0;
    let mut sections: Vec<(usize, usize)> = Vec::new(); // (body_start, body_end)
    let bytes = text.as_bytes();
    let total = bytes.len();
    for m in SPLIT_RE.find_iter(text) {
        let header_start = m.end();
        // Add the previous section span (if any) — body is from last_end to m.start()
        if last_end > 0 {
            sections.push((last_end, m.start()));
        }
        last_end = header_start;
    }
    if last_end > 0 {
        sections.push((last_end, total));
    }
    for (start, end) in sections {
        let slice = &text[start..end];
        // First line is the heading text (e.g. "Base"); body follows newline.
        let nl = slice.find('\n')?;
        let header = &slice[..nl];
        if header.trim() == heading {
            // Body trimmed both ends like JS's .trim()
            return Some(slice[nl + 1..].trim());
        }
    }
    None
}

// ── Base parser ───────────────────────────────────────────────────────────

static SHAPE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\*\*Shape:\*\*\s*(\S+)").unwrap());
static DIA_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\*\*Diameter:\*\*\s*([\d.]+)\s*mm").unwrap());
static DIM_RE: Lazy<Regex> = Lazy::new(|| {
    // Unicode × (U+00D7) OR ASCII x as the separator. The Rust regex crate
    // doesn't support \u{...}, but the literal × character works.
    Regex::new(r"(?i)\*\*Dimensions:\*\*\s*([\d.]+)\s*mm\s*[×x]\s*([\d.]+)\s*mm").unwrap()
});
static FLIGHT_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\*\*Flight stem:\*\*\s*(yes|no)").unwrap());
static PER_MODEL_MARKER_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\*\*Per-model bases:\*\*").unwrap());
static PER_MODEL_LINE_RE: Lazy<Regex> = Lazy::new(|| {
    // `  - <Submodel>: <shape>, <N>mm` — submodel may include spaces.
    Regex::new(r"(?i)^\s{2,}-\s+(.+?):\s+(\w+),\s+([\d.]+)\s*mm").unwrap()
});
static LEADING_INDENT_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\s{2,}").unwrap());

pub fn parse_base(body: &str) -> Base {
    let mut result = Base::default();

    if let Some(c) = SHAPE_RE.captures(body) {
        result.shape = Some(c[1].to_lowercase());
    }
    if let Some(c) = DIA_RE.captures(body) {
        if let Ok(v) = c[1].parse() {
            result.diameter_mm = Some(v);
        }
    }
    if let Some(c) = DIM_RE.captures(body) {
        result.length_mm = c[1].parse().ok();
        result.width_mm = c[2].parse().ok();
    }
    if let Some(c) = FLIGHT_RE.captures(body) {
        result.flight_stem = c[1].eq_ignore_ascii_case("yes");
    }

    // Per-model bases — only parse the bullet sublist if the marker line is
    // present. Without scoping, random `- foo` bullets elsewhere in the base
    // body would erroneously be captured.
    let lines: Vec<&str> = body.split('\n').collect();
    let marker_idx = lines.iter().position(|l| PER_MODEL_MARKER_RE.is_match(l));
    if let Some(idx) = marker_idx {
        for line in &lines[idx + 1..] {
            if line.trim().is_empty() {
                continue;
            }
            if !LEADING_INDENT_RE.is_match(line) {
                break; // end of sub-list, next top-level bullet
            }
            if let Some(c) = PER_MODEL_LINE_RE.captures(line) {
                let submodel = c[1].trim().to_string();
                let shape = c[2].to_lowercase();
                if let Ok(diameter_mm) = c[3].parse::<f64>() {
                    result.per_model.push(PerModelBase {
                        submodel,
                        shape,
                        diameter_mm,
                    });
                }
            }
        }
    }

    result
}

// ── Profile parser ────────────────────────────────────────────────────────

static INV_SAVE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\*\*Invulnerable Save:\*\*\s*(\d\+)").unwrap());

pub fn parse_profile(body: &str) -> Option<Profile> {
    let table_lines: Vec<&str> = body
        .lines()
        .map(|l| l.trim())
        .filter(|l| l.starts_with('|'))
        .collect();
    if table_lines.len() < 3 {
        return None;
    }
    let headers: Vec<&str> = table_lines[0]
        .split('|')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    let data: Vec<&str> = table_lines[2]
        .split('|')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    let mut profile = Profile::default();
    for (i, key) in headers.iter().enumerate() {
        let value = data.get(i).copied().unwrap_or("");
        // JS parseInt-vs-string trick: if parseInt(value,10) parses cleanly
        // AND String(n) === value, store as int; else store as string. This
        // preserves "5\"" as a string but stores "4" as the integer 4.
        let parsed: Option<i64> = value.parse().ok();
        let pv = match parsed {
            Some(n) if n.to_string() == value => ProfileValue::Int(n),
            _ => ProfileValue::String(value.to_string()),
        };
        profile.set((*key).to_string(), pv);
    }
    if let Some(c) = INV_SAVE_RE.captures(body) {
        profile.set("InvSv", ProfileValue::String(c[1].to_string()));
    }
    Some(profile)
}

// ── Range parser (used to populate ranges_in / max_range_in on the unit) ──

pub fn parse_ranges(body: &str) -> Vec<i64> {
    static NUMBER_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(\d+)").unwrap());
    let mut ranges: std::collections::BTreeSet<i64> = Default::default();
    for line in body.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('|') {
            continue;
        }
        if trimmed.contains("---") {
            continue;
        }
        if trimmed.to_lowercase().contains("weapon") {
            continue;
        }
        let cells: Vec<&str> = trimmed.split('|').map(|s| s.trim()).collect();
        if cells.len() < 3 {
            continue;
        }
        let range_cell = cells[2];
        for cap in NUMBER_RE.captures_iter(range_cell) {
            if let Ok(n) = cap[1].parse() {
                ranges.insert(n);
            }
        }
    }
    ranges.into_iter().collect()
}

// ── Top-level entrypoint ──────────────────────────────────────────────────

static FRONTMATTER_STRIP_RE: Lazy<Regex> = Lazy::new(|| {
    // Same pattern used by JS to strip frontmatter before title scan, so a
    // YAML `# comment` line can't be mistaken for the H1.
    Regex::new(r"(?s)\A---\r?\n.*?\r?\n---\r?\n?").unwrap()
});
static H1_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)^#\s+(.+)$").unwrap());

pub fn parse_datasheet(text: &str) -> Datasheet {
    let body_owned: String;
    let body: &str = if let Some(m) = FRONTMATTER_STRIP_RE.find(text) {
        body_owned = text[m.end()..].to_string();
        &body_owned
    } else {
        text
    };

    let name = H1_RE
        .captures(body)
        .map(|c| c[1].trim().to_string());

    let base = extract_section(body, "Base").map(parse_base);
    let profile = extract_section(body, "Profile").and_then(parse_profile);
    let ranged_section = extract_section(body, "Ranged Weapons").unwrap_or("");
    let ranges_in = parse_ranges(ranged_section);
    let max_range_in = ranges_in.last().copied();

    Datasheet {
        name,
        base,
        profile,
        ranges_in,
        max_range_in,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\nslug: foo\n---\n# Foo Squad\n\n## Base\n- **Shape:** round\n- **Diameter:** 32mm\n- **Flight stem:** no\n\n## Profile\n| M  | T | Sv | W | Ld | OC |\n|----|---|----|---|----|----|\n| 6\" | 4 | 3+ | 2 | 6+ | 2  |\n\n**Invulnerable Save:** 4+\n\n## Ranged Weapons\n| Weapon | A | Range | BS | S | AP | D |\n|--------|---|-------|----|---|----|---|\n| Foo gun | 4 | 24\" | 3+ | 4 | 0 | 1 |\n";

    #[test]
    fn parses_name_from_h1() {
        let ds = parse_datasheet(SAMPLE);
        assert_eq!(ds.name.as_deref(), Some("Foo Squad"));
    }

    #[test]
    fn parses_base() {
        let ds = parse_datasheet(SAMPLE);
        let b = ds.base.unwrap();
        assert_eq!(b.shape.as_deref(), Some("round"));
        assert_eq!(b.diameter_mm, Some(32.0));
        assert!(!b.flight_stem);
    }

    #[test]
    fn parses_profile_with_inv_save() {
        let ds = parse_datasheet(SAMPLE);
        let p = ds.profile.unwrap();
        assert!(matches!(p.get("T"), Some(ProfileValue::Int(4))));
        assert!(matches!(p.get("Sv"), Some(ProfileValue::String(s)) if s == "3+"));
        assert!(matches!(p.get("InvSv"), Some(ProfileValue::String(s)) if s == "4+"));
    }
}
