import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { SqlDatabase } from "langchain/sql_db";
import {
  SYSTEM_MESSAGE,
  SQL_SUFFIX,
  SQL_FUNCTIONS_SUFFIX,
  QUERY_CHECKER,
} from "./prompts";
import {
  PromptTemplate,
  MessagesPlaceholder,
  ChatPromptTemplate,
} from "@langchain/core/prompts";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import {
  AgentRunnableSequence,
  createOpenAIToolsAgent,
} from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor } from "langchain/agents";
import {
  createListOfTablesTool,
  createQueryCheckerTool,
  createQueryWriterTool,
  createTableSchemaTool,
} from "./tools2";

// Define TOP_K constant
const TOP_K = 5;
// Define maximum iterations
const MAX_ITERATIONS = 15;

async function create_sql_agent(
  llm: BaseLanguageModel,
  db: SqlDatabase,
  verbose: boolean = false
) {
  const listOfTablesTool = createListOfTablesTool(db);
  const tableSchemaTool = createTableSchemaTool(db);
  const queryCheckerTool = createQueryCheckerTool(db);
  const queryWriterTool = createQueryWriterTool(db);
  const tools = [
    listOfTablesTool,
    tableSchemaTool,
    queryCheckerTool,
    queryWriterTool,
  ];

  const messages = [
    new SystemMessage(SYSTEM_MESSAGE({ top_k: TOP_K, dialect: "postgresql" })),
    new HumanMessage("{input}"),
    new SystemMessage(SQL_FUNCTIONS_SUFFIX),
    new MessagesPlaceholder("agent_scratchpad"),
  ];
  console.log("messages", messages);
  const prompt = ChatPromptTemplate.fromMessages(messages);
  const agent = await createOpenAIToolsAgent({
    llm: llm as ChatOpenAI,
    tools,
    prompt,
  });

  // Create and return the agent executor
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    verbose,
    maxIterations: MAX_ITERATIONS,
  });
}

export { create_sql_agent };
