# Helix Product Pipeline

This package contains the common code for `helix-product-service` and `helix-product-worker` for rendering the product bus html. it has the following design goals:

- be platform neutral, i.e. not using node or browser specific modules or dependencies.
- +/-0 runtime dependencies (eg. node [crypto](https://nodejs.org/api/crypto.html))
- offer extension interfaces where platform abstraction is required (e.g. reading from S3, sending to SQS)

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe-rnd/helix-product-pipeline.svg)](https://codecov.io/gh/adobe-rnd/helix-product-pipeline)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/adobe-rnd/helix-product-pipeline/main.yaml)
[![GitHub license](https://img.shields.io/github/license/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe-rnd/helix-product-pipeline.svg)](https://github.com/adobe-rnd/helix-product-pipeline/issues)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Installation

```bash
$ npm install @dylandepass/helix-product-pipeline
```
## Development

### Build

```bash
$ npm install
```

### Test

```bash
$ npm test
```

### Lint

```bash
$ npm run lint
```
