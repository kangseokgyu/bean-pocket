export function memoryFormDraftStorage() {
  const files = new Map();
  const privateDirectory = {
    async getFileHandle(name, { create = false } = {}) {
      if (!files.has(name) && !create) {
        const error = new Error('missing file');
        error.name = 'NotFoundError';
        throw error;
      }
      if (!files.has(name)) files.set(name, '');
      return {
        async getFile() {
          return { async text() { return files.get(name); } };
        },
        async createWritable() {
          let pending = '';
          return {
            async write(value) { pending = String(value); },
            async close() { files.set(name, pending); },
            async abort() {},
          };
        },
      };
    },
  };
  const root = {
    async getDirectoryHandle(name, { create = false } = {}) {
      if (name !== 'bean-pocket-private-v1' || (!create && files.size === 0)) {
        const error = new Error('missing directory');
        error.name = 'NotFoundError';
        throw error;
      }
      return privateDirectory;
    },
  };
  return { files, async getDirectory() { return root; } };
}
