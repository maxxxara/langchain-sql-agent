import { z } from "zod";
import { Tool } from "langchain/tools";
import { LLMChain } from "langchain/chains";
import { StructuredOutputParser } from "langchain/output_parsers";
import { SqlDatabase } from "langchain/sql_db";
import { QUERY_CHECKER } from "./prompts";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

// Base class for SQL database tools
export abstract class BaseSQLDatabaseTool extends Tool {
  protected db: SqlDatabase;

  constructor(db: SqlDatabase) {
    super();
    this.db = db;
  }
}

// Tool for listing tables in the database
export class ListSQLDatabaseTool extends BaseSQLDatabaseTool {
  name = "sql_db_list_tables";
  description =
    "Input is an empty string, output is a comma-separated list of tables in the database.";

  async _call(input: string = ""): Promise<string> {
    // Use allTables property to get table names
    const tableNames = this.db.allTables.map((table) => table.tableName);
    return tableNames.join(", ");
  }
}

// Tool for getting schema information about tables
export class InfoSQLDatabaseTool extends BaseSQLDatabaseTool {
  name = "sql_db_schema";
  description = `Input to this tool is a comma-separated list of tables, output is the
        schema and sample rows for those tables.
        Be sure that the tables actually exist by calling
        "sql_db_list_tables" first!
        Example Input: table1, table2, table3`;

  async _call(tableNames: string): Promise<string> {
    const tables = tableNames.split(",").map((name) => name.trim());
    return this.db.getTableInfo(tables);
  }
}

// Tool for running SQL queries
export class QuerySQLDatabaseTool extends BaseSQLDatabaseTool {
  name = "sql_db_query";
  description = `Input to this tool is a detailed and correct SQL query, output is a result from the database.
  If the query is not correct, an error message will be returned.
  If an error is returned, rewrite the query, check the query, and try again.`;

  async _call(query: string): Promise<string> {
    try {
      return await this.db.run(query);
    } catch (error: unknown) {
      return `Error: ${(error as Error).message}`;
    }
  }
}

// Tool for checking SQL query syntax
export class QuerySQLCheckerTool extends BaseSQLDatabaseTool {
  name = "query-checker";
  description = `Use this tool to double check if your query is correct before executing it.
    Always use this tool before executing a query with sql_db_query!`;

  private llmChain: LLMChain;

  constructor(db: SqlDatabase, llm: BaseLanguageModel) {
    super(db);

    const promptTemplate = new PromptTemplate({
      template: QUERY_CHECKER,
      inputVariables: ["query", "dialect"],
    });

    this.llmChain = new LLMChain({
      prompt: promptTemplate,
      llm,
    });
  }

  async _call(query: string): Promise<string> {
    const dialect = this.db.appDataSourceOptions.type;
    return this.llmChain
      .call({
        query,
        dialect,
      })
      .then((response) => response.text);
  }
}

// SQL toolkit that provides all tools
export class SQLDatabaseToolkit {
  db: SqlDatabase;
  llm: BaseLanguageModel;
  tools: Tool[];

  constructor(db: SqlDatabase, llm: BaseLanguageModel) {
    this.db = db;
    this.llm = llm;
    this.tools = this.getTools();
  }

  getTools(): Tool[] {
    return [
      new QuerySQLDatabaseTool(this.db),
      new InfoSQLDatabaseTool(this.db),
      new ListSQLDatabaseTool(this.db),
      new QuerySQLCheckerTool(this.db, this.llm),
    ];
  }
}
