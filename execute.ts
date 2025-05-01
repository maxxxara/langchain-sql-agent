import { create_sql_agent } from "./agent";
import { SqlDatabase } from "langchain/sql_db";
import { ChatOpenAI } from "@langchain/openai";
import { DataSource } from "typeorm";

const OPENAI_KEY = "";

async function main() {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
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
  const question = "give me 5 products";
  const result = await agent_executor.invoke({ input: question });
  console.log(result);
}

main();
