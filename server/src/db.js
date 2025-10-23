import fs from 'fs/promises';
import path from 'path';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export class DataStore {
  constructor(filePath, defaultData) {
    this.filePath = filePath;
    this.defaultData = defaultData;
    this._queue = Promise.resolve();
  }

  async init() {
    await ensureDir(path.dirname(this.filePath));
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(this.defaultData, null, 2), 'utf8');
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw || 'null');
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  queue(op) {
    this._queue = this._queue.then(op, op);
    return this._queue;
  }
}
