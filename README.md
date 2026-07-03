<div align="center">
  <img src="public/favicon.ico" alt="FarmPal" width="64" height="64" />
  <h1>FarmPal</h1>
  <p><strong>Offline-First AI Crop Disease Diagnosis Assistant</strong></p>
  <p>Powered by Google's Gemma &middot; Built with Next.js</p>

  <p>
    <img src="https://img.shields.io/badge/status-alpha-yellow" alt="Status: Alpha" />
    <img src="https://img.shields.io/badge/next.js-16.2-black" alt="Next.js 16.2" />
    <img src="https://img.shields.io/badge/react-19.2-blue" alt="React 19.2" />
    <img src="https://img.shields.io/badge/typescript-5.0-3178c6" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/tailwindcss-4.0-38bdf8" alt="TailwindCSS 4" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT" />
    <img src="https://img.shields.io/badge/ai-gemma-4285F4" alt="AI: Gemma" />
  </p>
</div>

---

FarmPal is an AI-powered agricultural assistant designed for farmers in low-connectivity and offline environments. Instead of rigid keyword matching, FarmPal uses conversational reasoning to help identify likely crop diseases, pest infestations, and nutrient deficiencies.

The AI is powered by [Google's Gemma](https://ai.google.dev/gemma) model and follows an **offline-first architecture**: it runs locally when a Gemma runtime is available and falls back to a cloud endpoint when connectivity exists. Diagnosis history is stored locally so past consultations remain accessible without internet access.

> **Status:** This repository contains the project scaffold and planned architecture. Core features are under active development and will be implemented incrementally.

---

## Problem Statement

Smallholder farmers in rural and remote areas face significant barriers to accessing agricultural expertise:

- **Limited connectivity.** Internet access is unreliable or unavailable, ruling out cloud-dependent tools.
- **Extension officer shortage.** Agricultural extension agents cannot reach every farmer in a timely manner.
- **Rigid diagnostic tools.** Existing digital tools use keyword matching with no conversational context, leading to misdiagnosis.
- **No history persistence.** Farmers cannot track symptom progression across multiple consultations.

A diagnostic tool for this context must work without internet, reason like a human expert, and keep a local record of every interaction.

## Solution

FarmPal addresses these constraints with three core design decisions:

1. **Conversational AI reasoning.** The model asks clarifying questions before delivering a diagnosis—mirroring how an agricultural extension officer would gather information in the field. This reduces false positives and builds farmer confidence.
2. **Offline-first execution.** The Gemma model runs locally via [Ollama](https://ollama.ai). When no local runtime is available but internet exists, the system transparently falls back to a cloud-hosted Gemma endpoint.
3. **Local-first storage.** All consultation history is stored client-side (IndexedDB), making the full record available offline and eliminating dependency on a remote database for basic operation.

## Key Features

| Feature | Description | Status |
|---|---|---|
| Conversational Diagnosis | The AI asks follow-up questions before providing a diagnosis, simulating an expert consultation | Planned |
| Offline-First AI | Local Gemma inference via Ollama with automatic cloud fallback | Planned |
| Diagnosis History | Local storage of all consultations with full search and review | Planned |
| Confidence Scoring | Each diagnosis includes a confidence level, reasoning, and actionable recommendations | Planned |
| Progressive Web App | Installable on-device experience with service worker caching | Planned |
| Image-Assisted Diagnosis | Upload crop symptom photos for visual analysis | Future |
| Voice Interaction | Hands-free symptom description via speech-to-text | Future |
| Local Language Support | UI and AI responses in regional languages | Future |

## Architecture Overview

FarmPal follows a **layered architecture** built on Next.js 15's App Router. The frontend, API layer, and AI orchestration live within a single Next.js application.

```
┌─────────────────────────────────────────────────────┐
│                   Browser (PWA)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Chat UI  │  │ Dashboard│  │  History View     │  │
│  └────▲─────┘  └────▲─────┘  └────▲──────────────┘  │
│       │               │            │                  │
│  ┌────┴───────────────┴────────────┴──────────────┐  │
│  │          React Components (server + client)     │  │
│  └────────────────────▲───────────────────────────┘  │
│                       │                               │
│  ┌────────────────────┴───────────────────────────┐  │
│  │           Service Layer (Server Actions)        │  │
│  └────────────────────▲───────────────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────┐
│              Next.js Server (Node.js)                │
│  ┌────────────────────┴───────────────────────────┐  │
│  │           Route Handlers / API Layer            │  │
│  └────────────────────▲───────────────────────────┘  │
│                       │                               │
│  ┌────────────────────┴───────────────────────────┐  │
│  │              AI Inference Layer                  │  │
│  │  ┌─────────────┐  ┌────────────┐               │  │
│  │  │ Ollama Local │  │ Cloud API  │               │  │
│  │  │  (Gemma)     │  │  (Gemma)   │               │  │
│  │  └──────┬──────┘  └─────┬──────┘               │  │
│  │         │               │                        │  │
│  │  ┌──────┴───────────────┴──────┐                │  │
│  │  │    Connection Manager       │                │  │
│  │  │  (online/offline detection) │                │  │
│  │  └─────────────────────────────┘                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Storage Layer                       │  │
│  │  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │    MongoDB    │  │  IndexedDB   │            │  │
│  │  │  (via driver) │  │  (cache/     │            │  │
│  │  │               │  │   offline)   │            │  │
│  │  └──────────────┘  └──────────────┘            │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Architecture decisions

- **Monorepo within a single Next.js app.** A multi-service architecture would introduce deployment and operational complexity that is unjustified at this stage. Next.js Route Handlers serve as the API boundary, and Server Actions handle mutations. This keeps deployment simple (one `next build` / `next start`) while allowing the API layer to be extracted later if needed.
- **Ollama for local inference.** Ollama provides a well-maintained local runtime for Gemma models with a simple REST API. This avoids building a custom inference engine and lets us piggyback on Ollama's model management and hardware optimization.
- **Connection Manager as a standalone module.** The decision to run locally vs. via cloud is encapsulated in a single `ConnectionManager` service. The rest of the application is unaware of the transport layer. This makes it straightforward to add new inference providers (e.g., WebGPU, ONNX) without changing the diagnosis pipeline.
- **MongoDB for server-side persistence.** MongoDB's document model maps naturally to semi-structured diagnosis records where each consultation has variable-length conversation history, symptoms, and metadata. Embedding related data in a single document avoids expensive joins and matches the read-and-display access pattern of the history view.
- **IndexedDB for offline history.** IndexedDB in the browser stores diagnosis history locally, ensuring full offline access to past consultations. A future sync layer can reconcile local data with MongoDB when connectivity is available.

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components, Route Handlers, Server Actions in one deployable unit |
| UI | React 19 + TypeScript | Type safety, concurrent features, broad ecosystem |
| Styling | TailwindCSS 4 | Utility-first, small bundle, fast iteration |
| AI Model | Google Gemma | State-of-the-art open-weight LLM optimized for edge deployment |
| Local Inference | Ollama | Production-ready local LLM runtime with REST API |
| Database | MongoDB (planned) | Document model fits semi-structured diagnosis records, offline-first sync via MongoDB Realm |
| Client Storage | IndexedDB via idb (planned) | Offline-first local persistence in the browser |
| PWA | next-pwa or service worker (planned) | Installable, cache-first resource loading |
| Package Manager | pnpm | Fast, disk-efficient, strict dependency isolation |

## Repository Structure

```
farmpal/
├── app/                          # Next.js App Router pages
│   ├── (marketing)/              # Landing and marketing pages
│   ├── api/                      # Route Handlers (API endpoints)
│   ├── dashboard/                # Farmer dashboard
│   ├── diagnose/                 # Diagnosis conversation flow
│   ├── history/                  # Past consultations
│   ├── settings/                 # User preferences and config
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/                   # Shared React components
│   ├── chat/                     # Chat bubble, input, transcript
│   ├── diagnosis/                # Diagnosis card, confidence meter
│   ├── forms/                    # Form components
│   └── ui/                       # Primitive UI components (button, input, etc.)
├── lib/                          # Core application logic
│   ├── ai/                       # AI inference & prompt management
│   │   ├── gemma.ts              # Gemma model client
│   │   ├── inference.ts          # Inference orchestrator
│   │   └── prompts.ts            # Prompt templates & chain-of-thought
│   ├── cache/                    # Local caching layer
│   ├── db/                       # MongoDB models and queries
│   ├── utils/                    # Shared utilities
│   └── validation/               # Input validation schemas (Zod)
├── services/                     # Service layer (business logic)
├── hooks/                        # Shared React hooks
├── tests/                        # Test suite
├── docs/                         # Documentation and specs
├── public/                       # Static assets
│
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── package.json
```

## Installation

### Prerequisites

- **Node.js** 20.x or later
- **pnpm** 9.x or later
- **Ollama** (optional, for local Gemma inference)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/farmpal.git
cd farmpal

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application URL |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | No | `gemma3:2b` | Gemma model tag for Ollama |
| `GEMMA_CLOUD_ENDPOINT` | No | — | Cloud-hosted Gemma API URL |
| `GEMMA_CLOUD_API_KEY` | No | — | API key for cloud endpoint |
| `MONGODB_URI` | No | `mongodb://localhost:27017/farmpal` | MongoDB connection string |

## Local Development

```bash
# Start the development server with hot reload
pnpm dev
```

The dev server runs at `http://localhost:3000`. File changes are reflected immediately via Next.js Fast Refresh.

## Running with Local Gemma

FarmPal defaults to local inference when an Ollama instance is available.

```bash
# Install and start Ollama
# See https://ollama.ai for platform-specific instructions

# Pull the Gemma model
ollama pull gemma3:2b

# Verify Ollama is running
ollama list

# Start FarmPal (detects Ollama automatically)
pnpm dev
```

The application will detect Ollama at the configured `OLLAMA_BASE_URL` and route all inference requests through it. If Ollama is unreachable, FarmPal checks for a configured cloud endpoint.

## Running with Cloud Gemma

For environments where a local LLM runtime is not available, configure a cloud-hosted Gemma endpoint:

```bash
# .env.local
GEMMA_CLOUD_ENDPOINT=https://your-gemma-endpoint.example.com/v1/chat
GEMMA_CLOUD_API_KEY=your-api-key
```

The connection manager automatically falls back to the cloud endpoint when Ollama is unreachable and a cloud URL is configured.

## Offline-First Strategy

FarmPal's offline-first architecture operates on three tiers:

```
┌─────────────────────────────────────────────────────┐
│                  Tier 1: Fully Offline               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Ollama Local  │  │  IndexedDB   │  │  PWA Cache│  │
│  │   Inference   │  │   History    │  │  (assets)  │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
│  No internet required for any operation              │
├─────────────────────────────────────────────────────┤
│                 Tier 2: Intermittent                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Cloud Gemma  │  │  Local-first │                 │
│  │   Fallback   │  │  then sync   │                 │
│  └──────────────┘  └──────────────┘                 │
│  AI via cloud when local unavailable                 │
│  History stored locally, synced when possible        │
├─────────────────────────────────────────────────────┤
│                 Tier 3: Full Connectivity            │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Cloud Gemma  │  │   MongoDB    │                 │
│  │   (primary)   │  │  (primary)   │                 │
│  └──────────────┘  └──────────────┘                 │
│  Cloud-native mode with remote database              │
└─────────────────────────────────────────────────────┘
```

**Key offline mechanisms:**

- **Connection Manager** probes Ollama and cloud endpoints on startup and caches availability. All AI service calls go through this manager—no other module makes transport decisions.
- **IndexedDB** stores every diagnosis response, prompt, and timestamp. The history page reads exclusively from IndexedDB, making it fully offline.
- **PWA service worker** (planned) will cache application shell, static assets, and API responses for resilience.

## AI Reasoning Workflow

FarmPal's diagnosis pipeline is designed around **conversational symptom elicitation**, not one-shot classification.

```
┌────────────────────────────────────────────────────────┐
│                  1. Symptom Intake                      │
│  User describes the problem in natural language         │
│  "My maize leaves have holes"                           │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                  2. Clarification Loop                   │
│  AI asks targeted follow-up questions:                  │
│  • Which part of the leaf?                              │
│  • Are insects visible?                                 │
│  • When did symptoms begin?                             │
│  • Are neighboring plants affected?                     │
│                                                         │
│  Loop continues until confidence threshold is met       │
│  or user explicitly requests a diagnosis                │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                  3. Diagnosis Generation                 │
│  AI synthesizes all information and produces:           │
│  • Possible diagnosis                                   │
│  • Confidence level                                     │
│  • Reasoning                                            │
│  • Immediate actions                                    │
│  • Preventive recommendations                           │
│  • When to consult an extension officer                 │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                  4. Storage & Review                     │
│  Full conversation saved to IndexedDB                   │
│  Available in History for future reference              │
└────────────────────────────────────────────────────────┘
```

### Why conversational?

Single-shot classification (symptom → disease) is fragile. Farmers describe symptoms in varied, non-technical language, and many diseases share similar visible signs. By asking clarifying questions, the model:

- Reduces false positives by narrowing differential diagnoses
- Builds trust through transparent reasoning
- Collects structured data that improves diagnostic accuracy
- Educates the farmer by revealing what information is relevant

## Prompt Engineering Philosophy

The prompt templates in `lib/ai/prompts.ts` are structured around three principles:

1. **Role anchoring.** The system prompt establishes the AI as an agricultural extension officer with specific domain knowledge. This constrains the model to diagnostic reasoning rather than general chat.
2. **Structured output.** The model is instructed to produce a JSON-shaped response containing diagnosis, confidence, reasoning, actions, and recommendations. This enables typed parsing on the client side.
3. **Clarification before conclusion.** The prompt template instructs the model to ask follow-up questions until it has sufficient information, rather than guessing from minimal input.

Prompt templates are versioned alongside the codebase to track iteration history and regressions.

## Future Roadmap

### Near-term (implementing next)

- [ ] PWA support with service worker caching
- [ ] Image upload for visual symptom analysis
- [ ] Local language support (Swahili, Hindi, Spanish)
- [ ] Voice input for symptom description
- [ ] Multi-turn conversation persistence across sessions
- [ ] MongoDB Atlas Device Sync for IndexedDB ↔ MongoDB reconciliation

### Medium-term

- [ ] Automated evaluation suite with labeled diagnosis test cases
- [ ] Extension officer dashboard for remote consultation triage
- [ ] Offline-first sync engine for IndexedDB → PostgreSQL reconciliation
- [ ] Community-contributed crop and disease knowledge base

### Long-term

- [ ] Fine-tuned Gemma adapter for agricultural domain specialization
- [ ] WebGPU inference via MediaPipe or ONNX runtime
- [ ] SMS-based diagnosis for feature phones
- [ ] Integration with weather and soil data APIs

## Contributing

Contributions are welcome. The project is in early development, so the most impactful contributions are:

- **Bug reports and feature requests** via GitHub Issues
- **Prompt engineering improvements** to the diagnostic conversation flow
- **Testing and evaluation** of model outputs across different crop types
- **Documentation** improvements and translations

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines (coming soon).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with Next.js, React, TypeScript, and Google's Gemma.</sub>
</div>
