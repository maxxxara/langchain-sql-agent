import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { SqlDatabase } from "langchain/sql_db";
import {
  QuerySQLDatabaseTool,
  InfoSQLDatabaseTool,
  ListSQLDatabaseTool,
  QuerySQLCheckerTool,
} from "./tools";
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

// Define TOP_K constant
const TOP_K = 5;
// Define maximum iterations
const MAX_ITERATIONS = 15;

async function create_sql_agent(
  llm: BaseLanguageModel,
  db: SqlDatabase,
  verbose: boolean = false
) {
  const tools = [
    new QuerySQLDatabaseTool(db),
    new InfoSQLDatabaseTool(db),
    new ListSQLDatabaseTool(db),
    new QuerySQLCheckerTool(db, llm),
  ];

  const system_message_prompt = await PromptTemplate.fromTemplate(
    SYSTEM_MESSAGE
  ).format({
    dialect: "postgresql",
    top_k: TOP_K,
  });

  const messages = [
    new SystemMessage(system_message_prompt),
    new HumanMessage("{input}"),
    new AIMessage(SQL_FUNCTIONS_SUFFIX),
    new MessagesPlaceholder("agent_scratchpad"),
  ];
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
