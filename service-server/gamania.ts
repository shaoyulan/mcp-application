import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type Product = {
  Name: string
  GA4: string
  GTM: string
  Urls: string[]
}

type GetProductListResponse = {
  Code: number
  Data: {
    ProductList: Product[]
  }
  ListData: null
  Message: null
  Url: null
}

// Create server instance
const server = new McpServer({
  name: "Games",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "get-games",
  "Get all games",
  {
  },
  async () => {
    const response = await fetch('https://tw-event.beanfun.com/communication/api/ga4/GetProductList');
    const data = await response.json() as GetProductListResponse
    const result = JSON.stringify(data.Data.ProductList);

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  },
);

// 使用keyword過濾遊戲
server.tool(
  "filter-games",
  "Filter games by keyword",
  {
    gamesList: z.string().describe("List of games in JSON string format"),
    keyword: z.string().optional().describe("Keyword to filter games"),
  },
  async ({ gamesList, keyword }) => {
    const list = JSON.parse(gamesList) as string[];
    const filteredGames = list.filter((game) => game.toLowerCase().includes(keyword?.toLowerCase() || ""));
    const result = JSON.stringify(filteredGames);

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});