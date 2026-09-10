import type { NormalizedItem, SourceConfig } from "@attune/types";

export type { NormalizedItem, SourceConfig };

export interface Connector {
  fetch(config: SourceConfig): Promise<NormalizedItem[]>;
}
