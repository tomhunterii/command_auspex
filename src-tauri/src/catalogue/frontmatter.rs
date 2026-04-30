// Frontmatter extractor + YAML parser. Port of app/lib/yaml-frontmatter.js.
//
// Matches the JS regex /^---\r?\n(.*?)\r?\n---(?:\r?\n|$)/s — line-anchored
// `---` so markdown table separators inside the body don't false-positive.
//
// Returns the parsed YAML as serde_yaml::Value (untyped) so downstream
// code can do `fm["keywords"]["faction"]`-style walks the same way the JS
// does. We deliberately do NOT define typed Frontmatter structs — datasheet
// frontmatter, mission frontmatter, and roster frontmatter have different
// shapes and the JS loose-typing is part of the contract.

use once_cell::sync::Lazy;
use regex::Regex;
use serde_yaml::Value;

static FRONTMATTER_RE: Lazy<Regex> = Lazy::new(|| {
    // (?s) = dotall — `.` matches newlines so the body capture spans lines.
    // Line-anchored opening `---`, line-anchored closing `---`, optional
    // trailing newline (matches EOF too via `$` thanks to multi-line mode
    // — except `(?s)` doesn't enable multi-line, so we use `\A` for start
    // and accept that the regex won't match if `---` isn't at byte 0).
    // The JS version uses /^---\r?\n.../ with the s-flag and no m-flag,
    // which means `^` is start-of-string. Same here via `\A`.
    Regex::new(r"(?s)\A---\r?\n(.*?)\r?\n---(?:\r?\n|\z)").unwrap()
});

/// Extract the raw YAML body (without delimiters) from a markdown file.
/// Returns None if the file does not start with a frontmatter block.
pub fn extract_frontmatter(text: &str) -> Option<&str> {
    FRONTMATTER_RE
        .captures(text)
        .and_then(|c| c.get(1).map(|m| m.as_str()))
}

/// Extract + parse. Returns Ok(None) when there's no frontmatter at all,
/// Ok(Some(value)) when parse succeeds, Err when YAML is malformed.
pub fn parse_frontmatter(text: &str) -> Result<Option<Value>, serde_yaml::Error> {
    match extract_frontmatter(text) {
        None => Ok(None),
        Some(yaml_text) => {
            // serde_yaml::from_str returns Value::Null for empty input;
            // upstream callers expect None in that case for parity with
            // js-yaml's `null` return.
            let v: Value = serde_yaml::from_str(yaml_text)?;
            Ok(Some(v))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_returns_none_when_no_frontmatter() {
        assert!(extract_frontmatter("# Title\n\nbody").is_none());
    }

    #[test]
    fn extract_returns_yaml_body_for_standard_file() {
        let md = "---\nslug: foo\nname: Foo\n---\n# Title\nbody";
        assert_eq!(extract_frontmatter(md), Some("slug: foo\nname: Foo"));
    }

    #[test]
    fn extract_handles_dashes_inside_body() {
        // Markdown table separators (---|---) must NOT be treated as
        // frontmatter terminators. This is the regression-defining case
        // that motivated the line-anchored regex.
        let md = "---\nslug: foo\n---\n# Title\n| col |\n|---|\n| val |\n";
        assert_eq!(extract_frontmatter(md), Some("slug: foo"));
    }

    #[test]
    fn parse_returns_value_tree() {
        let md = "---\nslug: foo\ncount: 7\n---\nbody";
        let v = parse_frontmatter(md).unwrap().unwrap();
        assert_eq!(v["slug"].as_str(), Some("foo"));
        assert_eq!(v["count"].as_u64(), Some(7));
    }

    #[test]
    fn parse_returns_none_when_no_frontmatter() {
        let result = parse_frontmatter("plain markdown").unwrap();
        assert!(result.is_none());
    }
}
