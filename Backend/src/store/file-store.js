const { mkdir, readFile, rename, writeFile } = require('node:fs/promises');
const { dirname } = require('node:path');

function createInitialState() {
  return {
    companies: [],
    users: [],
    ideas: [],
    votes: [],
    sessions: []
  };
}

class FileStore {
  #queue = Promise.resolve();

  constructor(filePath) {
    this.filePath = filePath;
    this.tempFilePath = `${filePath}.tmp`;
  }

  async ensure() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      await this.setState(createInitialState());
    }
  }

  async getState() {
    await this.#queue;
    await this.ensure();

    const raw = await readFile(this.filePath, 'utf8');
    return JSON.parse(raw);
  }

  async setState(state) {
    await mkdir(dirname(this.filePath), { recursive: true });

    const payload = `${JSON.stringify(state, null, 2)}\n`;
    await writeFile(this.tempFilePath, payload, 'utf8');
    await rename(this.tempFilePath, this.filePath);
  }

  async update(mutator) {
    const operation = this.#queue.then(async () => {
      await this.ensure();

      const raw = await readFile(this.filePath, 'utf8');
      const state = JSON.parse(raw);
      const result = await mutator(state);

      await this.setState(state);

      return result;
    });

    this.#queue = operation.then(
      () => undefined,
      () => undefined
    );

    return operation;
  }
}

module.exports = {
  FileStore,
  createInitialState
};
