import { create } from 'zustand';

let nextOperationId = 1;

const useProofOfWorkStore = create((set, get) => ({
  activeCount: 0,
  operations: {},

  begin: (scope) => {
    const id = `${Date.now()}-${nextOperationId}`;
    nextOperationId += 1;
    set((state) => {
      const operations = {
        ...state.operations,
        [id]: {
          scope,
          startedAt: Date.now(),
        },
      };
      return {
        activeCount: Object.keys(operations).length,
        operations,
      };
    });
    return id;
  },

  end: (id) => set((state) => {
    if (!id || !state.operations[id]) {
      return state;
    }
    const operations = { ...state.operations };
    delete operations[id];
    return {
      activeCount: Object.keys(operations).length,
      operations,
    };
  }),

  reset: () => set({ activeCount: 0, operations: {} }),
}));

export default useProofOfWorkStore;
