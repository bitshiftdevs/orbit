# Orbit GitHub Action

Fetch environment variables and secrets from Orbit into your CI job.

## Setup

1. Create a project-scoped token in Orbit (Settings → Tokens → New token, pick the project + scopes `env:read`, `secrets:read`).
2. Store it as a repository secret, e.g. `ORBIT_TOKEN`.

## Usage

```yaml
- uses: bitshiftdevs/orbit/action@v1
  with:
    orbit-url: https://orbit.example.com
    token: ${{ secrets.ORBIT_TOKEN }}
    project: ORBIT
    scope: production
```

Subsequent steps see each variable as an environment variable. Values are auto-masked in job logs.

## Inputs

| Name              | Default      | Description                                                        |
| ----------------- | ------------ | ------------------------------------------------------------------ |
| `orbit-url`       | —            | Base URL of your Orbit instance.                                   |
| `token`           | —            | Project-scoped `orb_` token.                                       |
| `project`         | —            | Project key.                                                       |
| `scope`           | `production` | One of `development`, `staging`, `production`.                     |
| `include-secrets` | `true`       | Also pull project secrets alongside env vars.                      |
| `export-to-env`   | `true`       | Write each variable to `$GITHUB_ENV` for later steps.              |
| `output-file`     | —            | Optional path to also write vars as a `.env` file (JSON-encoded).  |
| `mask`            | `true`       | Register each value with `::add-mask::` so it's redacted in logs.  |

## Requirements

Runner must have `curl` and `jq` (present on all GitHub-hosted runners by default).

## Releasing a new version

Consumers pin `@v1` — that tag is force-moved to each new `v1.x.y` release automatically.

```sh
scripts/release-action.sh v1.1.0
```

The script pushes the immutable `v1.1.0` tag; `.github/workflows/release-action.yml` picks it up and force-moves `v1` to the same commit.
