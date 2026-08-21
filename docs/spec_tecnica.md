# AI Career Analyzer: Technical Specification & Implementation Guide

This document consolidates the architecture, technical requirements, structural logic, and strict editorial rules needed to build a 100% free, client-side Resume and LinkedIn Profile Analyzer. 

By leveraging WebGPU and WebAssembly, this system runs locally in the browser, ensuring user privacy and zero recurring API costs while delivering rigorous, recruiter-level career diagnostics.

---

## 1. System Architecture

The application operates entirely within the user's browser, offloading intensive tasks to Web Workers to maintain a smooth UI. It uses a **Hybrid Evaluation Engine**: deterministic tasks (dates, lengths, PII) are handled by JavaScript, while semantic tasks (level assessment, rewrites) are handled by quantized local LLMs.

### High-Level Data Flow
1. **Input:** User uploads a PDF (Resume) or pastes text (LinkedIn).
2. **Pre-Processing (Main Thread -> JS Worker):** PDF.js extracts text. Regex engines immediately redact Personally Identifiable Information (PII). Dates are parsed, and gaps are calculated deterministically.
3. **Embeddings & Search (Transformers.js Worker):** Calculates semantic match scores against target job descriptions.
4. **Diagnostic & Rewriting (WebLLM Worker):** A quantized local model processes the text through strict, JSON-enforced micro-prompts to assess seniority, identify gaps, and rewrite bullet points.
5. **UI Rendering:** The dashboard updates incrementally as Web Workers stream back JSON metrics, displaying radar charts, scores, and interactive fields for missing data.

---

## 2. Technical Stack & Requirements

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React / Next.js | UI dashboard, state management, and file handling. |
| **PDF Extraction** | `pdfjs-dist` | Extracts raw text from user-uploaded PDFs entirely client-side. |
| **In-Browser LLM** | `@mlc-ai/web-llm` | Runs a quantized model (e.g., Llama-3.2-1B-Instruct or Qwen-2.5-1.5B) via WebGPU. Caches in IndexedDB after the first load. |
| **Vector Embeddings** | `@huggingface/transformers` | Runs `all-MiniLM-L6-v2` via ONNX Runtime (WASM) for ATS keyword cosine similarity. |
| **Schema Validation** | Zod | Enforces strict TypeScript structures for the JSON data returned by the LLM. |
| **Concurrency** | Web Workers (`worker.ts`) | Keeps inference off the main thread to prevent UI freezing. |

---

## 3. The 6-Phase Execution Engine

### Phase 1: Classification & Enframing
- **Goal:** Determine the user's true seniority level based on decision scope, responsibility scale, and leadership, ignoring inflated formal titles.
- **Implementation:** The LLM classifies the profile into one strict enum: `[Júnior, Pleno, Sênior, Especialista, Gestor, Diretor]`. It outputs the "proven level", the "promised level", and calculates the gap between the two.

### Phase 2: Diagnostic & 3-Layer Scan
- **Goal:** Identify structural flaws without generating new text yet.
- **Implementation:** The JS engine runs a 3-layer scan (Headline -> Hook -> Deep Read). The LLM worker identifies:
  - **Works:** What grabs attention.
  - **Gaps:** Missing scope indicators or unverified skills.
  - **Costly Noise:** Generic buzzwords or redundant skills.
  - **Contradictions:** Misalignments between stated seniority and actual bullet scope.

### Phase 3: Interactive Missing Data Elicitation
- **Goal:** Prevent hallucinations by explicitly asking the user for missing metrics.
- **Implementation:** The UI halts execution. The LLM flags weak bullets and injects the `[FALTA NÚMERO: o que medir]` tag. The frontend displays input boxes asking the user to provide scale (e.g., "How many clients?", "What was the budget size?").

### Phase 4: Rewriting & Formatting
- **Goal:** Generate optimized content using the newly gathered user data.
- **Implementation:** 
  - **Headline:** Generates 5 strategic options (Role-based, Result-based, Specialization, Transition, Credential).
  - **Summary:** Rewrites the 'About' section under 250 words.
  - **Bullets:** Applies the XYZ/STAR formula (Action + Tool/Method + Problem + Measurable Result).

### Phase 5: The 30-Second Recruiter Simulation
- **Goal:** Provide a time-bound reality check.
- **Implementation:** The LLM outputs a structured breakdown of a recruiter's mental process: 0-5s (Headline impression), 5-15s (Credibility check in first lines), 15-25s (Experience validation), and 25-30s (Final verdict: advance or discard). It concludes if a rewrite solves the problem or if there is a structural gap.

### Phase 6: The 3-Block Action Plan
- **Goal:** Deliver an actionable roadmap.
- **Implementation:** The UI renders three distinct cards:
  - **Block A (Apply Now):** Formatted text ready to copy-paste into LinkedIn or the resume.
  - **Block B (Data Hunting):** Instructions on where the user can dig up missing metrics (e.g., old performance reviews, CRM systems).
  - **Block C (Career Moves):** Long-term strategic advice (certifications to get, leadership evidence to build).

---

## 4. Strict System Rules & Guardrails

- **Zero Fabrication:** The LLM must NEVER invent numbers, percentages, budgets, dates, titles, or employer names. Unquantified claims must be tagged with `[FALTA NÚMERO]`.
- **Quote-First Reasoning:** Every weakness or gap identified by the LLM must directly cite the specific line or section from the original text that motivated the critique.
- **Judge the Document, Not the Person:** Critiques must target the text rather than attacking the user's character.
- **PII Suppression:** Personal data (phone, address, email, ID, marital status) extracted from the document must be flagged once if inappropriate for the target market, but must NEVER be repeated or outputted in the generated text.
- **Tone & Voice Consistency:** Rewrites must preserve the user's original voice, improving clarity and evidence without forcing everyone to sound like a generic tech startup. Eliminate buzzwords like "synergy," "owner's mindset," or "passionate about".