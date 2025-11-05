import type {
  PipelineRequest as ImportedPipelineRequest,
  PipelineResponse as ImportedPipelineResponse,
  PipelineState as ImportedPipelineState,
  PipelineStep as ImportedPipelineStep,
  PipelineSiteConfig as ImportedPipelineSiteConfig,
  PipelineContent as ImportedPipelineContent,
  PathInfo as ImportedPathInfo,
} from '@adobe/helix-html-pipeline';
import type { Root } from 'hast';

declare global {
  export * as SharedTypes from '@dylandepass/helix-product-shared/types';
  
  export interface PipelineRequest extends ImportedPipelineRequest {
    params: Record<string, string>;
  }

  export type PipelineStep = ImportedPipelineStep;

  export interface PipelineResponse extends ImportedPipelineResponse {
    document: Root;
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
    public: PublicConfig;
    merchantFeedConfig?: {
      title?: string;
      description?: string;
      link?: string;
    };
    cdn?: {
      preview?: {
        host?: string;
      };
      live?: {
        host?: string;
      };
      prod?: {
        host?: string;
      };
    };
    lastModified?: string;
  }

  export interface PathInfo extends ImportedPathInfo {
    pathPrefix: string;
  }

  export interface PipelineState extends ImportedPipelineState {
    config: PipelineSiteConfig;
    info: PathInfo;
    content: PipelineContent;
  }

  export interface PipelineContent extends ImportedPipelineContent {
    edge: string;
    data: ProductBusEntry;
  }

  export interface PublicConfig {
    patterns: {
      base: {
        storeViewCode: string
        storeCode: string
      }
      [pattern: string]: {
        pageType?: string
        storeViewCode?: string
        storeCode?: string
      }
    }
  
    productIndexerConfig: {
      properties: Record<string, string>
    }
  
    mixerConfig: {
      patterns: Record<string, string>
      backends: Record<
        string,
        {
          origin: string
          pathPrefix?: string
          path?: string
        }
      >
    }
  }
}

export { };