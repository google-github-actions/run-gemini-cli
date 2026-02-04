import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";

// Simple logger
const LOG_FILE = `/tmp/mock-mcp-${Date.now()}.log`;
function log(msg: string) {
  fs.appendFileSync(LOG_FILE, msg + "\n");
}

log(`Starting mock MCP server, logging to ${LOG_FILE}...`);

log("Starting mock MCP server...");

const server = new Server(
  {
    name: "mock-github",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const MOCK_DIFF = `diff --git a/src/index.js b/src/index.js
index e69de29..b123456 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,10 @@
 function calculate(a, b) {
-  return a + b;
+  // Potential security risk: eval used on untrusted input
+  const result = eval(a + b);
+  return result;
 }
+
+function slowLoop(n) {
+  // O(n^2) complexity identified in performance review
+  for(let i=0; i<n; i++) { for(let j=0; j<n; j++) { console.log(i+j); } }
+}
`;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  log("Listing tools...");
  return {
    tools: [
      {
        name: "pull_request_read.get",
        description: "Get PR info",
        inputSchema: { type: "object", properties: { pull_number: { type: "number" } } },
      },
      {
        name: "pull_request_read.get_diff",
        description: "Get PR diff",
        inputSchema: { type: "object", properties: { pull_number: { type: "number" } } },
      },
      {
        name: "pull_request_read.get_files",
        description: "Get PR files",
        inputSchema: { type: "object", properties: { pull_number: { type: "number" } } },
      },
      {
        name: "create_pending_pull_request_review",
        description: "Create review",
        inputSchema: { type: "object" },
      },
      {
        name: "add_comment_to_pending_review",
        description: "Add comment",
        inputSchema: { type: "object" },
      },
      {
        name: "submit_pending_pull_request_review",
        description: "Submit review",
        inputSchema: { type: "object" },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log(`Calling tool: ${request.params.name}`);
  switch (request.params.name) {
    case "pull_request_read.get":
      return { content: [{ type: "text", text: JSON.stringify({ title: "Fix logic", body: "This PR fixes stuff." }) }] };
    case "pull_request_read.get_diff":
      return { content: [{ type: "text", text: MOCK_DIFF }] };
    case "pull_request_read.get_files":
      return { content: [{ type: "text", text: JSON.stringify([{ filename: "src/index.js" }]) }] };
    default:
      return { content: [{ type: "text", text: "Success" }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Connected to transport");
}

main().catch(err => {
  log(`Error: ${err}`);
});
