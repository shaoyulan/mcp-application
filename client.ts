import { processQuery, OpenAI, Tool} from "./ai-service/openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";

dotenv.config();

const AI_SERVICE_KEY = process.env.ANTHROPIC_API_KEY;
if (!AI_SERVICE_KEY) {
  throw new Error("AI_SERVICE_KEY is not set");
}

console.log("AI_SERVICE_KEY:", AI_SERVICE_KEY);

class MCPClient {
  private mcp: Client;
  private aiInstance: OpenAI;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];

  constructor() {
    this.aiInstance = new OpenAI({
      apiKey: AI_SERVICE_KEY,
    });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }
  // methods will go here
  async connectToServer(serverScriptPath: string) {
    try {
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;
      
      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      this.mcp.connect(this.transport);
      
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        };
      });
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }
  async processQuery(query: string) {
    return await processQuery({
      mcp: this.mcp,
      aiInstance: this.aiInstance,
      tools: this.tools,
      query,
    }).catch((e) => {
      console.log("Error processing query:", e);
    })
  }
  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");
  
      while (true) {
        const message = await rl.question("\nQuery: ");
        console.log("\nmessage:");
        if (message.toLowerCase() === "quit") {
          console.log("\nquit:");
          break;
        }
        console.log("\nprocessQuery:", message);
        const response = await this.processQuery(message);
        console.log("\nResponse:");
        console.log("\n" + response);
      }
    }  catch (error) {
      console.error("Error in chat loop:", error);
    } finally {
      console.log("\nExiting chat loop...");
      rl.close();
    }
  }
  async cleanup() {
    await this.mcp.close();
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node index.ts <path_to_server_script>");
    return;
  }
  const mcpClient = new MCPClient();
  try {
    await mcpClient.connectToServer(process.argv[2]);
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();