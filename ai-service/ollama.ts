import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import ollama, { type Message } from 'ollama'

export {
  Tool
}

type processQueryOptions = {
  mcp: Client
  query: string
  tools: Tool[]
}

export async function processQuery({
  mcp,
  tools,
  query,
}: processQueryOptions) {
  const messages: Message[] = [
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

  const response = await ollama.chat({
    model: 'llama3.2:1b',
    tools: availableTools,
    messages,
  })
  console.log('回應:!', response.message.content)

  const finalText: string[] = [];
  
  //處理openai回應
  const message = response.message;
  if (message.content) {
    finalText.push(message.content);
  }
  console.log('message.tool_calls', response)
  if (message.tool_calls) {
    for (const toolCall of message.tool_calls){
      const toolArgs = toolCall.function.arguments;
      console.log(`[Calling tool "${toolCall.function.name} 工具" 參數 ${JSON.stringify(toolArgs)}]`)
      const result = await mcp.callTool({
        name: toolCall.function.name,
        arguments: toolArgs
      });
      const mcpCompatibaleToolCall = {
        id: toolCall.function.name,
        type: 'function',
        ...toolCall
      }
      finalText.push(`[Calling tool "${toolCall.function.name} 工具" 參數 ${JSON.stringify(toolArgs)}]`);
      const toolResult = result as unknown as CallToolResult;
      const k  =toolResult.content
      try {
        console.log('toolResult', JSON.stringify(toolResult.content.map(i=> i?.text ? JSON.parse(i.text as string) : '')))
      } catch (error) {
        console.log('toolResultErr', toolResult.content)
      }
      finalText.push(JSON.stringify(toolResult.content.map(item=> JSON.parse(item.text as string).join('\n')).join('\n')));
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [
          mcpCompatibaleToolCall
        ]
      });
    }
  }
  return finalText.join("\n");
}