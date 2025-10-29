import type {
  PipelineRequest as ImportedPipelineRequest,
  PipelineResponse as ImportedPipelineResponse,
  PipelineState as ImportedPipelineState,
  PipelineStep as ImportedPipelineStep,
  PipelineSiteConfig as ImportedPipelineSiteConfig,
  PathInfo as ImportedPathInfo,
} from '@adobe/helix-html-pipeline';

declare global {
  export * as SharedTypes from '@dylandepass/helix-product-shared/types';

  export type PathInfo = ImportedPathInfo;
  export type PipelineRequest = ImportedPipelineRequest;
  export type PipelineStep = ImportedPipelineStep;

  export interface LastModifiedSource {
    time: number;
    date: string;
  }

  export interface PipelineResponse extends ImportedPipelineResponse {
    lastModifiedSources?: Record<string, LastModifiedSource>;
  }

  export interface PipelineProductRouteConfig {
    params: Record<string, string>;
    pageType: 'product' | string;
    storeViewCode: string;
    storeCode: string;
    matchedPatterns: string[];
    confMap: ConfigMap;
  }

  export interface PipelineSiteConfig extends ImportedPipelineSiteConfig {
    route: PipelineProductRouteConfig;
    merchantFeedConfig?: {
      title?: string;
      description?: string;
      link?: string;
    };
  }

  export interface PipelineState extends ImportedPipelineState {
    config: PipelineSiteConfig;
  }
}

export { };