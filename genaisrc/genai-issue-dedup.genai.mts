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
      description: "List of labels to filter issues by",
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
    labelAsDuplicate: {
      type: "boolean",
      description: "Apply duplicate label to the issue if duplicates are found",
    },
  },
});
const maxFlexTokens = 7000;
const { output, vars, dbg } = env;
const issue = await github.getIssue();
if (!issue)
  throw new Error(`Issue not found, did you forget to set "github_issue"?`);
const {
  maxDuplicates,
  count,
  since,
  labels,
  state,
  tokensPerIssue,
  labelAsDuplicate,
} = vars as {
  maxDuplicates: number;
  count: number;
  since: string;
  labels: string;
  state: "open" | "closed" | "all";
  tokensPerIssue: number;
  labelAsDuplicate: boolean;
};
dbg(`issue`, issue.html_url);
dbg(`state: %s`, state);
dbg(`labels: %s`, labels);
dbg(`count: %s`, count);
dbg(`since: %s`, since);
dbg(`max duplicates: %s`, maxDuplicates);
dbg(`apply label: %s`, labelAsDuplicate);

// we only have 8k tokens, so we need to be careful with the prompt size
// issuing one request per issue
const otherIssues = (
  await github.listIssues({
    state,
    sort: "updated",
    direction: "desc",
    count,
    since: since || undefined,
    labels,
  })
).filter(({ number }) => number !== issue.number);
dbg(`Found %d issues in the repository`, otherIssues.length);

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
      for (const otherIssue of otherIssueGroup)
        otherIssueRef = ctx.def(
          "OTHER_ISSUE",
          `number: ${otherIssue.number}
${otherIssue.title}
${otherIssue.body}`,
          { flex: 1 },
        );
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
    const { issue_number, reasoning, verdict } = row as {
      issue_number: string;
      reasoning: string;
      verdict: string;
    };
    if (/DUP/.test(verdict) && !/UNI/.test(verdict)) {
      const dupIssue = otherIssueGroup.find(
        (i) => i.number === Number(issue_number),
      );
      if (dupIssue) duplicates.push(dupIssue);
    }
  }

  if (duplicates.length >= maxDuplicates) {
    dbg(`Found enough duplicates, stopping further checks.`);
    break;
  }
}

if (!duplicates.length) cancel("No duplicates found.");

output.p(`The following issues might be duplicates:`);
for (const dup of duplicates) output.item(`#${dup.number}`);

if (labelAsDuplicate) {
  const labels: string[] = Array.from(
    new Set([
      ...(issue.labels?.map((l) => (typeof l === "string" ? l : l.name)) || []),
      "duplicate",
    ]),
  );
  dbg(`updating labels: %o`, labels);
  await github.updateIssue(issue.number, { labels });
  dbg(`updated issue: %s`, issue.html_url);
}
