import { uniqBy } from "@genaiscript/runtime";
script({
  title: "GitHub Action Deduplication",
  description: `This script checks if an issue is a duplicate of another issue in the same repository.`,
  accept: "none",
  branding: {
    icon: "copy",
    color: "yellow",
  },
  parameters: {
    count: {
      type: "integer",
      default: 30,
      minimum: 1,
      description: "Number of issues to check for duplicates",
    },
    since: {
      type: "string",
      description:
        "Only check issues created after this date (ISO 8601 format)",
    },
    labels: {
      type: "string",
      description:
        "List of labels to filter issues by, or 'auto' to automatically classify the issue and use those labels",
    },
    state: {
      type: "string",
      default: "open",
      description: "State of the issues to check (open, closed, all)",
      enum: ["open", "closed", "all"],
    },
    maxDuplicates: {
      type: "integer",
      default: 3,
      minimum: 1,
      description: "Maximum number of duplicates to check for",
    },
    tokensPerIssue: {
      type: "integer",
      default: 1000,
      minimum: 100,
      maximum: 5000,
      description:
        "Number of tokens to use for each issue when checking for duplicates",
    },
    confirmDuplicates: {
      type: "boolean",
      default: true,
      description: "Confirm duplicates with a large model before labeling",
    },
    labelAsDuplicate: {
      type: "boolean",
      description: "Apply duplicate label to the issue if duplicates are found",
    },
    issueRange: {
      type: "string",
      description:
        "Range of issues to process (e.g., '1-10', 'all', or single number like '5')",
      default: "current",
    },
    startIssue: {
      type: "integer",
      minimum: 1,
      description: "Starting issue number for range (used with endIssue)",
    },
    endIssue: {
      type: "integer",
      minimum: 1,
      description: "Ending issue number for range (used with startIssue)",
    },
    maxIssues: {
      type: "integer",
      default: 50,
      minimum: 1,
      maximum: 200,
      description: "Maximum number of issues to process when using 'all' range",
    },
  },
});
const maxFlexTokens = 7000;
const { output, vars, dbg } = env;

// Handle different modes: single issue vs range of issues
const {
  maxDuplicates,
  count,
  since,
  labels,
  state,
  tokensPerIssue,
  labelAsDuplicate,
  confirmDuplicates,
  issueRange,
  startIssue,
  endIssue,
  maxIssues,
} = vars as {
  maxDuplicates: number;
  count: number;
  since: string;
  labels: string;
  state: "open" | "closed" | "all";
  tokensPerIssue: number;
  labelAsDuplicate: boolean;
  confirmDuplicates: boolean;
  issueRange: string;
  startIssue: number;
  endIssue: number;
  maxIssues: number;
};

// Get list of issues to process
let issuesToProcess: GitHubIssue[] = [];

if (issueRange === "current") {
  // Original behavior - process single current issue
  const issue = await github.getIssue();
  if (!issue)
    throw new Error(`Issue not found, did you forget to set "github_issue"?`);
  issuesToProcess = [issue];
} else {
  // New behavior - process range of issues
  issuesToProcess = await getIssueRange(
    issueRange,
    startIssue,
    endIssue,
    maxIssues,
  );
}

dbg(`Processing %d issues`, issuesToProcess.length);

// Function to get issues based on range specification
async function getIssueRange(
  range: string,
  start?: number,
  end?: number,
  max?: number,
): Promise<GitHubIssue[]> {
  if (range === "all") {
    // Get all issues up to maxIssues limit
    const allIssues = await github.listIssues({
      state: "all",
      sort: "created",
      direction: "desc",
      count: max || 50,
    });
    return allIssues;
  } else if (range.includes("-")) {
    // Parse range like "1-10"
    const [rangeStart, rangeEnd] = range
      .split("-")
      .map((n) => parseInt(n.trim()));
    const issues: GitHubIssue[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      try {
        const issue = await github.getIssue(i);
        if (issue) issues.push(issue);
      } catch (error) {
        dbg(`Issue #${i} not found, skipping`);
      }
    }
    return issues;
  } else if (start && end) {
    // Use startIssue and endIssue parameters
    const issues: GitHubIssue[] = [];
    for (let i = start; i <= end; i++) {
      try {
        const issue = await github.getIssue(i);
        if (issue) issues.push(issue);
      } catch (error) {
        dbg(`Issue #${i} not found, skipping`);
      }
    }
    return issues;
  } else {
    // Single issue number
    const issueNumber = parseInt(range);
    if (isNaN(issueNumber)) {
      throw new Error(`Invalid issue range: ${range}`);
    }
    const issue = await github.getIssue(issueNumber);
    return issue ? [issue] : [];
  }
}
// Results tracking for markdown report
interface IssueResult {
  issue: GitHubIssue;
  currentlyMarkedAsDuplicate: boolean;
  foundDuplicates: GitHubIssue[];
  reasoning: string[];
  error?: string;
}

const results: IssueResult[] = [];

// Process each issue
for (const issue of issuesToProcess) {
  dbg(`\n=== Processing issue #${issue.number}: ${issue.title} ===`);

  const currentlyMarkedAsDuplicate =
    issue.labels?.some(
      (label) =>
        (typeof label === "string" ? label : label.name) === "duplicate",
    ) || false;

  const issueResult: IssueResult = {
    issue,
    currentlyMarkedAsDuplicate,
    foundDuplicates: [],
    reasoning: [],
  };

  try {
    // Process this issue for duplicates using existing logic
    const duplicates = await findDuplicatesForIssue(issue);
    issueResult.foundDuplicates = duplicates.issues;
    issueResult.reasoning = duplicates.reasoning;

    // Apply duplicate label if requested and duplicates found
    if (
      labelAsDuplicate &&
      duplicates.issues.length > 0 &&
      !currentlyMarkedAsDuplicate
    ) {
      const labels: string[] = Array.from(
        new Set([
          ...(issue.labels?.map((l) => (typeof l === "string" ? l : l.name)) ||
            []),
          "duplicate",
        ]),
      );
      dbg(`updating labels for #${issue.number}: %o`, labels);
      await github.updateIssue(issue.number, { labels });
      dbg(`updated issue: %s`, issue.html_url);
    }
  } catch (error) {
    issueResult.error = error instanceof Error ? error.message : String(error);
    dbg(`Error processing issue #${issue.number}: ${issueResult.error}`);
  }

  results.push(issueResult);
}

// Function to find duplicates for a single issue (extracted from original logic)
async function findDuplicatesForIssue(
  issue: GitHubIssue,
): Promise<{ issues: GitHubIssue[]; reasoning: string[] }> {
  const reasoning: string[] = [];

  // Handle "auto" mode for label classification
  let effectiveLabels: string[] =
    labels
      ?.split(",")
      .map((l) => l.trim())
      .filter(Boolean) || [];
  if (labels === "auto") {
    dbg(`Auto mode detected, classifying issue against repository labels`);

    // Get all available labels from the repository
    const repositoryLabels = await github.listIssueLabels();
    const disallowedLabels = ["duplicate", "wontfix"];
    const availableLabels = repositoryLabels.filter(
      (label) => !disallowedLabels.includes(label.name),
    );

    if (availableLabels.length === 0) {
      dbg(`No available labels found for classification`);
      effectiveLabels = [];
    } else {
      dbg(
        `Found %d available labels for classification`,
        availableLabels.length,
      );

      // Classify the issue using LLM
      const { fences, text, error } = await runPrompt(
        (ctx) => {
          ctx.$`You are a GitHub issue classification bot. Your task is to analyze the issue and suggest relevant labels based on its content.`.role(
            "system",
          );
          ctx.$`## Output format

Respond with a list of "<label name> = <reasoning>" pairs, one per line in INI format.
If you think the issue does not fit any of the provided labels, respond with "no label".
Rank the labels by relevance, with the most relevant label first.

\`\`\`ini
label1 = reasoning1
label2 = reasoning2
\`\`\`
...

`.role("system");
          ctx.def(
            "LABELS",
            availableLabels
              .map(({ name, description }) => `${name}: ${description || ""}`)
              .join("\n"),
          );
          ctx.def("ISSUE", `${issue.title}\n${issue.body}`);
        },
        {
          responseType: "text",
          systemSafety: false,
          label: "labelling issue for filtering",
          model: "small",
        },
      );

      if (error) {
        effectiveLabels = [];
      } else {
        const entries = parsers.INI(
          fences.find((f) => f.language === "ini")?.content || text,
          { defaultValue: {} },
        ) as Record<string, string>;
        const classifiedLabels = Object.keys(entries)
          .map((label) => label.trim())
          .filter((label) => availableLabels.some((l) => l.name === label));
        if (classifiedLabels.length) {
          dbg(`inferred labels: %s`, classifiedLabels.join(", "));
          effectiveLabels = classifiedLabels
            .map((l) => l.trim())
            .filter(Boolean);
        }
      }
    }
  }

  // we only have 8k tokens, so we need to be careful with the prompt size
  // issuing one request per issue
  let otherIssues = [];
  for (const label of effectiveLabels.length ? effectiveLabels : [undefined]) {
    dbg(`fetching issues with label: %s`, label || "*");
    const res = await github.listIssues({
      state,
      sort: "updated",
      direction: "desc",
      count,
      since: since || undefined,
      labels: label,
    });
    dbg(
      `found %d issues: %s`,
      res.length,
      res.map((i) => `#${i.number}`).join(", "),
    );
    otherIssues.push(...res);
  }
  otherIssues = uniqBy(otherIssues, (i) => i.number).filter(
    ({ number }) => number !== issue.number,
  );
  dbg(`unique issues candidates: %d`, otherIssues.length);

  const duplicates: GitHubIssue[] = [];
  const issuesPerGroup = Math.ceil(maxFlexTokens / tokensPerIssue);

  dbg(`tokens per issue: %s`, tokensPerIssue);
  dbg(`issues per group: %s`, issuesPerGroup);

  for (let i = 0; i < otherIssues.length; i += issuesPerGroup) {
    const otherIssueGroup = otherIssues.slice(i, i + issuesPerGroup);
    if (!otherIssueGroup.length) continue;

    const res = await runPrompt(
      (ctx) => {
        let otherIssueRef: string;
        for (const otherIssue of otherIssueGroup) {
          otherIssueRef = ctx.def(
            "OTHER_ISSUE",
            `number: ${otherIssue.number}
${otherIssue.title}
${otherIssue.body}`,
            { flex: 1 },
          );
        }
        const newIssueRef = ctx.def(
          "NEW_ISSUE",
          `${issue.title}
${issue.body}`,
          {
            maxTokens: tokensPerIssue * 2,
          },
        );

        ctx.$`You are tasked to detect if issue ${newIssueRef} is a duplicate of some of issues in ${otherIssueRef}.
For each issue in ${otherIssueRef}, responds with the issue number, the resoaning to why it is a duplicate or not, and the final verdict: "DUP" for duplicate, "UNI" for unique.

## Output format:

Respond in CSV format, with the following columns:
- issue number
- reasoning
- verdict (DUP or UNI)

## Example:

123, "same title and body", DUP
456, "different title and body", UNI

`.role("system");
        ctx.$`issue_number, reasoning, verdict

`.role("assistant");
      },
      {
        flexTokens: maxFlexTokens,
        system: ["system.chain_of_draft"],
        systemSafety: false,
        responseType: "text",
        model: "small",
        label: `Check for duplicates with ${otherIssueGroup
          .map((i) => i.number)
          .join(", ")}`,
      },
    );
    if (res.error) {
      console.error(`Error checking issues: ${res.error.message}`);
      continue;
    }

    dbg(`ai response:\n%s`, res.text);
    const lines =
      res.fences?.find((f) => f.language === "csv")?.content ||
      parsers.unfence(res.text, "csv");
    const data = parsers.CSV(lines) || [];
    for (const row of data) {
      dbg(`row: %o`, row);
      const {
        issue_number,
        reasoning: reasoningText,
        verdict,
      } = row as {
        issue_number: string;
        reasoning: string;
        verdict: string;
      };
      if (/DUP/.test(verdict) && !/UNI/.test(verdict)) {
        const dupIssue = otherIssueGroup.find(
          (i) => i.number === Number(issue_number),
        );
        if (dupIssue) {
          dbg(`Found duplicate: #%d - %s`, dupIssue.number, dupIssue.title);
          reasoning.push(`#${dupIssue.number}: ${reasoningText}`);

          if (confirmDuplicates) {
            // confirm duplicate with large model
            const { text: confirmed } = await runPrompt(
              (ctx) => {
                const otherIssueRef = ctx.def(
                  "OTHER_ISSUE",
                  dupIssue.title + "\n" + dupIssue.body,
                  {
                    flex: 1,
                  },
                );
                const newIssueRef = ctx.def(
                  "NEW_ISSUE",
                  issue.title + "\n" + issue.body,
                  {
                    flex: 2,
                  },
                );
                ctx.$`You are tasked to confirm if issue ${otherIssueRef} is a duplicate of issue ${newIssueRef}.
            Respond with your reasoning.
            Respond with "DUP" if it is a duplicate, or "UNI" if it is not.`.role(
                  "system",
                );
              },
              {
                model: "large",
                flexTokens: maxFlexTokens,
                system: ["system.chain_of_draft"],
                systemSafety: true,
                responseType: "text",
                label: `Confirm duplicate for #${dupIssue.number}`,
              },
            );
            if (/DUP/.test(confirmed) && !/UNI/.test(confirmed)) {
              dbg(`confirmed`);
              duplicates.push(dupIssue);
            } else {
              dbg(`not confirmed: %s`, confirmed);
              reasoning[reasoning.length - 1] +=
                ` (not confirmed by large model: ${confirmed})`;
            }
          } else {
            duplicates.push(dupIssue);
          }
        }
      }
    }

    if (duplicates.length >= maxDuplicates) {
      dbg(`Found enough duplicates, stopping further checks.`);
      break;
    }
  }

  return { issues: duplicates, reasoning };
}

// Function to generate markdown report
function generateMarkdownReport(results: IssueResult[]) {
  output.p("# Duplicate Detection Report");

  const summary = {
    total: results.length,
    currentlyMarked: results.filter((r) => r.currentlyMarkedAsDuplicate).length,
    foundDuplicates: results.filter((r) => r.foundDuplicates.length > 0).length,
    errors: results.filter((r) => r.error).length,
  };

  output.p("## Summary");
  output.item(`Total issues processed: ${summary.total}`);
  output.item(`Currently marked as duplicate: ${summary.currentlyMarked}`);
  output.item(`Issues with duplicates found: ${summary.foundDuplicates}`);
  output.item(`Errors encountered: ${summary.errors}`);

  // Comparison analysis
  const newDuplicates = results.filter(
    (r) => !r.currentlyMarkedAsDuplicate && r.foundDuplicates.length > 0,
  );
  const falsePositives = results.filter(
    (r) => r.currentlyMarkedAsDuplicate && r.foundDuplicates.length === 0,
  );
  const confirmed = results.filter(
    (r) => r.currentlyMarkedAsDuplicate && r.foundDuplicates.length > 0,
  );

  output.p("## Analysis");
  output.item(`New duplicates detected: ${newDuplicates.length}`);
  output.item(`Potential false positives: ${falsePositives.length}`);
  output.item(`Confirmed duplicates: ${confirmed.length}`);

  output.p("## Detailed Results");

  for (const result of results) {
    const status = result.currentlyMarkedAsDuplicate
      ? "🏷️ Currently marked as duplicate"
      : "✓ Not marked as duplicate";
    const found =
      result.foundDuplicates.length > 0
        ? `🔍 Found ${result.foundDuplicates.length} duplicates`
        : "✓ No duplicates found";

    output.p(`### Issue #${result.issue.number}: ${result.issue.title}`);
    output.item(`**Current status:** ${status}`);
    output.item(`**Detection result:** ${found}`);
    output.item(`**URL:** ${result.issue.html_url}`);

    if (result.error) {
      output.p(`❌ **Error:** ${result.error}`);
    }

    if (result.foundDuplicates.length > 0) {
      output.p("#### Found Duplicates:");
      for (const dup of result.foundDuplicates) {
        output.item(`[#${dup.number}](${dup.html_url}): ${dup.title}`);
      }

      if (result.reasoning.length > 0) {
        output.p("#### Reasoning:");
        for (const reason of result.reasoning) {
          output.item(reason);
        }
      }
    }

    output.p("---");
  }
}

// Process each issue
for (const issue of issuesToProcess) {
  dbg(`\n=== Processing issue #${issue.number}: ${issue.title} ===`);

  const currentlyMarkedAsDuplicate =
    issue.labels?.some(
      (label) =>
        (typeof label === "string" ? label : label.name) === "duplicate",
    ) || false;

  const issueResult: IssueResult = {
    issue,
    currentlyMarkedAsDuplicate,
    foundDuplicates: [],
    reasoning: [],
  };

  try {
    // Process this issue for duplicates using existing logic
    const duplicates = await findDuplicatesForIssue(issue);
    issueResult.foundDuplicates = duplicates.issues;
    issueResult.reasoning = duplicates.reasoning;

    // Apply duplicate label if requested and duplicates found
    if (
      labelAsDuplicate &&
      duplicates.issues.length > 0 &&
      !currentlyMarkedAsDuplicate
    ) {
      const labels: string[] = Array.from(
        new Set([
          ...(issue.labels?.map((l) => (typeof l === "string" ? l : l.name)) ||
            []),
          "duplicate",
        ]),
      );
      dbg(`updating labels for #${issue.number}: %o`, labels);
      await github.updateIssue(issue.number, { labels });
      dbg(`updated issue: %s`, issue.html_url);
    }
  } catch (error) {
    issueResult.error = error instanceof Error ? error.message : String(error);
    dbg(`Error processing issue #${issue.number}: ${issueResult.error}`);
  }

  results.push(issueResult);
}

// Generate markdown report
generateMarkdownReport(results);
