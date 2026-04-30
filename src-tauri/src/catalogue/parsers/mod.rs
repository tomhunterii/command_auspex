// Parsers for catalogue source files. One module per content type so
// individual parsers can be unit-tested without spinning up a full DB.

pub mod datasheet;
pub mod mission;
pub mod weapons;
