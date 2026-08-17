# Trading Plan Pro (SNGxJOURNAL)

A professional full-stack trading plan management and analytics platform built with React, TypeScript, Tailwind CSS, Express, and Firebase Cloud Firestore.

---

## 🌟 Key Features

- **Trading Plan Management**: Track daily performance, profit targets, drawdown, ROI, and notes across multi-year trading schedules.
- **Interactive Analytics**: Real-time performance chart visualizations, win/loss stats, monthly breakdowns, and streak trackers.
- **Excel Spreadsheet Export**: Export complete trading history and plans into custom formatted `.xlsx` workbooks.
- **Firebase Authentication & Firestore**: Secure user authentication, access status management, and cloud database persistence.
- **AI Assistant Integration**: Integrated AI trading companion for strategy inquiries and risk management advice.
- **Responsive Theme**: Dark-mode interface engineered for precision and low eye-strain during extended trading sessions.

---

## 📁 Repository Structure

```
├── src/
│   ├── components/
│   │   ├── AIChatbot.tsx        # Floating AI trading assistant interface
│   │   ├── GatewayScreen.tsx    # Authentication and registration gateway
│   │   ├── HostAdminPortal.tsx  # User management and authorization dashboard
│   │   ├── Navbar.tsx           # Application navigation header
│   │   ├── TradingApp.tsx       # Core trading dashboard & analytics view
│   │   └── UnderReviewModal.tsx # Account verification status modal
│   ├── lib/
│   │   └── firebase.ts          # Firebase SDK initialization & Firestore helpers
│   ├── utils/
│   │   └── excelExport.ts       # Spreadsheet export generator (xlsx)
│   ├── App.tsx                  # Main application orchestrator
│   ├── main.tsx                 # React application entry point
│   ├── index.css                # Global styles with Tailwind CSS
│   └── types.ts                 # TypeScript data contracts & interfaces
├── data/
│   └── db.json                  # Local development fallback storage
├── public/                      # Static assets and web manifest
├── firebase-blueprint.json      # Firestore schema blueprint
├── firestore.rules              # Firestore security rules
├── server.ts                    # Express + Vite backend server
├── vite.config.ts               # Vite bundler configuration
├── package.json                 # Dependencies and npm scripts
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/trading-plan-pro.git
   cd trading-plan-pro
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your configuration details in `.env`.

4. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🛠️ Build & Production Deployment

### Build

Compile client assets and server bundle:
```bash
npm run build
```

### Start Production Server

Start the bundled production Node server:
```bash
npm run start
```

---

## 🔒 Firebase Configuration

This app uses Firebase Firestore for authentication and cloud storage.
- Update `src/lib/firebase.ts` with your Firebase project credentials.
- Deploy security rules using Firebase CLI:
  ```bash
  firebase deploy --only firestore:rules
  ```

---

## 📄 License

MIT License - feel free to customize and deploy for your trading needs.
