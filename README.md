# Sales Investigator

> **AI sales investigator that turns revenue anomalies into root-cause insights and actionable recommendations.**

Sales Investigator is an AI-powered sales intelligence application designed to help teams investigate unusual changes in sales performance, understand potential root causes, and determine what actions should be taken next.

Instead of simply showing charts and numbers, Sales Investigator helps answer:

* **What changed?**
* **Why did it change?**
* **What is likely causing the problem?**
* **What should we do next?**

## ✨ Features

### 📊 Sales Performance Analysis

Analyze sales performance across products, regions, channels, and time periods.

### 🚨 Anomaly Detection

Identify unusual changes in revenue, sales volume, conversion, and other key sales metrics.

### 🔎 Root-Cause Investigation

Go beyond the anomaly and investigate contributing factors behind the change.

### 🤖 AI-Powered Insights

Use AI to transform structured sales data into contextual business insights.

### 💡 Actionable Recommendations

Generate recommended next steps based on the detected situation.

### 📈 Investigation Dashboard

View critical alerts, positive trends, investigation status, and supporting evidence in a single interface.

## 🧠 How It Works

```text
Sales Data
    │
    ▼
┌─────────────────────┐
│ Performance Analysis│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Anomaly Detection   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Root-Cause Analysis │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ AI Investigation    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Recommendations     │
└─────────────────────┘
```

The system combines deterministic analysis with AI reasoning.

Deterministic logic identifies measurable patterns and potential investigation candidates, while the AI layer interprets the available evidence and produces human-readable insights and recommendations.

## 🎯 Example Investigation

**Detected situation**

> Revenue declined significantly in the Electronics category.

**Investigation**

The system examines related signals such as:

* Sales volume
* Product performance
* Regional performance
* Channel performance
* Historical trends
* Conversion changes

**Insight**

> The decline is primarily associated with reduced sales volume in the online channel, concentrated in the Electronics category.

**Recommendation**

> Investigate the online channel for pricing, inventory availability, and campaign performance before increasing promotional spending.

## 🏗️ Architecture

```text
┌───────────────┐
│   Sales Data  │
└───────┬───────┘
        │
        ▼
┌─────────────────────┐
│ Investigation Engine│
│                     │
│ • Anomaly Detection │
│ • Causal Signals    │
│ • Evidence Analysis │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      AI Layer       │
│                     │
│ • Insight Generation│
│ • Root Cause        │
│ • Recommendations   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Investigation UI    │
└─────────────────────┘
```

## 🛠️ Tech Stack

* **Next.js**
* **TypeScript**
* **Tailwind CSS**
* **PostgreSQL**
* **Prisma**
* **AI / LLM API**
* **Vercel** / compatible deployment platform

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

## 🔐 Environment Variables

| Variable       | Description                    |
| -------------- | ------------------------------ |
| `DATABASE_URL` | PostgreSQL database connection |
| `AI_API_KEY`   | API key for the AI provider    |

> Never commit `.env` or other files containing API credentials.

## 🧪 Development

Run the development server:

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

Start production build:

```bash
npm run start
```

## 🗺️ Roadmap

* [x] Sales performance dashboard
* [x] Anomaly investigation workflow
* [x] Root-cause analysis logic
* [x] AI-generated insights
* [x] Actionable recommendations
* [ ] Automated data ingestion
* [ ] More sales dimensions and metrics
* [ ] Investigation history
* [ ] Team collaboration
* [ ] Advanced forecasting

## 💡 Why Sales Investigator?

Traditional sales dashboards tell you **what happened**.

Sales Investigator is designed to help answer **why it happened and what to do next**.

```text
Traditional BI

Data → Dashboard → Human Investigation


Sales Investigator

Data → Detection → Investigation → Insight → Action
```

## 🏆 Hackathon Project

Sales Investigator was built as a hackathon project focused on applying AI to practical sales and business intelligence workflows.

The goal is to demonstrate how AI can move beyond generic summaries and become an investigation layer that connects **business signals → evidence → reasoning → action**.

## 📄 License

This project is currently provided for demonstration and hackathon purposes.
