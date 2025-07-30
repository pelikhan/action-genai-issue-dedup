# Continous Issue Deduplicator

This action is designed to find duplicate issues in a GitHub repository using a GenAI model. It can process single issues or batch process multiple issues, comparing them against other issues in the repository and leveraging LLM reasoning to determine if they are duplicates.

When processing multiple issues, the action generates a comprehensive markdown report showing:
- Summary of issues processed
- Comparison between current duplicate labels and detected duplicates
- Detailed analysis for each issue including reasoning from the AI
- Identification of potential false positives and newly detected duplicates

> [!NOTE]
> This action uses [GitHub Models](https://github.com/models) for LLM inference.

## Algorithm

The deduplication algorithm implemented in `genaisrc/action.genai.mts` operates as follows:

- **Label Classification (Auto Mode)**: When `labels` is set to `auto`, the script first retrieves all repository labels and uses a **small** LLM to classify the current issue against those labels. The classified labels are then used for filtering issues in the next step.

- **Issue Retrieval**: The script retrieves the current issue and a configurable set of other issues from the repository, filtered by state, labels (or auto-classified labels), creation date, and count. The current issue is excluded from the comparison set.

- **Batch detection using small LLM**: For each group of issues, the script constructs a prompt that defines the current issue and the group of other issues (grouped to fit in the context window). The prompt instructs the **small** LLM to compare the current issue against each candidate, providing a CSV output with the issue number, reasoning, and a verdict (`DUP` for duplicate, `UNI` for unique).

- **Single duplicate validation using large LLM**: If the LLM identifies duplicates, the script runs a validation LLM prompt using a **large** model to confirm the duplicate hit.

- **Result Output**: If duplicates are found, their issue numbers and titles are output. If no duplicates are found, the action is cancelled with an appropriate message.

## Inputs

- `count`: Number of issues to check for duplicates (default: `30`)
- `since`: Only check issues created after this date (ISO 8601 format)
- `labels`: List of labels to filter issues by, or `auto` to automatically classify the issue and use those labels
- `state`: State of the issues to check (open, closed, all) (default: `open`)
- `max_duplicates`: Maximum number of duplicates to check for (default: `3`)
- `tokens_per_issue`: Number of tokens to use for each issue when checking for duplicates (default: `1000`)
- `label_as_duplicate`: Add `duplicate` label to issues that are found to be duplicates (default: `false`)
- `issue_range`: Range of issues to process (default: `current`)
  - `current`: Process only the current issue (original behavior)
  - `all`: Process all issues up to `max_issues` limit
  - `1-10`: Process issues from 1 to 10
  - `5`: Process only issue #5
- `start_issue`: Starting issue number for range (alternative to range syntax)
- `end_issue`: Ending issue number for range (used with `start_issue`)
- `max_issues`: Maximum number of issues to process when using `all` range (default: `50`)

- `github_token`: GitHub token with `models: read` permission at least (https://microsoft.github.io/genaiscript/reference/github-actions/#github-models-permissions). (required)
- `debug`: Enable debug logging (https://microsoft.github.io/genaiscript/reference/scripts/logging/).

## Usage

Add the following to your step in your workflow file:

### Single Issue Processing (Original Behavior)
```yaml
---
permissions:
  models: read
  issues: write
---
steps:
  - uses: pelikhan/action-genai-issue-dedup@v0
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
      issue_range: current
```

### Batch Processing Examples

Process a range of issues and generate a markdown report:
```yaml
steps:
  - uses: pelikhan/action-genai-issue-dedup@v0
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
      issue_range: "1-50"  # Process issues #1 through #50
      label_as_duplicate: true
```

Process all recent issues:
```yaml
steps:
  - uses: pelikhan/action-genai-issue-dedup@v0
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
      issue_range: "all"
      max_issues: 100  # Limit to 100 most recent issues
      state: "open"
```

Process specific issue range using parameters:
```yaml
steps:
  - uses: pelikhan/action-genai-issue-dedup@v0
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
      start_issue: 10
      end_issue: 20
```

## Example

Save this file under `.github/workflows/genai-issue-dedup.yml` in your repository:

```yaml
name: GenAI Find Duplicate Issues
on:
  issues:
    types: [opened, reopened]
permissions:
  models: read
  issues: write
concurrency:
  group: ${{ github.workflow }}-${{ github.event.issue.number }}
  cancel-in-progress: true
jobs:
  genai-issue-dedup:
    runs-on: ubuntu-latest
    steps:
      - name: Run action-issue-dedup Action
        uses: pelikhan/action-genai-issue-dedup@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Report Format

When processing multiple issues (using `issue_range` other than `current`), the action generates a detailed markdown report with the following sections:

### Summary
- Total issues processed
- Issues currently marked as duplicate
- Issues with duplicates found by the script
- Processing errors encountered

### Analysis  
- New duplicates detected (not currently marked)
- Potential false positives (marked as duplicate but no duplicates found)
- Confirmed duplicates (marked as duplicate and duplicates found)

### Detailed Results
For each processed issue:
- Current duplicate status (marked vs not marked)  
- Detection results (duplicates found vs none found)
- List of found duplicates with links
- AI reasoning for duplicate detection
- Any processing errors

This comprehensive report helps maintainers review the current state of duplicate labeling and identify issues that may need attention.

## Development

This action was automatically generated by GenAIScript from the script metadata.
We recommend updating the script metadata instead of editing the action files directly.

- the action inputs are inferred from the script parameters
- the action outputs are inferred from the script output schema
- the action description is the script title
- the readme description is the script description
- the action branding is the script branding

To **regenerate** the action files (`action.yml`), run:

```bash
npm run configure
```

To lint script files, run:

```bash
npm run lint
```

To typecheck the scripts, run:

```bash
npm run typecheck
```

To build the Docker image locally, run:

```bash
npm run docker:build
```

To run the action locally in Docker (build it first), use:

```bash
npm run docker:start
```

To run the action using [act](https://nektosact.com/), first install the act CLI:

```bash
npm run act:install
```

Then, you can run the action with:

```bash
npm run act
```

## Upgrade

The GenAIScript version is pinned in the `package.json` file. To upgrade it, run:

```bash
npm run upgrade
```

## Release

To release a new version of this action, run the release script on a clean working directory.

```bash
npm run release
```
