// app/lib/tauri-fs-shim.js
//
// Duck-types the File System Access API surface that app/lib/fs.js consumes,
// backed by a path-based filesystem driver (the production driver wraps
// @tauri-apps/plugin-fs; tests inject an in-memory driver).
//
// Why a shim and not a rewrite of fs.js: every existing call site already takes
// a (root, path) pair. The only thing that differs between FSA and Tauri is the
// `root` object. Producing an FSA-shaped object over Tauri keeps fs.js, all
// parsers, all tests, and command-auspex.html unchanged.

function notFound() {
  const err = new Error('not found');
  err.name = 'NotFoundError';
  return err;
}

function joinPath(parent, name) {
  return parent === '' ? name : `${parent}/${name}`;
}

export class TauriDirectoryHandle {
  constructor({ driver, path }) {
    this.driver = driver;
    this.path = path;
    this.name = path === '' ? '/' : path.split('/').pop();
    this.kind = 'directory';
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const childPath = joinPath(this.path, name);
    const exists = await this.driver.exists(childPath);
    if (!exists) {
      if (!create) throw notFound();
      await this.driver.mkdir(childPath);
    }
    return new TauriDirectoryHandle({ driver: this.driver, path: childPath });
  }

  async getFileHandle(name, { create = false } = {}) {
    const childPath = joinPath(this.path, name);
    const exists = await this.driver.exists(childPath);
    if (!exists && !create) throw notFound();
    return new TauriFileHandle({ driver: this.driver, path: childPath });
  }

  async *entries() {
    const items = await this.driver.readDir(this.path);
    for (const item of items) {
      const kind = item.isDirectory ? 'directory' : 'file';
      yield [item.name, { name: item.name, kind }];
    }
  }
}

export class TauriFileHandle {
  constructor({ driver, path }) {
    this.driver = driver;
    this.path = path;
    this.name = path.split('/').pop();
    this.kind = 'file';
  }

  async getFile() {
    const text = await this.driver.readTextFile(this.path);
    return {
      text: async () => text,
    };
  }

  async createWritable() {
    const driver = this.driver;
    const path = this.path;
    let buf = '';
    return {
      async write(content) { buf = content; },
      async close() { await driver.writeTextFile(path, buf); },
    };
  }
}
