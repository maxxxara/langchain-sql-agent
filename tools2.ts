import { LLMChain } from "langchain/chains";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { SqlDatabase } from "langchain/sql_db";
import { PromptTemplate } from "@langchain/core/prompts";
import { QUERY_CHECKER } from "./prompts";
import { ChatOpenAI } from "@langchain/openai";

const OPENAI_KEY = "";

const _listOfTables = z.object({});

const _tablesSchemas = z.object({
  table_names: z
    .string()
    .describe(
      "A comma-separated list of the table names for which to return the schema. Example input: 'table1, table2, table3"
    ),
});

const _writeQuerySchema = z.object({
  query: z.string().describe("A detailed and correct SQL query."),
});

const _checkQuerySchema = z.object({
  query: z.string().describe("A detailed and SQL query to be checked."),
});

export const createListOfTablesTool = (db: SqlDatabase) => {
  const listOfTablesTool = new DynamicStructuredTool({
    name: "sql_db_list_tables",
    description:
      "nput is an empty string, output is a comma-separated list of tables in the database.",
    func: async () => {
      const tableNames = db.allTables.map((table) => table.tableName);
      return tableNames.join(", ");
    },
    schema: _listOfTables,
  });
  return listOfTablesTool;
};

export const createTableSchemaTool = (db: SqlDatabase) => {
  const tableSchemaTool = new DynamicStructuredTool({
    name: "sql_db_schema",
    description: `Input to this tool is a comma-separated list of tables, output is the
        schema and sample rows for those tables.
        Be sure that the tables actually exist by calling
        "sql_db_list_tables" first!
        Example Input: table1, table2, table3`,
    func: async ({ table_names }: { table_names: string }) => {
      const tables = table_names.split(",").map((name) => name.trim());
      return db.getTableInfo(tables);
    },
    schema: _tablesSchemas,
  });
  return tableSchemaTool;
};

export const createQueryTool = (db: SqlDatabase) => {
  const queryTool = new DynamicStructuredTool({
    name: "sql_db_query",
    description: `Input to this tool is a detailed and correct SQL query, output is a 
    result from the database. If the query is not correct, an error message
    will be returned. If an error is returned, rewrite the query, check the query, 
    and try again. If you encounter an issue with Unknown column
    'xxxx' in 'field list', use 'sql_db_schema' to query the correct table fields.`,
    func: async ({ query }: { query: string }) => {
      try {
        return await db.run(query);
      } catch (error: unknown) {
        return `Error: ${(error as Error).message}`;
      }
    },
    schema: _writeQuerySchema,
  });
  return queryTool;
};

export const createQueryCheckerTool = (db: SqlDatabase) => {
  const queryCheckerTool = new DynamicStructuredTool({
    name: "query_checker",
    description:
      "Validates SQL queries before execution. Always use before 'sql_db_query'. This tool writes the sql query to the database based on the user's question and schema.",
    func: async ({ query }: { query: string }) => {
      let parsedQuery = "";
      if (query.includes("```sql")) {
        // Extract query between ```sql and ``` tags
        const match = query.match(/```sql\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          parsedQuery = match[1].trim();
        }
      } else {
        parsedQuery = query;
      }
      const llm = new ChatOpenAI({
        model: "gpt-4o",
        temperature: 0,
        apiKey: OPENAI_KEY,
      });
      const prompt = new PromptTemplate({
        template: QUERY_CHECKER,
        inputVariables: ["query", "dialect"],
      });
      const chain = new LLMChain({
        prompt,
        llm,
      });
      const result = await chain.invoke({
        query: parsedQuery,
        dialect: "postgresql",
      });
      return result.text;
    },
    schema: _checkQuerySchema,
  });
  return queryCheckerTool;
};
