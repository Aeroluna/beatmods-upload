# beatmods-upload

[![GitHub Super-Linter](https://github.com/aeroluna/beatmods-upload/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/aeroluna/beatmods-upload/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/aeroluna/beatmods-upload/actions/workflows/check-dist.yml/badge.svg)](https://github.com/aeroluna/beatmods-upload/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/aeroluna/beatmods-upload/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/aeroluna/beatmods-upload/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Automatically upload zipped Beat Saber mods to BeatMods.

## Inputs

| Name   | Description                                                    | Required | Default       |
| ------ | -------------------------------------------------------------- | -------- | ------------- |
| `path` | Path to get zips from.                                         | No       | `./artifacts` |
| `mods` | JSON object with mod IDs as keys and BeatMods IDs as values. | Yes      | `./artifacts` |
