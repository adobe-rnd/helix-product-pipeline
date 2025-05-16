import type {
  PipelineRequest as ImportedPipelineRequest,
  PipelineResponse as ImportedPipelineResponse,
  PipelineState as ImportedPipelineState,
  PipelineStep as ImportedPipelineStep,
  PipelineSiteConfig as ImportedPipelineSiteConfig,
  PathInfo as ImportedPathInfo,
} from '@adobe/helix-html-pipeline';

declare global {
  type PathInfo = ImportedPathInfo;
  type PipelineRequest = ImportedPipelineRequest;
  type PipelineStep = ImportedPipelineStep;

  interface LastModifiedSource {
    time: number;
    date: string;
  }

  interface PipelineResponse extends ImportedPipelineResponse {
    lastModifiedSources?: Record<string, LastModifiedSource>;
  }

  interface PipelineProductRouteConfig {
    params: Record<string, string>;
    pageType: 'product' | string;
    storeViewCode: string;
    storeCode: string;
    matchedPatterns: string[];
    confMap: ConfigMap;
  }

  interface PipelineSiteConfig extends ImportedPipelineSiteConfig {
    route: PipelineProductRouteConfig;
  }

  interface PipelineState extends ImportedPipelineState {
    config: PipelineSiteConfig;
  }
}