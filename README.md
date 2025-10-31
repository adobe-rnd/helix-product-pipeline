# Helix Product Pipeline

> Platform-neutral pipeline library for rendering e-commerce product data from Adobe Commerce

This package contains the common code for `helix-product-service` and `helix-product-worker` for rendering product catalog content. It's designed to be platform-agnostic and extensible, supporting multiple output formats including HTML, JSON, XML, and media serving.

## Status

[![codecov](https://img.shields.io/codecov/c/github/adobe-rnd/helix-product-pipeline.svg)](https://codecov.io/gh/adobe-rnd/helix-product-pipeline)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/adobe-rnd/helix-product-pipeline/main.yaml)
[![GitHub license](https://img.shields.io/github/license/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/issues)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Features

- **Multi-Format Output**: Generate HTML pages, JSON data, XML feeds, and serve media files
- **Platform Neutral**: Works in Node.js, browser, and worker environments
- **Zero Runtime Dependencies**: Minimal external dependencies (only uses platform crypto)
- **CDN Optimization**: Built-in support for Akamai, Cloudflare, Fastly, and CloudFront
- **Cache Invalidation**: Sophisticated cache key generation for granular purging
- **Structured Data**: JSON-LD schema generation for products

## Architecture

The library implements a **pipeline architecture** where each request flows through a series of processing steps:

```
Request → Config Init → Fetch Data → Transform → Render → Set Headers → Response
```

### Pipeline Types

1. **HTML Pipeline** (`productHTMLPipe`): Renders product pages as HTML
2. **JSON Pipeline** (`productJSONPipe`): Returns structured product data
3. **Media Pipeline** (`productMediaPipe`): Serves optimized product images
4. **Index Pipeline** (`productIndexPipe`): Generates product catalog indexes
5. **Merchant Feed Pipeline** (`productMerchantFeedPipe`): Creates Google Shopping XML feeds

### Processing Steps

Each pipeline is composed of modular steps:

- **Configuration**: Parse URL patterns and initialize request context
- **Content Fetching**: Load product data from ProductBus (S3) or edge sources
- **Transformation**: Convert data into HAST (Hypertext Abstract Syntax Tree)
- **Rendering**: Generate HTML head/body, JSON-LD, responsive images
- **Optimization**: Add heading IDs, create picture elements, optimize media
- **Headers**: Set cache control, CDN tags, and response metadata
- **Serialization**: Convert processed content to final response format

## Installation

```bash
npm install @dylandepass/helix-product-pipeline
```

### Requirements

- Node.js 16.x or higher
- ES Module support

## Configuration

### Pipeline State

The pipeline state object contains:

```javascript
{
  org: 'organization-name',        // Organization identifier
  site: 'site-name',               // Site identifier
  contentBusId: 'content-bus-id',  // Content bus identifier
  config: {
    route: {
      params: {
        sku: 'PRODUCT-SKU',        // Product SKU
        urlKey: 'product-url',      // URL-friendly product key
        storeCode: 'us',            // Store code
        storeViewCode: 'en'         // Store view code
      }
    },
    // Additional configuration...
  },
  info: {
    originalPath: '/products/...'   // Request path
  }
}
```

### CDN Configuration

The pipeline automatically detects CDN type from request headers:

- **Akamai**: Detected via `Via` header or explicit `x-byo-cdn-type: akamai`
- **Fastly**: Detected via `CDN-Loop` or `Via` headers
- **Cloudflare**: Detected via `CDN-Loop` or `cf-worker` headers
- **CloudFront**: Detected via `Via` header

Cache headers are automatically set based on CDN type:

```javascript
// Cloudflare
'cdn-cache-control': 'max-age=300, must-revalidate'
'cache-tag': 'key1,key2,key3'

// Fastly
'surrogate-control': 'max-age=300, stale-while-revalidate=0'
'surrogate-key': 'key1 key2 key3'

// Akamai
'edge-control': '!no-store,max-age=300s,downstream-ttl=7200s'
'edge-cache-tag': 'key1 key2 key3'
```

### Platform Abstraction

The library uses conditional exports for platform-specific features:

```json
{
  "imports": {
    "#crypto": {
      "node": "./src/utils/crypto.node.js",
      "browser": "./src/utils/crypto.worker.js",
      "worker": "./src/utils/crypto.worker.js"
    }
  }
}
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/adobe-rnd/helix-product-pipeline.git
cd helix-product-pipeline

# Install dependencies
npm install
```

### Testing

```bash
# Run all tests with coverage
npm test

# The test suite includes 230+ tests covering:
# - All pipeline functions
# - Individual processing steps
# - Utility functions
# - Cache header generation
# - Path parsing and validation
# - HTML/JSON/XML rendering
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Lint-staged runs automatically on commit via Husky
```

### Building

This is a pure ES module library with no build step. Source files are published directly.

### Release Process

The project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and publishing:

```bash
# Dry run (test release without publishing)
npm run semantic-release-dry

# Actual release (automated via CI/CD)
npm run semantic-release
```

Commit message format:
- `feat: description` → Minor version bump
- `fix: description` → Patch version bump
- `BREAKING CHANGE: description` → Major version bump

## Project Structure

```
helix-product-pipeline/
├── src/
│   ├── index.js                       # Main entry point
│   ├── product-html-pipe.js           # HTML rendering pipeline
│   ├── product-json-pipe.js           # JSON data pipeline
│   ├── product-media-pipe.js          # Media serving pipeline
│   ├── product-index-pipe.js          # Catalog index pipeline
│   ├── product-merchant-feed-pipe.js  # XML feed pipeline
│   ├── steps/                         # Pipeline processing steps
│   │   ├── init-config.js             # Configuration initialization
│   │   ├── fetch-productbus.js        # Product data fetching
│   │   ├── fetch-edge-product.js      # Edge product loading
│   │   ├── fetch-404.js               # 404 fallback handling
│   │   ├── fetch-media.js             # Media file loading
│   │   ├── make-html.js               # HAST tree initialization
│   │   ├── render-head.js             # HTML head generation
│   │   ├── render-body.js             # HTML body rendering
│   │   ├── render-jsonld.js           # JSON-LD structured data
│   │   ├── create-pictures.js         # Responsive image elements
│   │   ├── add-heading-ids.js         # Heading ID generation
│   │   ├── set-cache-headers.js       # Cache/CDN headers
│   │   └── stringify-response.js      # Response serialization
│   └── utils/                         # Utility functions
│       ├── path.js                    # Path parsing/validation
│       ├── last-modified.js           # Modification tracking
│       ├── crypto.node.js             # Node.js crypto
│       └── crypto.worker.js           # Browser/worker crypto
├── test/                              # Comprehensive test suite
├── .github/workflows/                 # CI/CD configuration
├── package.json                       # Package metadata
└── README.md                          # This file
```

## API Reference

### Exported Functions

#### `productHTMLPipe(state, request)`

Renders a product page as HTML.

**Parameters:**
- `state` (Object): Pipeline state with configuration
- `request` (Request): Standard Request object

**Returns:** `Promise<Response>` - HTML response with proper headers

---

#### `productJSONPipe(state, request)`

Returns product data as JSON.

**Parameters:**
- `state` (Object): Pipeline state
- `request` (Request): Request object (must end with `.json`)

**Returns:** `Promise<Response>` - JSON response

---

#### `productMediaPipe(state, request)`

Serves optimized product media files.

**Parameters:**
- `state` (Object): Pipeline state
- `request` (Request): Request object (media URL format)

**Returns:** `Promise<Response>` - Media response with cache headers

---

#### `productIndexPipe(state, request)`

Generates product catalog index in spreadsheet format.

**Parameters:**
- `state` (Object): Pipeline state
- `request` (Request): Request object (must end with `.json`)

**Returns:** `Promise<Response>` - JSON spreadsheet data

---

#### `productMerchantFeedPipe(state, request)`

Creates Google Shopping XML feed.

**Parameters:**
- `state` (Object): Pipeline state
- `request` (Request): Request object (must end with `.xml`)

**Returns:** `Promise<Response>` - XML feed response

## Cache Strategy

The pipeline generates multiple cache keys for granular invalidation:

### Cache Key Types

1. **Product Keys**: SKU-based, URL-based, store-specific
2. **Org/Site Keys**: For site-wide invalidation
3. **Authored Content Keys**: For content-specific invalidation (new in v1.8.0)
4. **Media Keys**: For media file invalidation
5. **404 Keys**: For 404 page invalidation

### TTL Values

- **HTML/JSON**:
  - Browser: 7200s (2 hours)
  - CDN: 300s (5 minutes) or 172800s (2 days) with push invalidation
- **Media (success)**: 2592000s (30 days)
- **Media (404)**: 3600s (1 hour)
- **Error responses (400/401)**: 0s (no cache)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes using conventional commits
4. Ensure tests pass (`npm test`)
5. Run linting (`npm run lint`)
6. Push to your fork and submit a pull request

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.

## Related Projects

- [@dylandepass/helix-product-shared](https://github.com/dylandepass/helix-product-shared) - Shared utilities
- [@adobe/helix-html-pipeline](https://github.com/adobe/helix-html-pipeline) - Base pipeline framework

## Support

- [GitHub Issues](https://github.com/adobe-rnd/helix-product-pipeline/issues)
- [Changelog](CHANGELOG.md)

---

Made with ❤️ by the Edge Delivery team
