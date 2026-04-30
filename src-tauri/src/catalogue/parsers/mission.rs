// Mission markdown parser — port of processMission() from
// scripts/build-catalogue.js. Missions store the full body_md + the parsed
// frontmatter JSON for runtime rendering; structured fields aren't extracted
// at the catalogue level (the JS UI walks the frontmatter directly).

use once_cell::sync::Lazy;
use regex::Regex;
use serde_yaml::Value;

#[derive(Debug, Clone)]
pub struct Mission {
    pub slug: String,
    pub name: String,
    pub body_md: String,
    pub frontmatter_json: Option<String>,
}

static H1_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)^#\s+(.+)$").unwrap());

pub fn parse_mission(
    text: &str,
    fallback_slug: &str,
    frontmatter: Option<&Value>,
) -> Result<Mission, serde_json::Error> {
    let slug = frontmatter
        .and_then(|fm| fm.get("slug").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback_slug.to_string());

    let title_match = H1_RE.captures(text).map(|c| c[1].trim().to_string());
    let name = frontmatter
        .and_then(|fm| fm.get("name").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .or(title_match)
        .unwrap_or_else(|| slug.clone());

    let frontmatter_json = match frontmatter {
        Some(v) => Some(serialize_yaml_value(v)?),
        None => None,
    };

    Ok(Mission {
        slug,
        name,
        body_md: text.to_string(),
        frontmatter_json,
    })
}

/// Serialize a serde_yaml::Value to a JSON string. Matches what the JS
/// builder writes for frontmatter_json (JSON.stringify of the parsed YAML).
/// Object keys are sorted to make the output deterministic for CI diffing.
pub fn serialize_yaml_value(v: &Value) -> Result<String, serde_json::Error> {
    let json = yaml_value_to_json(v);
    serde_json::to_string(&json)
}

/// Recursively translate serde_yaml::Value into serde_json::Value with
/// deterministic key ordering. Matches js-yaml round-trip semantics:
/// integers stay integers, floats stay floats, strings stay strings.
pub fn yaml_value_to_json(v: &Value) -> serde_json::Value {
    match v {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_json::Value::Number(i.into())
            } else if let Some(u) = n.as_u64() {
                serde_json::Value::Number(u.into())
            } else if let Some(f) = n.as_f64() {
                serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            } else {
                serde_json::Value::Null
            }
        }
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Sequence(seq) => {
            serde_json::Value::Array(seq.iter().map(yaml_value_to_json).collect())
        }
        Value::Mapping(m) => {
            // Sort keys for deterministic output. JS Object.entries iteration
            // order is insertion order — but for our diff-vs-rust test we
            // want byte-stable output, so we sort. The JS builder will need
            // a matching sort applied at JSON.stringify time during the
            // migration window (see scripts/build-catalogue.js update).
            let mut entries: Vec<(String, &Value)> = m
                .iter()
                .filter_map(|(k, val)| k.as_str().map(|s| (s.to_string(), val)))
                .collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            let mut map = serde_json::Map::with_capacity(entries.len());
            for (k, val) in entries {
                map.insert(k, yaml_value_to_json(val));
            }
            serde_json::Value::Object(map)
        }
        Value::Tagged(tagged) => yaml_value_to_json(&tagged.value),
    }
}
