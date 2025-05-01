import { create_sql_agent } from "./agent";
import { SqlDatabase } from "langchain/sql_db";
import { ChatOpenAI } from "@langchain/openai";
import { DataSource } from "typeorm";
import {
  createListOfTablesTool,
  createTableSchemaTool,
  createQueryTool,
  createQueryCheckerTool,
} from "./tools2";

const OPENAI_KEY = "";

async function main() {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.7,
    apiKey: OPENAI_KEY,
  });

  const datasource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "200424",
    database: "Meama_Local",
  });

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  const agent_executor = await create_sql_agent(llm, db, true);
  const question = "give me last product";
  const result = await agent_executor.invoke({ input: question });
  console.log(result);
}

main();
