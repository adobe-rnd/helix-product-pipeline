# Helix Product Pipeline

A platform-neutral, shared rendering library for transforming product catalog data into multiple output formats for e-commerce experiences on Adobe's Edge Delivery.

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe-rnd/helix-product-pipeline.svg)](https://codecov.io/gh/adobe-rnd/helix-product-pipeline)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/adobe-rnd/helix-product-pipeline/main.yaml)
[![GitHub license](https://img.shields.io/github/license/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/issues)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Overview

Helix Product Pipeline is the shared rendering engine that powers both `helix-product-pipeline-worker` and `helix-product-pipeline-service` (forthcoming). It fetches product data from the Product Bus and renders it into various formats optimized for search engines and user experiences.

### Design Goals

- **Platform Neutral**: Not using node or browser specific modules or dependencies.
- **Minimal Dependencies**: Near-zero runtime dependencies (uses conditional imports for platform-specific modules like crypto)
- **Extension Interfaces**: Provides abstractions for platform-specific operations (S3/R2 storage)

## Features

### Multiple Pipeline Types

- **HTML Pipeline**: Renders complete product pages with SEO-optimized HTML and JSON-LD structured data
- **JSON Pipeline**: Returns raw product data in JSON format
- **Media Pipeline**: Serves and proxies product images and media assets
- **Index Pipeline**: Converts product indexes to spreadsheet format
- **Sitemap Pipeline**: Generates XML sitemaps for products
- **Merchant Feed Pipeline**: Creates Google Shopping merchant feeds

### HTML Pipeline Capabilities

- Fetches product data from Product Bus storage
- Optionally merges with authored content from Edge Delivery Services
- Extracts metadata from authored content head and merges into product head
- Generates responsive picture elements with multiple breakpoints (600px, 750px/2000px)
- Creates schema.org JSON-LD structured data for rich search results
- Adds heading IDs for navigation and anchor links
- Implements CDN-aware caching with surrogate keys for targeted invalidation
- Handles product variants with proper data attributes for client-side JavaScript

### Architecture

The HTML pipeline executes these processing steps in sequence:

1. **init-config** - Initialize pipeline configuration (hosts, CDN settings)
2. **fetch-productbus** - Load product data from Product Bus storage
3. **fetch-404** - Handle 404 cases with fallback content
4. **make-html** - Create initial HTML structure
5. **render-head** - Generate HTML head with meta tags
6. **fetch-edge-product** - Optionally fetch authored content from Edge Delivery
7. **extract-authored-metadata** - Extract metadata from authored content and merge into product head
8. **render-body** - Render product content, images, and variants
9. **render-jsonld** - Generate schema.org JSON-LD structured data
10. **add-heading-ids** - Add IDs to headings for anchor navigation
11. **create-pictures** - Generate responsive picture elements
12. **stringify-response** - Serialize to HTML string
13. **set-cache-headers** - Set CDN and browser cache headers with surrogate keys

### CDN Support

Automatically detects and optimizes for major CDN providers:
- Cloudflare
- Fastly
- Akamai
- CloudFront

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Before submitting a pull request:

1. Run `npm test` to ensure all tests pass
2. Run `npm run lint` to check code style
3. Maintain test coverage above 85%
4. Follow conventional commit message format

## License

This project is licensed under the Apache License 2.0. See [LICENSE.txt](LICENSE.txt) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/adobe-rnd/helix-product-pipeline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/adobe-rnd/helix-product-pipeline/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

