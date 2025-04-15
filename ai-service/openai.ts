import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export {
  OpenAI,
  Tool
}

type processQueryOptions = {
  mcp: Client
  aiInstance: InstanceType<typeof OpenAI>
  query: string
  tools: Tool[]
}

interface MCPToolResult {
  content: string;
}

export async function processQuery({
  mcp,
  aiInstance,
  tools,
  query,
}: processQueryOptions) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: query
    }
  ];
  const availableTools = tools.map((tool: Tool) => ({
    type: "function" as const,
    function: {
      name: `${tool.name}`,
      description: `${tool.description}`,
      parameters: tool.inputSchema
    }
  }));
  //call openai
  const completion = await aiInstance.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools: availableTools,
    tool_choice: "auto"
  });
  const finalText: string[] = [];
  //處理openai回應
  for (const choice of completion.choices){
    const message = choice.message;
    if (message.content) {
      finalText.push(message.content);
    }
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls){
        const toolArgs = JSON.parse(toolCall.function.arguments);
        // 執行tool
        const result = await mcp.callTool({
          name: toolCall.function.name,
          arguments: toolArgs
        });
        const toolResult = result as unknown as MCPToolResult;
        finalText.push(`[Calling tool "${toolCall.function.name} 工具" 參數 ${JSON.stringify(toolArgs)}]`);
        finalText.push(toolResult.content);
        messages.push({
          role: "assistant",
          content: "",
          tool_calls: [toolCall]
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult.content
        });
        const nextCompletion = await aiInstance.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: availableTools,
          tool_choice: "auto"
        });
        if (nextCompletion.choices[0].message.content) {
          finalText.push(nextCompletion.choices[0].message.content);
        }
      }
    }
  }
  return finalText.join("\n");
}