import { IndustrialGraph } from "./types";

const graphStore = new Map<string, IndustrialGraph>();

export interface GraphRepository {
  saveGraph(scopeId: string, graph: IndustrialGraph): Promise<void>;
  getGraph(scopeId: string): Promise<IndustrialGraph | null>;
}

export class InMemoryGraphRepository implements GraphRepository {
  async saveGraph(scopeId: string, graph: IndustrialGraph): Promise<void> {
    graphStore.set(scopeId, graph);
  }

  async getGraph(scopeId: string): Promise<IndustrialGraph | null> {
    return graphStore.get(scopeId) || null;
  }
}

export const graphRepository: GraphRepository = new InMemoryGraphRepository();
