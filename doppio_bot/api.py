import os
import json
import frappe
from langchain.llms import OpenAI
from langchain.memory import RedisChatMessageHistory, ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain.prompts import PromptTemplate
from langchain.chat_models import ChatOpenAI
import matplotlib.pyplot as plt

# Set OpenAI API Key
openai_api_key = frappe.conf.get("openai_api_key")
if not openai_api_key:
    frappe.throw("Please set `openai_api_key` in site config")
os.environ["OPENAI_API_KEY"] = openai_api_key

# Prompt template
prompt_template = PromptTemplate(
    input_variables=["history", "input", "doctype_data"],
    template="""
    The following is a friendly conversation between a human and an AI.
    The AI is named DoppioBot and provides detailed responses with contextual data.
    When a specific Doctype is selected, the AI analyzes its data and answers accordingly, providing insights, summaries, or visualizations.

    Doctype Data (if any): {doctype_data}

    Current conversation:
    {history}
    Human: {input}
    AI:""",
    template_format="f-string"
)

@frappe.whitelist()
def get_chatbot_response(session_id: str, prompt_message: str) -> str:
    # Get OpenAI model and selected Doctype from settings
    openai_model = get_model_from_settings()
    selected_doctype = get_selected_doctype()

    # Fetch data from the selected Doctype
    doctype_data = fetch_doctype_data(selected_doctype)

    # Initialize the LLM
    llm = ChatOpenAI(model=openai_model, temperature=0)

    # Configure Redis-based chat memory
    message_history = RedisChatMessageHistory(
        session_id=session_id,
        url=frappe.conf.get("redis_cache") or "redis://localhost:13106/0",
    )
    memory = ConversationBufferMemory(memory_key="history", chat_memory=message_history)

    # Create a conversation chain
    conversation_chain = ConversationChain(llm=llm, memory=memory, prompt=prompt_template)

    # Generate a response with Doctype context
    response = conversation_chain.run(history=memory.load_memory(), input=prompt_message, doctype_data=json.dumps(doctype_data))

    # Optionally generate and attach a graph
    graph_path = generate_graph_from_data(selected_doctype, doctype_data)
    if graph_path:
        response += f"\n\nI have also created a graph based on the data. You can view it at: {graph_path}"

    return response

def get_model_from_settings():
    default_model = "gpt-3.5-turbo"
    model = frappe.db.get_single_value("DoppioBot Settings", "openai_model")
    return model if model else default_model

def get_selected_doctype():
    doctype = frappe.db.get_single_value("DoppioBot Settings", "doctype_map")
    if not doctype:
        frappe.throw("Please select a Doctype in the DoppioBot Settings.")
    return doctype

def fetch_doctype_data(doctype):
    try:
        # Fetch all records from the selected Doctype
        records = frappe.get_all(doctype, fields=["*"])
        return records
    except frappe.DoesNotExistError:
        return f"Error: The selected Doctype '{doctype}' does not exist."
    except Exception as e:
        return f"Error while fetching data from Doctype '{doctype}': {str(e)}"

def generate_graph_from_data(doctype, data):
    if not data or isinstance(data, str):
        return None

    try:
        # Example: Generate a bar chart for numeric fields
        field_name = "field_to_plot"  # Replace with your desired numeric field
        values = [record[field_name] for record in data if field_name in record]

        if values:
            plt.figure(figsize=(10, 6))
            plt.bar(range(len(values)), values)
            plt.title(f"Data Analysis for {doctype}")
            plt.xlabel("Records")
            plt.ylabel(field_name)

            # Save graph to a file
            file_path = f"/tmp/{doctype}_analysis.png"
            plt.savefig(file_path)
            plt.close()
            return file_path

    except Exception as e:
        frappe.log_error(f"Graph generation error: {str(e)}", "DoppioBot Graph Error")
        return None
