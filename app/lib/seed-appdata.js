// app/lib/seed-appdata.js
//
// First-launch one-time copy from the bundled Resource directory into the
// user's AppData directory. After seeding, AppData is the working "repo"
// the app reads and writes through Tauri filesystem APIs.
//
// Driver-injected so the logic is pure-JS testable without a Tauri runtime.
// Production wires `resource` to a driver over BaseDirectory.Resource and
// `appdata` to a driver over BaseDirectory.AppData.

const SEED_MARKER = '.seeded';

async function copyTree(src, dst, srcPath) {
  let copied = 0;
  if (!(await src.exists(srcPath))) return 0;
  const entries = await src.readDir(srcPath);
  for (const entry of entries) {
    const childSrc = srcPath === '' ? entry.name : `${srcPath}/${entry.name}`;
    if (entry.isDirectory) {
      await dst.mkdir(childSrc);
      copied += await copyTree(src, dst, childSrc);
    } else {
      const text = await src.readTextFile(childSrc);
      await dst.writeTextFile(childSrc, text);
      copied += 1;
    }
  }
  return copied;
}

export async function seedIfNeeded({ resource, appdata, seedRoots }) {
  const alreadySeeded = await appdata.exists(SEED_MARKER);
  if (alreadySeeded) return { copied: 0, alreadySeeded: true };

  let copied = 0;
  for (const root of seedRoots) {
    copied += await copyTree(resource, appdata, root);
  }
  await appdata.writeTextFile(SEED_MARKER, new Date().toISOString());
  return { copied, alreadySeeded: false };
}
