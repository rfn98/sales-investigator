# Sales Investigator

> **AI Investigation Engine for Sales & Inventory — turn sales anomalies into evidence-backed actions.**

Sales Investigator is an AI-powered sales intelligence application that helps teams investigate unusual changes in sales performance, understand the evidence behind those changes, and determine what to investigate or do next.

Instead of stopping at charts and anomaly alerts, Sales Investigator follows an investigation flow:

**Signal → Evidence → Hypothesis → Confidence → Action**

It separates deterministic analytics from AI reasoning so that measurable facts remain grounded in the underlying data while the AI interprets available evidence without inventing unsupported causes.

## ✨ Features

### 📊 Deterministic Sales Analysis

Analyze revenue performance across outlets, products, and time periods using deterministic calculations.

### 🚨 Revenue Anomaly Detection

Identify significant revenue declines and growth signals by comparing the current analysis window against a historical baseline.

### 🔎 Evidence-Based Investigation

Investigate revenue anomalies using supporting evidence such as inventory availability, stockouts, product-level sales signals, and other available data.

### 🤖 AI Investigation

Use AI to interpret deterministic evidence, evaluate possible explanations, identify evidence gaps, and produce an investigation verdict.

### 📐 Evidence Coverage

Quantify how much of an anomaly is supported by the available evidence while keeping the remaining unexplained impact visible.

### 💡 Actionable Recommendations

Generate prioritized next steps based on the evidence and unresolved areas of the investigation.

### 📈 Investigation Dashboard

Monitor revenue anomalies, inventory signals, growth opportunities, supporting evidence, and investigation priorities from a single interface.

---

## 🧠 How It Works

Sales Investigator separates **measurement** from **reasoning**.

```text
                 DETERMINISTIC
                     LAYER

Sales Data
    │
    ▼
┌─────────────────────────┐
│ Performance Analysis    │
│                         │
│ • Current period        │
│ • Historical baseline   │
│ • Revenue change        │
│ • Revenue impact        │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Anomaly Detection       │
│                         │
│ • Decline signals       │
│ • Growth signals        │
│ • Severity              │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Evidence Extraction     │
│                         │
│ • Stockouts             │
│ • Product signals       │
│ • Sales patterns        │
└────────────┬────────────┘
             │
             ▼
                 AI
                 LAYER
             │
             ▼
┌─────────────────────────┐
│ Investigation Engine    │
│                         │
│ • Evidence evaluation   │
│ • Hypothesis analysis   │
│ • Evidence coverage     │
│ • Evidence gaps         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Recommendations          │
│                         │
│ • Priority actions      │
│ • Recovery opportunities│
│ • Next investigation    │
└─────────────────────────┘
```

### The separation matters

**Deterministic analytics** answers:

> **What happened?**

For example:

* Revenue declined by 42.7%.
* Current daily revenue is below the historical baseline.
* Stockouts occurred for specific SKUs.
* Zero sales during a stockout period were verified where supported by the data.

**AI investigation** answers:

> **Why might it have happened?**

The AI evaluates the available evidence and classifies hypotheses as:

* **CONFIRMED** — directly supported by available evidence.
* **POSSIBLE** — plausible, but insufficiently supported.
* **UNVERIFIED** — the required evidence is unavailable.

This prevents the system from presenting assumptions as facts.

---

## 🎯 Example Investigation

### Signal

> **Bekasi revenue declined 42.7% during the analysis window.**

The system first establishes the anomaly deterministically using the current period and historical baseline.

### Evidence

The investigation then examines available evidence:

* Inventory availability
* Verified stockout events
* Affected SKUs
* Product-level sales signals
* Zero-sales periods

### Hypothesis

For example:

```text
CONFIRMED
Inventory availability
Verified stockouts and observed zero-sales periods
```

```text
POSSIBLE
Demand / operations
Revenue decline remains partially unexplained
```

```text
UNVERIFIED
Pricing / promotion
Pricing and promotion data is unavailable
```

### Investigation Coverage

The system estimates how much of the revenue decline is supported by the available evidence.

The remaining portion is explicitly shown as **unresolved** rather than attributed to an unsupported cause.

> Attribution is an estimate based on the available deterministic evidence. It does not establish that a single factor explains the full revenue decline.

### Recommendation

Instead of automatically claiming a root cause, Sales Investigator can recommend:

> Prioritize replenishment for affected SKUs and investigate the remaining unexplained decline through pricing, promotion, demand, and operational evidence.

---

## 🏗️ Architecture

```text
┌──────────────────────┐
│      Sales Data      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Deterministic        │
│ Analytics Engine     │
│                      │
│ • Revenue analysis   │
│ • Baseline comparison│
│ • Anomaly detection  │
│ • Severity           │
│ • Evidence extraction│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Investigation Input  │
│                      │
│ Signal + Evidence    │
│ + Context + Gaps     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ AI Investigation     │
│                      │
│ • Evidence reasoning │
│ • Hypotheses         │
│ • Coverage           │
│ • Unresolved impact  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Recommendation Engine│
│                      │
│ • Prioritized actions│
│ • Investigation areas│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Investigation UI     │
└──────────────────────┘
```

### Core principle

> **The AI does not determine the numbers. It investigates the evidence.**

Deterministic analytics provides the measurable foundation. The AI layer reasons over that foundation and communicates uncertainty when evidence is incomplete.

---

## 🛠️ Tech Stack

* **Next.js**
* **TypeScript**
* **Tailwind CSS**
* **PostgreSQL**
* **Prisma**
* **AI / LLM API**
* **Vercel** / compatible deployment platform

---

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

* Node.js 22+
* npm
* PostgreSQL

### Installation

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd sales-investigator
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Configure the required environment variables.

Example:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sales_investigator"

AI_API_KEY="your-api-key"
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 📁 Project Structure

```text
sales-investigator/
├── app/
│   ├── ...
│
├── components/
│   ├── ...
│
├── lib/
│   ├── ai/
│   │   ├── buildInput.ts
│   │   ├── prompts.ts
│   │   └── recommendations.ts
│   │
│   ├── analytics/
│   │   └── ...
│   │
│   └── ...
│
├── prisma/
│   └── schema.prisma
│
├── public/
├── .env.example
├── package.json
└── README.md
```

---

## 🔐 Environment Variables

| Variable       | Description                            |
| -------------- | -------------------------------------- |
| `DATABASE_URL` | PostgreSQL database connection         |
| `AI_API_KEY`   | API key for the configured AI provider |

> Never commit `.env` or other files containing API credentials.

---

## 🧪 Development

Start the development server:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

Start the production build:

```bash
npm run start
```

### Analytics Validation

Sales Investigator includes an independent audit for its deterministic analytics engine.

```bash
npm run analytics:audit
```

This helps verify that analytical invariants remain consistent as the application evolves.

---

## 🗺️ Roadmap

* [x] Sales performance dashboard
* [x] Deterministic revenue anomaly detection
* [x] Evidence extraction
* [x] Anomaly investigation workflow
* [x] AI-generated investigation verdicts
* [x] Evidence coverage
* [x] Evidence gap detection
* [x] Actionable recommendations
* [ ] Automated data ingestion
* [ ] More sales dimensions and metrics
* [ ] Investigation history
* [ ] Team collaboration
* [ ] Advanced forecasting

---

## 💡 Why Sales Investigator?

Traditional BI tools are excellent at showing **what happened**.

But when an anomaly appears, the next question is usually:

> **Why?**

That investigation often requires manually comparing dashboards, spreadsheets, inventory records, and other operational data.

Sales Investigator adds an investigation layer between the dashboard and the decision.

```text
Traditional BI

Data → Dashboard → Human Investigation


Sales Investigator

Data
  ↓
Detection
  ↓
Evidence
  ↓
AI Investigation
  ↓
Insight
  ↓
Action
```

The goal is not to make unsupported causal claims.

The goal is to make investigations **faster, more transparent, and evidence-backed**.

---

## 🧩 Investigation Philosophy

Sales Investigator is built around four principles:

### 1. Facts before explanations

Measured signals come from deterministic analytics.

### 2. Evidence before attribution

The system only attributes an anomaly to evidence that actually supports the hypothesis.

### 3. Uncertainty is explicit

Possible explanations and missing evidence are surfaced instead of being presented as facts.

### 4. Unresolved impact stays visible

When the available evidence cannot explain the entire anomaly, the remaining impact is explicitly shown as unresolved.

> **An unexplained problem is better than a confidently wrong explanation.**

---

## 🏆 Hackathon Project

Sales Investigator was built as a hackathon project focused on applying AI to practical sales and business intelligence workflows.

The project explores how AI can move beyond generic summaries and become an **investigation layer** that connects:

```text
Business Signal
      ↓
Evidence
      ↓
Reasoning
      ↓
Confidence
      ↓
Action
```

The central idea is simple:

> **Don't just tell users that sales changed. Help them investigate the evidence behind the change.**

---

## 📄 License

This project is currently provided for demonstration and hackathon purposes.
