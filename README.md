# 🕸️ AI Website Cloner Agent  

An **AI-powered CLI tool** that lets you interactively clone websites with the help of Google Gemini API.  
The agent works in a structured format: **START → THINK → TOOL → OBSERVE → THINK → OUTPUT**, making it transparent and extensible.  

---

## 🚀 Features  
- 🤖 AI Agent powered by **Gemini (OpenAI compatible API)**  
- 🛠️ Supports **custom tools** (execute shell commands, clone websites)  
- 🌐 **Hybrid website cloning**  
  - Downloads HTML, CSS, and JS  
  - Keeps images & navigation links pointing to the live website  
- 💻 Interactive **CLI mode**  
- 📂 Industry-standard project structure  

---

## 📂 Project Structure
project-root/

│── src/

│ ├── agents/ # Core AI agent logic

│ │ └── runAgent.js

│ ├── cli/ # CLI entry point

│ │ └── index.js

│ ├── config/ # Configuration files

│ │ └── openaiClient.js

│ ├── tools/ # Tools used by the agent

│ │ ├── cloneWebsite.js

│ │ ├── executeCommand.js

│ │ └── utils.js

│ └── constants/ # System prompts and constants

│ └── systemPrompt.js

│── .env # Environment variables

│── package.json

│── README.md

---

## ⚙️ Installation  

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-website-cloner.git
   cd ai-website-cloner

2. Install dependencies:
   ```bash
   npm install
   
3. Configure environment variables:
Create a .env file in the root:
  ```bash
  GEMINI_API_KEY=your_google_gemini_api_key
```
4. Ensure package.json uses ES Modules:
   ```bash
   {
   "type": "module"
   }
---

## ▶️ Usage
Run the CLI:
  ```bash
  node src/cli/index.js
  ```
You’ll see:
  ```bash
  AI Website Cloner Agent Initialized.
  Enter URL to clone (or type "exit"):

  ```
Example :
  ```bash
  https://example.com
  ```

The agent will:

START → Understand your request

THINK → Decide which tool to use

TOOL → Run cloneWebsite

OBSERVE → Process tool output

OUTPUT → Give you the final response

---

## 🛠️ Available Tools

🔹 executeCommand(command: string)

  Runs a shell command and returns the result.

🔹 cloneWebsite({ url: string, outputDir: string })

  Creates a hybrid clone of a website:

Saves HTML, CSS, JS locally

Keeps images & links pointing to the live website

---
## 📜 Example Run

AI Website Cloner Agent Initialized.
Enter URL to clone (or type "exit"): https://example.com
🧠 [START] The user wants to clone the website example.com.
🧠 [THINK] I should use the cloneWebsite tool.
🛠️ [TOOL]: cloneWebsite({"url":"https://example.com","outputDir":"example.com"})
[OBSERVATION]: Successfully created a hybrid clone of https://example.com in ./example.com

🤖 [OUTPUT]: Local copy created in "example.com" folder. 
Images and links remain functional as they point to the live site.

---

## 📝 Notes
This project uses Google Gemini API with OpenAI-style client.

Images & navigation links are hotlinked to live websites for functionality.

Fonts and structural assets (CSS, JS) are downloaded.
