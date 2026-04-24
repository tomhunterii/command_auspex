#!/usr/bin/env python3
"""
Parse a Games Workshop Companion App roster export into machine-readable
YAML frontmatter.

Usage:
    python3 scripts/parse_gw_roster.py <raw-export.txt> [-o <output.md>] [--datasheets <dir>]

Input:
    A .txt file containing the raw app export. Format:

        <List Name> (<N> Points)
        <Faction>
        <Subfaction>
        <Detachment>
        <Battle Size> (<Max> Points)

        SECTION HEADER (ALL CAPS)

        Unit Name (<N> Points)
          • Warlord                       (flag)
          • ENHANCEMENT: <name>           (flag)
          • Nx <submodel>                 (multi-model group with children)
             ◦ Nx <weapon>                (nested wargear under submodel)
          • Nx <weapon>                   (single-model wargear at top level)

        ...

        Exported with App Version: <ver>, Data Version: <ver>

Output:
    A .md file with YAML frontmatter (parsed structure) + empty body for
    optional strategic prose.

The parser attempts to resolve each unit to a datasheet slug by matching
against files in `datasheets/<faction>/units/<slug>.md`. Unresolved units
get `datasheet: null` and are listed in a `# UNRESOLVED` comment at the
top of the body for the Captain to fix.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


# ──────────────────────────────────────────────────────────────────────────
# DATA STRUCTURES
# ──────────────────────────────────────────────────────────────────────────

@dataclass
class Wargear:
    count: int
    item: str


@dataclass
class Submodel:
    submodel: str
    count: int
    wargear: list[Wargear] = field(default_factory=list)


@dataclass
class Unit:
    name: str
    datasheet: Optional[str]
    section: Optional[str]
    points: int
    warlord: bool = False
    enhancement: Optional[str] = None
    total_models: int = 0
    models: list[Submodel] = field(default_factory=list)


@dataclass
class Roster:
    list_name: str
    list_points: int
    faction: str
    subfaction: str
    detachment: str
    battle_size_name: str
    max_points: Optional[int]
    app_version: Optional[str]
    data_version: Optional[str]
    units: list[Unit] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────
# PARSING
# ──────────────────────────────────────────────────────────────────────────

SECTION_HEADERS = {
    'CHARACTERS', 'EPIC HEROES', 'BATTLELINE',
    'DEDICATED TRANSPORTS', 'OTHER DATASHEETS',
    'INFANTRY', 'VEHICLES', 'MONSTERS', 'WALKERS',
    'ALLIED UNITS', 'FORTIFICATIONS', 'SWARMS',
}

UNIT_HEADER_RE = re.compile(r'^(.+?) \(([\d,]+) Points\)$')
TOP_BULLET_RE = re.compile(r'^  • (.+?)\s*$')
NESTED_BULLET_RE = re.compile(r'^\s{5}◦ (.+?)\s*$')
NX_ITEM_RE = re.compile(r'^(\d+)x (.+)$')
EXPORT_FOOTER_RE = re.compile(
    r'^Exported with App Version:\s*(.+?),\s*Data Version:\s*(.+?)\s*$'
)


def is_section_header(line: str) -> bool:
    s = line.strip()
    if not s or len(s) < 2:
        return False
    if s in SECTION_HEADERS:
        return True
    # Generic fallback: all uppercase letters and spaces, no digits/punct
    return bool(re.fullmatch(r'[A-Z ]+', s)) and any(c.isalpha() for c in s)


def parse_roster(text: str) -> Roster:
    lines = text.splitlines()
    i = 0

    # Skip leading blanks
    while i < len(lines) and not lines[i].strip():
        i += 1

    if i >= len(lines):
        raise ValueError('Empty export')

    # ─── Header block ──────────────────────────────────
    header = lines[i].strip()
    m = UNIT_HEADER_RE.match(header)
    if not m:
        raise ValueError(
            f"Expected list header '<name> (<N> Points)' at line {i+1}, got: {header!r}"
        )
    list_name = m.group(1)
    list_points = int(m.group(2).replace(',', ''))
    i += 1

    def next_nonblank() -> str:
        nonlocal i
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            raise ValueError('Unexpected end of input in header block')
        v = lines[i].strip()
        i += 1
        return v

    faction = next_nonblank()
    subfaction = next_nonblank()
    detachment = next_nonblank()

    battle_size_line = next_nonblank()
    bs_match = UNIT_HEADER_RE.match(battle_size_line)
    if bs_match:
        battle_size_name = bs_match.group(1)
        max_points = int(bs_match.group(2).replace(',', ''))
    else:
        battle_size_name = battle_size_line
        max_points = None

    # ─── Body: sections and units ─────────────────────
    units: list[Unit] = []
    current_section: Optional[str] = None
    app_version: Optional[str] = None
    data_version: Optional[str] = None

    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        if not stripped:
            i += 1
            continue

        # Footer
        fm = EXPORT_FOOTER_RE.match(stripped)
        if fm:
            app_version = fm.group(1).strip()
            data_version = fm.group(2).strip()
            break

        # Section header
        if is_section_header(raw):
            current_section = stripped
            i += 1
            continue

        # Unit header: "<name> (<N> Points)"
        um = UNIT_HEADER_RE.match(stripped)
        if um and not raw.startswith('  '):  # top-level, not a bullet
            unit_block = [raw]
            i += 1
            # Collect following bullet lines until next unit header, section, or footer
            while i < len(lines):
                nxt = lines[i]
                nxt_s = nxt.strip()
                if not nxt_s:
                    i += 1
                    continue
                if nxt.startswith('  •') or nxt.startswith('     ◦'):
                    unit_block.append(nxt)
                    i += 1
                    continue
                # Non-bullet, non-blank → end of unit
                break
            units.append(_parse_unit(unit_block, current_section))
        else:
            # Unknown non-blank line — skip
            i += 1

    return Roster(
        list_name=list_name,
        list_points=list_points,
        faction=faction,
        subfaction=subfaction,
        detachment=detachment,
        battle_size_name=battle_size_name,
        max_points=max_points,
        app_version=app_version,
        data_version=data_version,
        units=units,
    )


def _parse_unit(block: list[str], section: Optional[str]) -> Unit:
    """Parse a single unit block. block[0] is the unit header."""
    header = block[0].strip()
    m = UNIT_HEADER_RE.match(header)
    name = m.group(1)
    points = int(m.group(2).replace(',', ''))

    # Two-pass: first group top-level bullets with their nested children
    entries: list[dict] = []
    current_top: Optional[dict] = None

    for raw in block[1:]:
        tm = TOP_BULLET_RE.match(raw)
        nm = NESTED_BULLET_RE.match(raw)
        if tm:
            current_top = {'content': tm.group(1).strip(), 'children': []}
            entries.append(current_top)
        elif nm and current_top is not None:
            current_top['children'].append(nm.group(1).strip())

    warlord = False
    enhancement: Optional[str] = None
    models: list[Submodel] = []
    flat_wargear: list[Wargear] = []

    for entry in entries:
        content = entry['content']

        if content == 'Warlord':
            warlord = True
            continue
        # Match both "Enhancement:" (singular) and "Enhancements:" (plural — how the
        # GW Companion App actually emits it). Match is case-insensitive.
        m_enh = re.match(r'^enhancements?:\s*(.+)$', content, re.IGNORECASE)
        if m_enh:
            enhancement = m_enh.group(1).strip()
            continue

        nx = NX_ITEM_RE.match(content)

        if entry['children']:
            # Submodel group with nested wargear
            if nx:
                count = int(nx.group(1))
                submodel_name = nx.group(2)
            else:
                count = 1
                submodel_name = content
            wargear: list[Wargear] = []
            for child in entry['children']:
                cnx = NX_ITEM_RE.match(child)
                if cnx:
                    wargear.append(Wargear(count=int(cnx.group(1)), item=cnx.group(2)))
                else:
                    wargear.append(Wargear(count=1, item=child))
            models.append(Submodel(submodel=submodel_name, count=count, wargear=wargear))
        else:
            # Flat wargear (no children) — single-model unit's top-level wargear
            if nx:
                flat_wargear.append(Wargear(count=int(nx.group(1)), item=nx.group(2)))
            else:
                flat_wargear.append(Wargear(count=1, item=content))

    # If no submodels built but flat wargear present → it's a single-model unit
    if not models and flat_wargear:
        models = [Submodel(submodel=name, count=1, wargear=flat_wargear)]

    total_models = sum(m.count for m in models)

    return Unit(
        name=name,
        datasheet=None,           # filled by resolve_datasheet_slug later
        section=section,
        points=points,
        warlord=warlord,
        enhancement=enhancement,
        total_models=total_models,
        models=models,
    )


# ──────────────────────────────────────────────────────────────────────────
# DATASHEET RESOLUTION
# ──────────────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r'[^\w]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')


def resolve_datasheet_slug(unit_name: str, datasheets_dir: Path) -> Optional[str]:
    """
    Try to match unit_name to a datasheet file.
    Returns '<faction>/<slug>' if found (e.g., 'space-marines/aggressor-squad'),
    else None.
    """
    if not datasheets_dir.exists():
        return None

    candidates = [slugify(unit_name)]

    # Also try stripping trailing " Squad" if the filename omits it (rare)
    # e.g., "Aggressor Squad" → "aggressor-squad" AND "aggressor"
    simple = slugify(unit_name)
    if simple.endswith('-squad'):
        candidates.append(simple[:-len('-squad')])

    for faction_dir in datasheets_dir.iterdir():
        if not faction_dir.is_dir():
            continue
        units_dir = faction_dir / 'units'
        if not units_dir.exists():
            continue
        for cand in candidates:
            target = units_dir / f'{cand}.md'
            if target.exists():
                return f'{faction_dir.name}/{cand}'

    return None


def resolve_all(roster: Roster, datasheets_dir: Path) -> None:
    for unit in roster.units:
        unit.datasheet = resolve_datasheet_slug(unit.name, datasheets_dir)
        if unit.datasheet is None:
            roster.unresolved.append(unit.name)


# ──────────────────────────────────────────────────────────────────────────
# YAML EMISSION
# ──────────────────────────────────────────────────────────────────────────

def _yaml_str(s: str) -> str:
    """Quote a string for YAML — always use double quotes for safety."""
    if s is None:
        return 'null'
    escaped = s.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{escaped}"'


def _yaml_scalar(v) -> str:
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, int):
        return str(v)
    return _yaml_str(str(v))


def emit_yaml(roster: Roster) -> str:
    """Emit the roster as a YAML frontmatter block (between --- markers)."""
    out: list[str] = []
    out.append('---')
    out.append(f'list_name: {_yaml_str(roster.list_name)}')
    out.append(f'list_points: {roster.list_points}')
    out.append(f'faction: {_yaml_str(roster.faction)}')
    out.append(f'subfaction: {_yaml_str(roster.subfaction)}')
    out.append(f'detachment: {_yaml_str(roster.detachment)}')
    out.append('battle_size:')
    out.append(f'  name: {_yaml_str(roster.battle_size_name)}')
    out.append(f'  max_points: {_yaml_scalar(roster.max_points)}')
    out.append('export:')
    out.append(f'  app_version: {_yaml_scalar(roster.app_version)}')
    out.append(f'  data_version: {_yaml_scalar(roster.data_version)}')
    out.append('')
    out.append('units:')
    for u in roster.units:
        out.append(f'  - name: {_yaml_str(u.name)}')
        out.append(f'    datasheet: {_yaml_scalar(u.datasheet)}')
        out.append(f'    section: {_yaml_str(u.section) if u.section else "null"}')
        out.append(f'    points: {u.points}')
        out.append(f'    warlord: {_yaml_scalar(u.warlord)}')
        out.append(f'    enhancement: {_yaml_scalar(u.enhancement)}')
        out.append(f'    total_models: {u.total_models}')
        out.append('    models:')
        for s in u.models:
            out.append(f'      - submodel: {_yaml_str(s.submodel)}')
            out.append(f'        count: {s.count}')
            out.append('        wargear:')
            for w in s.wargear:
                out.append(f'          - {{ count: {w.count}, item: {_yaml_str(w.item)} }}')
    out.append('---')
    return '\n'.join(out)


def emit_markdown(roster: Roster, raw_filename: str) -> str:
    """Emit the full .md file: frontmatter + body."""
    yaml_block = emit_yaml(roster)

    body_parts = [yaml_block, '']

    body_parts.append(f'# {roster.list_name}')
    body_parts.append('')
    body_parts.append(
        f'**Battle size:** {roster.battle_size_name} '
        f'({roster.max_points} pts max · {roster.list_points} pts used)  '
    )
    body_parts.append(f'**Faction:** {roster.faction} / {roster.subfaction}  ')
    body_parts.append(f'**Detachment:** {roster.detachment}')
    body_parts.append('')

    if roster.unresolved:
        body_parts.append('## Unresolved Datasheet References')
        body_parts.append('')
        body_parts.append(
            'The parser could not auto-resolve these unit names to a datasheet file. '
            'Manually set the `datasheet:` field in the frontmatter for each:'
        )
        body_parts.append('')
        for u in roster.unresolved:
            body_parts.append(f'- `{u}`')
        body_parts.append('')

    body_parts.append('## Raw Export')
    body_parts.append('')
    body_parts.append(f'Source: `{raw_filename}`')
    body_parts.append('')
    body_parts.append('## Strategic Notes')
    body_parts.append('')
    body_parts.append('_Freeform prose — turn priorities, target assignments, '
                     'stratagem economy, paint status, caveats._')
    body_parts.append('')

    return '\n'.join(body_parts)


# ──────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────

def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description='Parse GW Companion App roster export.')
    ap.add_argument('input', type=Path, help='Path to raw export .txt file')
    ap.add_argument(
        '-o', '--output', type=Path, default=None,
        help='Output .md file (default: same name as input, .md extension)',
    )
    ap.add_argument(
        '--datasheets', type=Path,
        default=Path(__file__).parent.parent / 'datasheets',
        help='Path to datasheets/ directory (for resolving unit slugs)',
    )
    ap.add_argument(
        '--stdout', action='store_true',
        help='Print output to stdout instead of writing a file',
    )
    args = ap.parse_args(argv)

    raw = args.input.read_text(encoding='utf-8')
    roster = parse_roster(raw)
    resolve_all(roster, args.datasheets)

    md = emit_markdown(roster, args.input.name)

    if args.stdout:
        sys.stdout.write(md)
    else:
        out_path = args.output or args.input.with_suffix('.md')
        out_path.write_text(md, encoding='utf-8')
        print(f'Wrote: {out_path}')
        print(f'Parsed: {len(roster.units)} units, '
              f'{sum(u.total_models for u in roster.units)} total models, '
              f'{roster.list_points} pts')
        if roster.unresolved:
            print(f'Unresolved: {len(roster.unresolved)} units — see `Unresolved Datasheet References` '
                  f'section of the output.')
            for u in roster.unresolved:
                print(f'  - {u}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
