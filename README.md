# 🌱 Smart Farm-to-Market AI

### Fair Prices. Smarter Farming. Stronger Rural Communities.

Smart Farm-to-Market AI is an agricultural marketplace and intelligence platform designed to connect farmers directly with buyers, improve price transparency, reduce food waste, and support rural livelihoods through AI-powered assistance.

## 🎯 Problem Statement

Small-scale farmers often face difficulties finding fair prices for their produce, accessing market information, reaching buyers directly, and managing surplus harvests. These challenges can reduce farmers' income and increase food waste.

## 💡 Our Solution

Smart Farm-to-Market AI provides a unified digital platform where farmers can manage crop listings, buyers can discover agricultural products, and users can explore mandi prices and fair-price recommendations.

## ✨ Key Features

- **Farmer Dashboard:** Manage crop listings, inventory, quantities, and asking prices.
- **Buyer Marketplace:** Search agricultural products, compare prices, and place demo orders.
- **Fair Price AI:** Estimate suggested selling prices using available mandi benchmark records and pricing factors.
- **Mandi Price Explorer:** Search and compare agricultural market price observations.
- **Surplus & Waste Management:** Record surplus produce and explore discount or diversion options.
- **AI Farming Assistant:** Ask farming and market-related questions in English, Tamil, or Tanglish, depending on configured AI availability.
- **Order Management:** Track order progress and supported fulfillment statuses.
- **Notifications:** View order and inventory-related notifications.
- **Admin Dashboard:** Review platform activity and available analytics.
- **Bilingual Interface:** English and Tamil support where implemented.

## 🛠️ Technology Stack

The prototype is described as using the following technologies. Confirm these against the actual source code before submission.

- **Frontend:** React, TypeScript, Vite
- **UI and Charts:** Tailwind CSS, Lucide Icons, Recharts
- **Backend:** Node.js and Express-style API routes
- **AI Integration:** Google Gemini API, when configured
- **Market Data:** AGMARKNET / data.gov.in integration, when configured
- **Storage:** File-backed JSON persistence in the prototype, if present

## 🏗️ System Architecture

The application follows a frontend–backend architecture:

1. Users interact with the React web interface.
2. API routes validate requests and apply application rules.
3. The data store maintains supported application records.
4. The market-price service provides available mandi observations.
5. The fair-price module calculates suggested prices from available reference data.
6. The AI assistant uses Gemini when configured and may provide fallback responses when unavailable.
7. Dashboards display listings, orders, surplus records, notifications, and analytics.

See [`docs/architecture.md`](docs/architecture.md) for the technical design and architecture diagram.

## 📊 Data Transparency

Market data is classified as:

- `LIVE_OFFICIAL_DATA` — retrieved successfully from a configured official source.
- `CACHED_OFFICIAL_DATA` — previously retrieved official observations.
- `DEMO_SAMPLE_DATA` — illustrative records used for demonstrations and testing.

Always check the displayed source and observation date. Sample records must not be represented as live market prices. Fair-price recommendations are estimates, not guaranteed selling prices.

## 🚀 Getting Started

### Prerequisites

- Node.js version supported by the project
- npm
- A modern web browser

### Installation

Clone this repository:

```bash
git clone https://github.com/Varsha-5-2006/smart-farm-to-market-ai.git
cd smart-farm-to-market-ai
```

Install dependencies in the directory containing the relevant `package.json`:

```bash
npm install
```

If the project contains separate frontend and backend folders with their own `package.json` files, install dependencies in each folder.

### Environment Configuration

Create a local `.env` file only if required by the application. Use the exact variable names expected by the source code.

Example variables, subject to verification:

```env
GEMINI_API_KEY=
DATA_GOV_IN_API_KEY=
PORT=3000
```

- `GEMINI_API_KEY` may enable Gemini-powered responses.
- `DATA_GOV_IN_API_KEY` may enable a configured official market-data integration.
- `PORT` may configure the backend server.

**Never commit API keys, passwords, database credentials, or `.env` files to GitHub.**

### Run the Application

Use the scripts defined in the project's `package.json`. For example:

```bash
npm run dev
```

The exact command and port depend on the repository's implementation. Refer to the source code and package scripts.

## 🧪 Demo Workflow

1. Open the application.
2. Select the Farmer demo role, if available.
3. Create a sample crop listing.
4. Explore the Fair Price AI recommendation and its data source.
5. Switch to Buyer and search for the listing.
6. Place a demo order using an available quantity.
7. Check the supported order status workflow.
8. Record a surplus entry.
9. Ask the AI assistant a new question in English, Tamil, or Tanglish.
10. Review the Admin dashboard and available metrics.

Only features that have been tested in the current build should be described as verified.

## ✅ Testing

Test cases are documented in [`tests/TEST_CASES.md`](tests/TEST_CASES.md).

Run the build and test commands provided by the actual project configuration. Record the actual results, environment, and date. Tests should not be marked as passed until they have been executed successfully.

## 🌍 Expected Impact

- Improve farmers' access to market information.
- Support more transparent price comparisons.
- Help farmers reach potential buyers directly.
- Encourage better management of surplus produce.
- Support digital inclusion through Tamil and English interfaces.
- Contribute to sustainable agriculture and rural livelihoods.

## 🔐 Security Notes

- Keep API keys and credentials private.
- Use fictional data for demonstrations.
- Verify role permissions and input validation.
- Treat demo checkout as a simulation unless a real payment provider has been integrated and tested.
- Review reliability and data protection before production deployment.

## 📁 Documentation

- [`docs/architecture.md`](docs/architecture.md) — Technical design and architecture.
- [`docs/architecture-diagram.mmd`](docs/architecture-diagram.mmd) — Mermaid architecture diagram source.
- [`sample-data/sample-market-records.json`](sample-data/sample-market-records.json) — Illustrative market records.
- [`tests/TEST_CASES.md`](tests/TEST_CASES.md) — Test scenarios and results.
- [`LICENSE`](LICENSE) — Project license.

## 📄 License

This project is distributed under the license included in the [`LICENSE`](LICENSE) file. Confirm that the license is appropriate for the project and any third-party code or assets before publishing.

---

**Smart Farm-to-Market AI — Empowering Farmers Through Technology.**
