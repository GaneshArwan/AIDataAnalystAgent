import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { inspectSchema, executeSql } from './tools';
import { sanitizeErrorMessage } from '../serverUtils';


// Define the state shape, now including full multi-provider BYOK credentials
export const DataAnalystStateAnnotation = Annotation.Root({
  userQuestion: Annotation<string>(),
  schemaDetails: Annotation<string>(),
  generatedSql: Annotation<string>(),
  queryResults: Annotation<Array<Record<string, any>>>(),
  errorMsg: Annotation<string | undefined>(),
  retryCount: Annotation<number>(),
  analysisText: Annotation<string>(),
  chartConfigs: Annotation<Array<{
    title: string;
    type: 'bar' | 'line' | 'pie' | 'none';
    xAxisKey: string;
    yAxisKey: string;
    series: string[];
  }>>(),
  trace: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  
  // BYOK fields
  dbUrl: Annotation<string>(),
  provider: Annotation<string>(), // 'Gemini', 'OpenAI', 'Anthropic', 'Local'
  apiKey: Annotation<string>(),
  model: Annotation<string>(),
  baseUrl: Annotation<string | undefined>(),
});

// Helper to get the dynamic model instance based on provider
export function getModel(state: typeof DataAnalystStateAnnotation.State) {
  const { provider, model, apiKey, baseUrl } = state;
  
  if (!model) throw new Error("Model is required.");
  
  // Sanitize provider & model name to prevent evasion or command/parameter injections
  const cleanProvider = String(provider).trim().replace(/[^a-zA-Z0-9_\-]/g, '');
  const cleanModel = String(model).trim().replace(/[^a-zA-Z0-9_\-\/\.\:]/g, '');
  
  if (cleanProvider !== 'Local' && !apiKey) {
    throw new Error(`API Key is required for provider: ${cleanProvider}`);
  }

  switch(cleanProvider) {
    case 'OpenAI':
      return new ChatOpenAI({
        modelName: cleanModel,
        apiKey: apiKey,
        temperature: 0,
      });
    case 'Anthropic':
      return new ChatAnthropic({
        model: cleanModel,
        apiKey: apiKey,
        temperature: 0,
      });
    case 'Gemini':
      return new ChatGoogleGenerativeAI({
        model: cleanModel,
        apiKey: apiKey,
        temperature: 0,
      });
    case 'Local':
      return new ChatOpenAI({
        modelName: cleanModel,
        apiKey: apiKey || 'not-needed',
        configuration: {
          baseURL: baseUrl || 'http://localhost:11434/v1',
        },
        temperature: 0,
      });
    default:
      throw new Error(`Unsupported provider: ${cleanProvider}`);
  }
}

// Nodes
async function inspectSchemaNode(state: typeof DataAnalystStateAnnotation.State) {
  const schema = await inspectSchema(state.dbUrl);
  return { 
    schemaDetails: schema,
    trace: ["Inspecting database schema..."]
  };
}

async function generateSqlNode(state: typeof DataAnalystStateAnnotation.State) {
  const reasoningModel = getModel(state);
  const prompt = `
    You are an expert SQL developer. Given the following database schema and user question, generate a valid PostgreSQL query to answer the question.
    
    SCHEMA:
    ${state.schemaDetails}
    
    USER QUESTION:
    ${state.userQuestion}
    
    Return ONLY the SQL query. Do not include markdown formatting or explanations.
  `;
  
  const response = await reasoningModel.invoke(prompt);
  return { 
    generatedSql: response.content.toString().replace(/```sql|```/g, '').trim(),
    trace: ["Synthesizing SQL query..."]
  };
}

async function executeSqlNode(state: typeof DataAnalystStateAnnotation.State) {
  try {
    const results = await executeSql(state.generatedSql, state.dbUrl);
    return { 
      queryResults: results, 
      errorMsg: "", // Explicitly use empty string to clear previous errors in state
      trace: ["Executing query on database... Success!"]
    };
  } catch (error: any) {
    const sanitizedMsg = sanitizeErrorMessage(error.message);
    return { 
      errorMsg: sanitizedMsg,
      trace: [`Query failed: ${sanitizedMsg}`]
    };
  }
}

async function fixSqlNode(state: typeof DataAnalystStateAnnotation.State) {
  const reasoningModel = getModel(state);
  const prompt = `
    The following SQL query failed with an error. Please fix the query.
    
    QUERY:
    ${state.generatedSql}
    
    ERROR:
    ${state.errorMsg}
    
    SCHEMA:
    ${state.schemaDetails}
    
    Return ONLY the fixed SQL query.
  `;
  
  const response = await reasoningModel.invoke(prompt);
  return { 
    generatedSql: response.content.toString().replace(/```sql|```/g, '').trim(),
    retryCount: (state.retryCount || 0) + 1,
    trace: ["Self-healing SQL syntax..."]
  };
}

async function analyzeResultsNode(state: typeof DataAnalystStateAnnotation.State) {
  const reasoningModel = getModel(state);
  const prompt = `
    Analyze the following data retrieved from the database to answer the user's question.
    
    USER QUESTION:
    ${state.userQuestion}
    
    DATA:
    ${JSON.stringify(state.queryResults.slice(0, 10), null, 2)}
    
    Provide a concise executive summary and key insights.
  `;
  
  const response = await reasoningModel.invoke(prompt);
  return { 
    analysisText: response.content.toString(),
    trace: ["Analyzing results and generating insights..."]
  };
}

async function generateChartNode(state: typeof DataAnalystStateAnnotation.State) {
  if (!state.queryResults || state.queryResults.length === 0) {
    return {
      chartConfigs: [{ type: 'none', xAxisKey: '', yAxisKey: '', series: [] }],
      trace: ["No data for visualization."]
    };
  }

  // Fallback heuristic function to force a chart if possible
  const generateFallbackConfig = (data: any[]) => {
    if (data.length === 0) return { type: 'none', xAxisKey: '', yAxisKey: '', series: [], debug: "Empty data" };
    
    const sample = data[0];
    const keys = Object.keys(sample);
    
    // Robust detection: check for numbers or numeric strings
    const numericKeys = keys.filter(k => {
      const val = sample[k];
      if (val === null || val === undefined) return false;
      return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
    });

    // Label detection: strings that aren't numbers
    const labelKeys = keys.filter(k => {
      const val = sample[k];
      return typeof val === 'string' && isNaN(parseFloat(val));
    });

    if (numericKeys.length > 0 && labelKeys.length > 0) {
      return {
        type: 'bar',
        xAxisKey: labelKeys[0],
        yAxisKey: numericKeys[0],
        series: numericKeys.filter(k => k.toLowerCase() !== 'id'), // Exclude IDs if possible
        debug: `Detected Numeric: [${numericKeys.join(', ')}], Labels: [${labelKeys.join(', ')}]`
      };
    } else if (numericKeys.length > 1) {
      return {
        type: 'line',
        xAxisKey: numericKeys[0],
        yAxisKey: numericKeys[1],
        series: numericKeys.slice(1),
        debug: `Detected Multiple Numeric: [${numericKeys.join(', ')}]`
      };
    }
    
    return { 
      type: 'none', 
      xAxisKey: '', 
      yAxisKey: '', 
      series: [], 
      debug: `No plottable columns found. Keys: [${keys.join(', ')}]` 
    };
  };

  const simpleModel = getModel(state); // Use the same model for simplicity in BYOK
  const prompt = `
    Based on the following data, recommend ONE OR MORE chart configurations (bar, line, or pie) to visualize the data from different perspectives if possible.
    
    CRITICAL MANDATE: 
    - If the data contains ANY numeric columns (integers, decimals, or numeric strings) and at least 2 rows, you MUST return AT LEAST ONE chart type ('bar', 'line', or 'pie'). 
    - You can return multiple charts in the array if there are multiple interesting numeric columns to plot against the label.
    - DO NOT return 'none' if there is plottable data.
    - Sumbu X (xAxisKey) should be a label/string column.
    - Sumbu Y (yAxisKey) and series should be numeric columns.
    
    DATA SAMPLE:
    ${JSON.stringify(state.queryResults.slice(0, 3), null, 2)}
    
    Return JSON as an ARRAY in this format:
    [
      {
        "title": "A short descriptive title for this chart (max 5 words)",
        "type": "bar" | "line" | "pie",
        "xAxisKey": "string",
        "yAxisKey": "string",
        "series": ["string"]
      }
    ]
  `;
  
  try {
    const response = await simpleModel.invoke(prompt);
    const configText = response.content.toString().replace(/```json|```/g, '').trim();
    let configs = JSON.parse(configText);
    
    if (!Array.isArray(configs)) {
      configs = [configs];
    }
    
    const fallback = generateFallbackConfig(state.queryResults);

    // Filter out invalid configs
    const validConfigs = configs.filter((c: any) => c.type && c.type !== 'none' && c.series && c.series.length > 0);

    // If LLM says 'none' but heuristic finds plottable data, force it.
    if (validConfigs.length === 0) {
       if(fallback.type !== 'none') {
          return {
            chartConfigs: [fallback],
            trace: [`Forcing visualization. ${fallback.debug}`]
          };
       }
       return {
         chartConfigs: [{ title: '', type: 'none', xAxisKey: '', yAxisKey: '', series: [] }],
         trace: ["No valid visualization generated."]
       };
    }

    return { 
      chartConfigs: validConfigs,
      trace: [`Visual configurations synthesized. Generated ${validConfigs.length} charts.`]
    };
  } catch (e) {
    const fallback = generateFallbackConfig(state.queryResults);
    return { 
      chartConfigs: [fallback],
      trace: [`Chart AI failed. Using heuristic: ${fallback.debug}`]
    };
  }
}

// Build the graph
const workflow = new StateGraph(DataAnalystStateAnnotation)
  .addNode('inspect_schema', inspectSchemaNode)
  .addNode('generate_sql', generateSqlNode)
  .addNode('execute_sql', executeSqlNode)
  .addNode('fix_sql', fixSqlNode)
  .addNode('analyze_results', analyzeResultsNode)
  .addNode('generate_chart', generateChartNode);

workflow.addEdge(START, 'inspect_schema');
workflow.addEdge('inspect_schema', 'generate_sql');
workflow.addEdge('generate_sql', 'execute_sql');

workflow.addConditionalEdges(
  'execute_sql',
  (state) => {
    if (!state.errorMsg || state.errorMsg === "") return 'success';
    if ((state.retryCount || 0) < 2) return 'retry';
    return 'fail';
  },
  {
    success: 'analyze_results',
    retry: 'fix_sql',
    fail: END,
  }
);

workflow.addEdge('fix_sql', 'execute_sql');
workflow.addEdge('analyze_results', 'generate_chart');
workflow.addEdge('generate_chart', END);

export const graph = workflow.compile();
