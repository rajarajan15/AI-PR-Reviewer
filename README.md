# AI Pull Request Reviewer

## Objective

The **AI Pull Request Reviewer** is an intelligent assistant designed to **automate the initial stages of code review**.
It enhances review efficiency, improves code quality, and reduces reviewer workload by using **Llama 3** to analyze pull request changes, identify issues, and provide actionable suggestions — all integrated directly with **GitHub**.

---

## Overview

Code reviews are critical to software quality but often time-consuming and prone to oversight.
This tool automates the review process by summarizing PRs, suggesting improvements, flagging issues, and enabling conversational interactions with an AI reviewer.

It serves as an **AI-powered co-reviewer**, seamlessly integrated into GitHub workflows, empowering developers to focus on logic and design while automating repetitive review tasks.

---

## Features

### 1. Automated PR Analysis

* Compares PR branch with the target branch and summarizes changes.

### 2. AI-Powered Feedback

* Suggests improvements related to:

  * Code quality and maintainability
  * Performance and logic
  * Security and architectural concerns
  * Missing tests and edge cases

### 3. Interactive Review System

* Accept or reject AI suggestions
* Add manual comments
* Ask questions like “Why this suggestion?” or “Show me test ideas”

### 4. GitHub Integration

* Uses GitHub REST API to post inline comments directly on PRs
* Updates PR threads with accepted or modified suggestions

### 5. Simple Web Interface

* Built with `index.html` for easy input and visualization

---

## Tech Stack

| Component                       | Technology                             |
| ------------------------------- | -------------------------------------- |
| **Backend**                     | Node.js                                |
| **Frontend**                    | HTML, CSS, JavaScript                  |
| **AI Model**                    | Llama 3 (via Ollama / local inference) |
| **Version Control Integration** | GitHub REST API                        |
| **Environment Management**      | dotenv (.env)                          |
| **Deployment**                  | Localhost or server-hosted Node.js app |

---

## Project Structure

```
AI-PR-Reviewer/

├── index.html                # Frontend UI for input & display
├── server.js                 # Main Node.js backend
├── .env                      # Stores GitHub token & model name
├── package.json
```

---

## Workflow

1. **User Input**

   * Enter GitHub username, repository name, and PR number in the UI.
2. **Data Fetching**

   * Backend fetches PR diffs and compares PR branch with the target branch.
3. **AI Review**

   * Llama 3 model generates:

     * Change summary
     * Code-level critique
     * Edge case/test suggestions
     * Security and performance analysis
4. **UI Display**

   * Results displayed on the web interface.
5. **User Actions**

   * Accept, reject, or comment on AI suggestions
   * Ask follow-up questions to the AI
6. **GitHub Update**

   * Feedback is posted as inline PR comments automatically.

---

## Environment Configuration

Create a `.env` file with the following:

```
GITHUB_TOKEN=<your_personal_access_token>
MODEL_NAME=llama3
```

### Required GitHub Token Scopes

* `repo`
* `pull_requests`
* `write:discussion`
* `write:issues`

---

## Example Usage

1. Run the server:

   ```bash
   node server.js
   ```
2. Open the UI:
   Go to [http://localhost:3000](http://localhost:3000)
3. Enter:

   * GitHub username
   * Repository name
   * Pull Request number
4. View AI-generated summaries and feedback.
5. Accept/reject suggestions or add comments.
6. Check your PR on GitHub — AI comments appear inline.

---

## AI Output Types

| Output Type                  | Description                                   |
| ---------------------------- | --------------------------------------------- |
| **Summary**                  | High-level explanation of what the PR changes |
| **Suggestions**              | Line-level improvements or warnings           |
| **Security Alerts**          | Flags unsafe or risky code                    |
| **Edge Cases**               | Lists unhandled scenarios or test ideas       |
| **Conversational Responses** | Enables dialogue about suggestions            |

---

## Future Enhancements

* GitLab and Bitbucket integration
* VS Code plugin for local review integration
* Advanced NLP-based query handling
* Organization-specific model fine-tuning
* Continuous review across commits

---

## Conclusion

The **AI Pull Request Reviewer** combines AI intelligence with GitHub collaboration to streamline code reviews.
It reduces repetitive review work, enhances feedback quality, and accelerates development cycles by acting as a proactive, conversational AI reviewer.

---

## References

* [GitHub REST API Docs](https://docs.github.com/en/rest)
* [Node.js Documentation](https://nodejs.org/en/docs)
* [Ollama / Llama 3 Documentation](https://ollama.ai/library/llama3)

---

## Author

**Rajarajan**
Node.js Developer
**Project Type:** AI + GitHub Integration
**Status:** Functional Prototype
