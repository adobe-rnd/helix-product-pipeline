# Architecture Overview

This document serves as a critical, living template designed to equip engineers with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

This section provides a high-level overview of the project's directory and file structure, categorized by architectural layer or major functional area. It is essential for quickly navigating the codebase, locating relevant files, and understanding the overall organization and separation of concerns.

```
helix-product-pipeline/
├── src/                                   # Main source code
│   ├── index.js                          # Public API - exports all 5 pipelines
│   │
│   ├── product-html-pipe.js              # HTML rendering pipeline
│   ├── product-json-pipe.js              # JSON API pipeline
│   ├── product-media-pipe.js             # Media serving pipeline
│   ├── product-index-pipe.js             # Catalog index spreadsheet pipeline
│   ├── product-merchant-feed-pipe.js     # Google Shopping XML feed pipeline
│   │
│   ├── steps/                            # Pipeline processing steps (atomic transforms)
│   │   ├── init-config.js                # ⚙️  Pattern-based URL routing & config resolution
│   │   ├── fetch-productbus.js           # 📦 Load product JSON from S3
│   │   ├── fetch-edge-product.js         # 📦 Load from edge/alternate source (v2 pipeline)
│   │   ├── fetch-404.js                  # 🔍 Custom 404 page fallback
│   │   ├── fetch-media.js                # 🖼️  Load media files from storage
│   │   ├── make-html.js                  # 🌲 Initialize HAST tree structure
│   │   ├── render-head.js                # 📄 Generate <head>, meta tags, OpenGraph
│   │   ├── render-body.js                # 📄 Generate product HTML body (v1)
│   │   ├── render-body-v2.js             # 📄 Alternative body rendering (v2 pipeline)
│   │   ├── render-jsonld.js              # 📊 Schema.org structured data (Product/Offer)
│   │   ├── create-pictures.js            # 🖼️  Responsive images with WebP variants
│   │   ├── add-heading-ids.js            # 🔗 Generate heading IDs for anchor links
│   │   ├── set-cache-headers.js          # 🏷️  CDN-specific cache headers & tags
│   │   ├── stringify-response.js         # 📝 Serialize HAST to HTML string
│   │   └── utils.js                      # Helper functions (constructImageUrl, etc.)
│   │
│   └── utils/                            # Shared utilities
│       ├── path.js                       # Path parsing, validation, security checks
│       ├── last-modified.js              # ETags, cache validation, source tracking
│       ├── crypto.node.js                # Node.js crypto implementation
│       └── crypto.worker.js              # Browser/Worker crypto implementation
│
├── test/                                 # Comprehensive test suite (230+ tests)
│   ├── product-*-pipe.test.js            # End-to-end pipeline integration tests
│   ├── steps/                            # Unit tests for each processing step
│   │   └── *.test.js
│   ├── utils/                            # Utility function tests
│   ├── fixtures/                         # Test data (product JSON, HTML)
│   ├── setup-env.js                      # Test environment configuration
│   └── FileS3Loader.js                   # Mock S3 for deterministic tests
│
├── .github/workflows/                    # CI/CD automation
│   ├── main.yaml                         # Test, lint, release pipeline
│   └── semver-check.yaml                 # Semantic versioning validation
│
├── package.json                          # Dependencies, scripts, exports config
├── README.md                             # Project overview and usage guide
├── CHANGELOG.md                          # Auto-generated release notes
├── LICENSE.txt                           # Apache 2.0 license
└── ARCHITECTURE.md                       # This document
```

### Key Organizational Principles

1. **Pipelines** (`product-*-pipe.js`): Orchestrate steps, handle errors, manage flow
2. **Steps** (`steps/*`): Pure functions performing single transformations
3. **Utils** (`utils/*`): Reusable helpers with no business logic
4. **Tests mirror source**: `test/steps/` matches `src/steps/`

---

## 2. High-Level System Diagram

```
┌──────────────┐
│   Consumer   │ (helix-product-service, helix-product-worker)
│   Service    │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Helix Product Pipeline Library                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Public API (index.js)                                     │ │
│  │  - productHTMLPipe()     - productMediaPipe()            │ │
│  │  - productJSONPipe()     - productIndexPipe()            │ │
│  │  - productMerchantFeedPipe()                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│         │                │                │                    │
│         ▼                ▼                ▼                    │
│  ┌────────────┐   ┌───────────┐   ┌──────────────┐           │
│  │HTML Pipeline│   │JSON Pipeline│   │Media Pipeline│           │
│  └─────┬──────┘   └─────┬─────┘   └──────┬───────┘           │
│        │                 │                 │                    │
│        └────────┬────────┴─────────────────┘                   │
│                 │                                               │
│                 ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Processing Steps (Composable)                │ │
│  │                                                           │ │
│  │  initConfig → fetchContent → transform → render          │ │
│  │     → optimize → cacheHeaders → serialize                │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────��─────────────────┘
       │                     │                    │
       ▼                     ▼                    ▼
┌─────────────┐      ┌──────────────┐     ┌──────────────┐
│ S3 Storage  │      │ CDN (Fastly, │     │  Monitoring  │
│ (ProductBus)│      │  Cloudflare, │     │   (Timers,   │
│             │      │  Akamai, CF) │     │   Logging)   │
└─────────────┘      └──────────────┘     └──────────────┘
```

### Data Flow Overview

```
HTTP Request
    │
    ├─→ 1. Path Validation & Parsing (utils/path.js)
    │
    ├─→ 2. Config Resolution (steps/init-config.js)
    │      Pattern matching: '/products/{{sku}}' → { sku: 'abc-123' }
    │
    ├─→ 3. Content Fetching (steps/fetch-*.js)
    │      S3: org/repo/store/products/slug.json → Product JSON
    │
    ├─→ 4. Transformation (steps/make-html.js, render-*.js)
    │      JSON → HAST (Abstract Syntax Tree) → HTML/JSON/XML
    │
    ├─→ 5. Optimization (steps/create-pictures.js, add-heading-ids.js)
    │      Responsive images, accessibility enhancements
    │
    ├─→ 6. Cache Headers (steps/set-cache-headers.js)
    │      CDN detection → Surrogate keys → TTL configuration
    │
    └─→ 7. Response Serialization
         HAST → HTML string / JSON / XML
```

---

## 3. Core Components

### 3.1. Library Core (Not a Standalone Service)

**Name:** Helix Product Pipeline

**Description:** Platform-neutral library for rendering e-commerce product catalog content. Does **not** include HTTP server - consumers must integrate into their own services/workers. Designed to run in Node.js, Cloudflare Workers, or browser environments.

**Technologies:**
- ES Modules (pure JavaScript)
- Unified/Rehype (HTML AST processing)
- HAST (Hypertext Abstract Syntax Tree)
- Platform-agnostic crypto (conditional exports)

**Deployment:** Published as npm package `@dylandepass/helix-product-pipeline`, consumed by downstream services

---

### 3.2. Pipeline Types (5 Specialized Processors)

#### 3.2.1. HTML Pipeline

**File:** `src/product-html-pipe.js`

**Purpose:** Renders full product pages as semantic HTML with:
- Meta tags (OpenGraph, Twitter Cards)
- JSON-LD structured data (Schema.org Product/Offer)
- Responsive images with WebP variants
- Accessibility features (heading IDs, ARIA labels)

**Flow:**
```javascript
validatePath → initConfig → fetchProduct → fetch404 (if needed)
→ makeHTML → renderHead → renderBody → renderJsonld
→ addHeadingIds → tohtml → setLastModified → cacheHeaders
```

**Key Features:**
- Conditional v2 pipeline (`metadata.pipeline === 'next'`)
- Custom 404 fallback pages
- Injectable head HTML for analytics/scripts

---

#### 3.2.2. JSON Pipeline

**File:** `src/product-json-pipe.js`

**Purpose:** Returns raw product data as JSON for:
- Client-side rendering frameworks
- API consumers
- Mobile applications

**Flow:**
```javascript
validatePath → initConfig → fetchProduct → setLastModified → cacheHeaders
```

**Output:** Product JSON with cache headers, no transformation

---

#### 3.2.3. Media Pipeline

**File:** `src/product-media-pipe.js`

**Purpose:** Serves optimized product images with:
- 30-day cache for immutable content
- Proper Content-Type detection
- CDN-specific cache tags

**URL Pattern:** `/media_[40-char-hash][optional-path].[ext]`

**Flow:**
```javascript
validatePath → initConfig → fetchMedia → setLastModified → cacheHeaders
```

---

#### 3.2.4. Index Pipeline

**File:** `src/product-index-pipe.js`

**Purpose:** Generates product catalog indexes in **spreadsheet format** for:
- Bulk product management
- Data exports
- Third-party integrations

**Output Format:**
```json
{
  "total": 150,
  "offset": 0,
  "limit": 100,
  "data": [
    { "sku": "...", "name": "...", "price": "..." }
  ],
  ":type": "spreadsheet"
}
```

**Features:**
- Filtering via `includes` query param
- Pagination support
- Configurable includes (noindex, specific SKUs)

---

#### 3.2.5. Merchant Feed Pipeline

**File:** `src/product-merchant-feed-pipe.js`

**Purpose:** Creates **Google Shopping XML feeds** compliant with:
- Google Merchant Center requirements
- RSS 2.0 format
- Product variant support

**Output:** XML with `<item>` elements containing:
- `g:id` (SKU)
- `g:title`, `g:description`
- `g:link` (absolute product URL)
- `g:image_link`
- `g:price`, `g:availability`

---

## 4. Data Stores

### 4.1. S3-Compatible Storage (ProductBus)

**Name:** Product Catalog Storage

**Type:** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO)

**Purpose:** Stores pre-processed product catalog data as JSON files

**Key Path Structure:**
```
s3://bucket-id/
├── {org}/
│   └── {repo}/
│       └── {storeCode}/
│           └── {storeViewCode}/
│               ├── products/
│               │   ├── {slug}.json              # Individual products
│               │   └── query-index.json         # Product catalog index
│               ├── media_*/                     # Product images
│               └── 404.json                     # Custom 404 content
```

**Access Pattern:**
1. URL key lookup (HEAD): `urlKey → SKU mapping`
2. Product fetch (GET): `SKU → full product JSON`

**Abstraction:** `state.s3Loader` interface allows swapping implementations (native S3 SDK, R2 bindings, file system for tests)

---

### 4.2. In-Memory State (Pipeline Context)

**Type:** Ephemeral state object passed through pipeline

**Purpose:** Carries request context, configuration, and intermediate results

**Structure:**
```javascript
{
  // Identity
  org: 'adobe',
  site: 'commerce-site',
  ref: 'main',                    // Git ref (branch)
  partition: 'preview' | 'live',  // Environment

  // Configuration (merged from pattern matching)
  config: {
    route: { params, matchedPatterns },
    public: { patterns },
    head: { html },
    cdn: { preview, live, prod },
    merchantFeedConfig: {...}
  },

  // Request metadata
  info: PathInfo,                 // Parsed URL structure
  type: 'html' | 'json' | ...,    // Pipeline type

  // Content (populated by fetch steps)
  content: {
    data: {...},                  // Product JSON
    hast: {...},                  // HTML Abstract Syntax Tree
    headers: Map                  // Media response headers
  },

  // Infrastructure
  s3Loader: S3Loader,            // Storage abstraction
  log: Logger,                   // Structured logging
  timer: Timer                   // Performance instrumentation
}
```

**Lifecycle:** Created per request, discarded after response

---

## 5. External Integrations / APIs

### 5.1. S3-Compatible Storage API

**Service:** AWS S3, Cloudflare R2, MinIO, or compatible

**Purpose:** Product catalog storage backend

**Integration Method:**
- REST API (AWS SDK in Node.js)
- R2 bindings (Cloudflare Workers)
- File system (tests)

**Operations:**
- `getObject(bucketId, key)` - Fetch product JSON or media
- Supports HEAD requests for URL key → SKU resolution

---

### 5.2. CDN Providers (Detection Only)

**Services:** Akamai, Fastly, Cloudflare, CloudFront

**Purpose:** Edge caching with custom cache tag support

**Integration Method:**
- Detection via request headers (`Via`, `CDN-Loop`, `cf-worker`)
- Response headers set accordingly (no API calls)

**Headers Used:**
- **Akamai:** `edge-control`, `edge-cache-tag`
- **Fastly:** `surrogate-control`, `surrogate-key`
- **Cloudflare:** `cdn-cache-control`, `cache-tag`
- **CloudFront:** `s-maxage` in `cache-control`

---

### 5.3. Helix Product Shared Library

**Package:** `@dylandepass/helix-product-shared`

**Purpose:** Shared utilities for ProductBus ecosystem

**Key Functions:**
- `computeProductKeys()` - Generate cache invalidation keys
- `compute404Key()` - Generate 404 page cache key
- `computeMediaKeys()` - Generate media cache keys
- `computeAuthoredContentKey()` - Generate content-specific cache key (v1.8.0+)

**Integration:** Direct npm dependency, imported in `steps/set-cache-headers.js`

---

## 6. Deployment & Infrastructure

### Platform Support Matrix

| Platform | Runtime | Deployment | Crypto | Fetch |
|----------|---------|------------|--------|-------|
| **Node.js** | 16+ | AWS Lambda, EC2, Kubernetes | `node:crypto` | Native `fetch` |
| **Cloudflare Workers** | V8 isolates | Edge workers | Web Crypto API | `fetch` API |
| **Browser** | Modern browsers | N/A (library use) | Web Crypto API | `fetch` API |
| **Deno** | Deno runtime | Deno Deploy | Web Crypto API | `fetch` API |

### CI/CD Pipeline

**Platform:** GitHub Actions

**Workflows:**
1. **main.yaml** (on every push):
   - Run tests with coverage (`npm test`)
   - Lint code (`npm run lint`)
   - Semantic release (on main branch)
   - Publish to npm

2. **semver-check.yaml**:
   - Validate commit messages
   - Ensure semantic versioning compliance

**Release Process:**
- Automated via [semantic-release](https://github.com/semantic-release/semantic-release)
- Commit messages control version bumps:
  - `feat:` → minor version
  - `fix:` → patch version
  - `BREAKING CHANGE:` → major version
- Auto-generates CHANGELOG.md
- Publishes to npm with `public` access

### Monitoring & Logging

**Built-in Instrumentation:**
- `state.timer?.update(checkpoint)` - Performance tracking hooks
- `state.log[level](message, data)` - Structured logging interface
- `res.headers.set('x-error', ...)` - Error visibility for CDN monitoring

**Consumer Responsibility:**
- Wire timer callbacks to metrics backends (Prometheus, CloudWatch, etc.)
- Configure logger to send to log aggregation (ELK, Splunk, etc.)

**Observable Headers:**
- `last-modified` - Cache validation, source tracking
- `x-error` - Pipeline errors without parsing body
- `cache-tag` / `surrogate-key` - Cache invalidation tracing

---

## 7. Security Considerations

### Input Validation

**Path Traversal Prevention** (`utils/path.js`):
```javascript
// Rejects:
- Double slashes: '/products//sku'
- Parent directory: '/products/../admin'
- Current directory: '/products/./config'
```

**Header Injection Prevention**:
- Uses `@adobe/helix-shared-utils.cleanupHeaderValue()`
- Strips newlines, carriage returns, control characters from error messages

### Data Sanitization

**SKU Slugging** (`github-slugger`):
- Converts `SKU-123/abc` → `sku-123-abc`
- Prevents S3 key injection
- Ensures URL-safe characters only

### Content Security

**Content-Type Enforcement:**
- Explicit `Content-Type` headers on all responses
- Prevents MIME sniffing attacks

**No User Input in Critical Paths:**
- S3 keys computed from slugged SKUs, not raw user input
- Configuration patterns are predefined, not user-supplied

### Authentication & Authorization

**Not Implemented** - Library responsibility:
- Consumer services must implement authentication
- Library assumes pre-authorized requests
- S3 access credentials managed by consumer

### Secrets Management

**No Secrets in Code:**
- S3 credentials injected via `state.s3Loader`
- Configuration loaded from consumer's secure storage
- No hardcoded API keys or tokens

---

## 8. Development & Testing Environment

### Local Setup

```bash
# Clone repository
git clone https://github.com/adobe-rnd/helix-product-pipeline.git
cd helix-product-pipeline

# Install dependencies
npm install

# Run tests with coverage
npm test

# Run linter
npm run lint
```

### Testing Frameworks

**Test Runner:** Mocha 11.x

**Coverage:** c8 (Istanbul's native ESM successor)

**Mocking:**
- **esmock** - ES module mocking
- **fetch-mock** - HTTP request mocking
- **FileS3Loader** - File system-based S3 mock for deterministic tests

**Assertions:** Node.js `assert` (strict mode)

**Test Data:** JSON fixtures in `test/fixtures/`

### Test Organization

```javascript
// test/product-html-pipe.test.js (Integration)
describe('Product HTML Pipe Test', () => {
  it('renders a configurable product html', async () => {
    const state = DEFAULT_STATE(config, { path: '/products/sku-123' });
    const resp = await productHTMLPipe(state, req);
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1>Product Name</h1>'));
  });
});

// test/steps/set-cache-headers.test.js (Unit)
describe('setCachingHeaders', () => {
  it('sets Fastly headers correctly', () => {
    setCachingHeaders(req, resp, ['key1', 'key2']);
    assert.strictEqual(resp.headers.get('surrogate-key'), 'key1 key2');
  });
});
```

### Code Quality Tools

**Linter:** ESLint 8.x with `@adobe/eslint-config-helix`

**Pre-commit Hooks:** Husky + lint-staged
- Auto-lints staged JavaScript files
- Prevents commits with linting errors

**Style Guide:**
- Adobe Helix conventions
- Import resolver for ES modules
- Header license check

### Development Workflow

1. **Feature Branch:** `git checkout -b feat/my-feature`
2. **Write Tests:** Add tests in `test/` mirroring `src/` structure
3. **Implement:** Write code in `src/`
4. **Verify:** `npm test` (should pass with 100% coverage)
5. **Lint:** `npm run lint` (auto-runs on commit)
6. **Commit:** Use conventional commit format: `feat: add feature`
7. **Push & PR:** Submit pull request to `main` branch

---

## 9. Future Considerations / Roadmap

### Known Architectural Debts

1. **S3 Two-Phase Fetch:**
   - Current: HEAD request (urlKey → SKU) + GET request (SKU → data)
   - Future: Direct SKU-based routing or urlKey → SKU cache

2. **HAST Serialization Performance:**
   - Current: Full tree serialization on every request
   - Future: Incremental rendering or streaming HTML

3. **Pattern Matching Complexity:**
   - Current: Regex-based URL pattern matching
   - Future: Compiled pattern matcher for better performance

### Planned Enhancements

1. **Edge-Side Includes (ESI):**
   - Partial rendering of personalized content
   - Fragment caching for product sections

2. **GraphQL Support:**
   - Additional pipeline for GraphQL queries
   - Schema generation from product catalog

3. **Real-time Product Updates:**
   - WebSocket support for live inventory
   - Server-sent events for price changes

4. **Progressive Web App (PWA) Features:**
   - Service worker integration
   - Offline product browsing

5. **A/B Testing Framework:**
   - Built-in variant selection
   - Performance impact tracking

### Migration to v2 Pipeline

**Status:** In progress (opt-in via `metadata.pipeline: 'next'`)

**Changes:**
- New rendering engine (`renderBodyV2`)
- Edge-based content loading (`fetchEdgeContent`)
- Improved performance and flexibility

**Migration Strategy:** Gradual, product-by-product opt-in

---

## 10. Project Identification

**Project Name:** Helix Product Pipeline

**Repository URL:** https://github.com/adobe-rnd/helix-product-pipeline

**npm Package:** `@dylandepass/helix-product-pipeline`

**License:** Apache License 2.0

**Primary Contact/Team:** Adobe ProductBus Team

**Maintainer:** Dylan dePass (@dylandepass)

**Date of Last Update:** 2025-10-31

**Current Version:** 1.8.0

---

## 11. Glossary / Acronyms

**HAST:** Hypertext Abstract Syntax Tree - JSON representation of HTML structure used for programmatic manipulation

**ProductBus:** Adobe's e-commerce product catalog distribution system backed by S3 storage

**Pipeline:** Functional composition of steps that transform a request into a response

**Surrogate Key:** CDN cache tag for selective invalidation (Fastly, Akamai terminology)

**Cache Tag:** Cloudflare's terminology for cache invalidation keys

**Edge:** CDN edge locations / Cloudflare Workers / other edge compute platforms

**S3 Loader:** Abstraction layer for fetching content from S3-compatible storage

**v2 Pipeline:** Next-generation rendering engine (opt-in, gradual migration)

**SKU:** Stock Keeping Unit - unique product identifier

**urlKey:** URL-friendly product identifier (e.g., `blitzmax-5000` for SKU `BLITZMAX-5000`)

**Slugger:** Utility for creating URL-safe strings from arbitrary text

**TTL:** Time To Live - cache duration in seconds

**ETags:** HTTP header for cache validation via content hash

**JSON-LD:** JSON for Linking Data - structured data format for SEO (Schema.org)

**OpenGraph:** Meta tag protocol for social media sharing (Facebook, LinkedIn)

**WebP:** Modern image format with better compression than JPEG/PNG

**Rehype:** Unified ecosystem plugin for HTML processing

**ESM:** ECMAScript Modules - native JavaScript module system

**BYO CDN:** Bring Your Own CDN - customer-provided CDN infrastructure

---

## 12. Key Architectural Patterns

### 12.1. Pipeline Pattern (Pipes and Filters)

**Description:** Data flows through a series of independent, composable transformation steps

**Benefits:**
- Each step is testable in isolation
- Steps can be reordered or replaced
- Easy to add instrumentation between steps

**Implementation:**
```javascript
export async function productHTMLPipe(state, req) {
  const res = new PipelineResponse();

  // Each step mutates res, reads state
  await initConfig(state, req);
  await fetchProductBusContent(state, res);
  await html(state, req, res);
  await renderHead(state, req, res);
  await renderBody(state, req, res);
  await setProductCacheHeaders(state, req, res);

  return res;
}
```

---

### 12.2. Strategy Pattern (Pipeline Selection)

**Description:** Different pipelines are strategies for handling the same product data

**Selection Criteria:**
- URL extension: `.json` → JSON pipe, `.xml` → merchant feed
- URL pattern: `/media_*` → media pipe
- Default: HTML pipe

**Benefits:**
- Single entry point (`index.js`) exports all strategies
- Consumer chooses appropriate strategy at runtime

---

### 12.3. Dependency Injection (S3 Loader, Logger, Timer)

**Description:** Infrastructure dependencies injected via `state` object

**Example:**
```javascript
const state = {
  s3Loader: new ProductS3Loader(credentials),  // Injected
  log: logger,                                  // Injected
  timer: performanceTimer                       // Injected
};
```

**Benefits:**
- Testability (inject mocks)
- Platform portability (inject platform-specific implementations)
- Loose coupling

---

### 12.4. Conditional Exports (Platform Abstraction)

**Description:** Module resolution selects platform-specific implementations at import time

**Configuration (package.json):**
```json
"imports": {
  "#crypto": {
    "node": "./src/utils/crypto.node.js",
    "worker": "./src/utils/crypto.worker.js"
  }
}
```

**Usage:**
```javascript
import crypto from '#crypto';  // Resolves to correct impl
```

**Benefits:**
- Zero runtime overhead (no dynamic checks)
- Tree-shakeable (bundlers exclude unused platforms)
- Same import syntax everywhere

---

### 12.5. Error as Value (Railway-Oriented Programming)

**Description:** Errors stored in response object, not thrown

**Pattern:**
```javascript
if (res.error) {
  log[res.status >= 500 ? 'error' : 'info'](`status ${res.status}: ${res.error}`);
  return res;  // Early return
}
```

**Benefits:**
- Explicit control flow (no hidden exceptions)
- Partial success possible (e.g., 404 with cache headers)
- HTTP-native error handling

---

## 13. Performance Characteristics

### Latency Budget (Target)

- **HTML Rendering:** < 100ms (p50), < 300ms (p99)
- **JSON API:** < 50ms (p50), < 150ms (p99)
- **Media Serving:** < 20ms (p50), < 50ms (p99)

### Performance Optimizations

1. **S3 Caching:**
   - CDN caches S3 responses (300s - 30d TTL)
   - Browser caches HTML (2h) and media (30d)

2. **HAST Reuse:**
   - Faster than DOM manipulation
   - Avoids string concatenation security issues

3. **Platform-Specific Crypto:**
   - Native `node:crypto` in Node.js (faster)
   - Web Crypto API in workers (no polyfill overhead)

4. **Minimal Dependencies:**
   - Tree-shakeable ES modules
   - No large frameworks (React, Vue, etc.)

5. **Streaming-Ready Architecture:**
   - No in-memory buffering required
   - Can be adapted for streaming responses

### Bottlenecks

1. **S3 Latency:**
   - Two network requests (HEAD + GET) for urlKey lookups
   - Mitigated by CDN edge caching

2. **HAST Serialization:**
   - Full tree traversal on every render
   - Future: Incremental rendering

3. **Pattern Matching:**
   - Regex compilation on every request
   - Future: Compiled pattern cache

---

## 14. Extending the Library

### Adding a New Pipeline

1. **Create Pipeline File:** `src/product-custom-pipe.js`
2. **Implement Pipeline Function:**
   ```javascript
   export async function productCustomPipe(state, req) {
     const res = new PipelineResponse();
     // Add steps...
     return res;
   }
   ```
3. **Export in index.js:** `export * from './product-custom-pipe.js';`
4. **Add Tests:** `test/product-custom-pipe.test.js`

### Adding a New Processing Step

1. **Create Step File:** `src/steps/my-step.js`
2. **Implement Step Function:**
   ```javascript
   export async function myStep(state, req, res) {
     // Read from state, write to res
     res.headers.set('x-custom', 'value');
   }
   ```
3. **Add to Pipeline:** Import and call in pipeline file
4. **Add Tests:** `test/steps/my-step.test.js`

### Customizing Cache Behavior

**Override Cache Headers Step:**
```javascript
import { productHTMLPipe as basePipe } from '@dylandepass/helix-product-pipeline';

export async function customHTMLPipe(state, req) {
  const res = await basePipe(state, req);

  // Override cache headers
  res.headers.set('cache-control', 'max-age=3600');

  return res;
}
```

### Injecting Custom Configuration

**Extend Config Patterns:**
```javascript
state.config = {
  public: {
    patterns: {
      base: { storeCode: 'main' },
      '/custom/{{id}}': { customParam: 'value' }
    }
  }
};
```

---

## 15. Common Pitfalls & Best Practices

### ❌ Pitfall: Mutating State Deeply

**Problem:** Hard to track changes, breaks testability
```javascript
// BAD
state.config.route.params.sku = 'new-value';
```

**Solution:** Create new objects
```javascript
// GOOD
state.config = {
  ...state.config,
  route: {
    ...state.config.route,
    params: { ...state.config.route.params, sku: 'new-value' }
  }
};
```

---

### ❌ Pitfall: Throwing Exceptions from Steps

**Problem:** Breaks pipeline flow, inconsistent error handling
```javascript
// BAD
throw new Error('Product not found');
```

**Solution:** Use error-as-value pattern
```javascript
// GOOD
res.status = 404;
res.error = 'Product not found';
return;
```

---

### ❌ Pitfall: Forgetting to Check res.error

**Problem:** Continue processing after error
```javascript
// BAD
await fetchProduct(state, res);
await renderProduct(state, res);  // Renders even if fetch failed!
```

**Solution:** Early return on error
```javascript
// GOOD
await fetchProduct(state, res);
if (res.error) {
  return res;
}
await renderProduct(state, res);
```

---

### ✅ Best Practice: Test with FileS3Loader

**Benefit:** Fast, deterministic tests without network I/O
```javascript
import { FileS3Loader } from '../test/FileS3Loader.js';

const state = {
  s3Loader: new FileS3Loader(),  // Uses test/fixtures/
  // ...
};
```

---

### ✅ Best Practice: Use Timer Hooks for Performance

**Benefit:** Measure bottlenecks without modifying code
```javascript
state.timer = {
  update: (checkpoint) => {
    metrics.timing(`pipeline.${checkpoint}`, Date.now() - startTime);
  }
};
```

---

### ✅ Best Practice: Validate Early, Return Fast

**Benefit:** Fail fast with clear errors
```javascript
const info = getPathInfo(path);
if (!validatePathInfo(info)) {
  return new PipelineResponse('Invalid path', { status: 400 });
}
```

---

## 16. Debugging Guide

### Enabling Detailed Logs

```javascript
state.log = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};
```

### Inspecting HAST Trees

```javascript
// After renderBody step
console.log(JSON.stringify(state.content.hast, null, 2));
```

### Tracing Cache Keys

```javascript
// In setProductCacheHeaders
const keys = await computeProductKeys(org, site, storeCode, storeViewCode, sku, urlKey);
console.log('Cache keys:', keys);
```

### Testing Cache Headers Locally

```bash
curl -H "x-byo-cdn-type: fastly" http://localhost:3000/products/sku-123 -I
# Check for: surrogate-control, surrogate-key
```

---

*This document is maintained by the Adobe ProductBus team. Please update as the architecture evolves.*
