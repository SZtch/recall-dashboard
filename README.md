
# Recall Agent Dashboard

A fast, lightweight dashboard for managing **Recall Network competition agents**—with multi-chain balance tracking, real-time trading, and AI chatbot support.

---

## 🔍 Preview

[![Recall Agent Dashboard Preview](./preview.png)](https://recall-agent-dashboard.vercel.app/)

🔗 **Live Demo:** [https://recall-agent-dashboard.vercel.app/](https://recall-agent-dashboard.vercel.app/)

---

## ✨ Features

* Multi-chain balances (ETH, Base, Arbitrum, Optimism, Polygon)
* Real-time buy/sell trades
* Trade history & PnL
* Wallet verification via MetaMask or private key
* AI chatbot commands (e.g., “Buy 0.1 ETH on Base”)
* Sandbox ↔ Production environment switch
* Multi-language (EN/ID/ZH)
* Fully responsive UI

---

## 🛠 Tech Stack

* React + Vite
* TailwindCSS
* React Query
* Viem
* Vercel Serverless API Proxy

---

🔒 Security

API Keys and Private Keys are stored locally in your browser (localStorage) and never sent to any server.

Private keys are used only for local signing and are immediately cleared from memory afterward.

All sensitive actions happen on your device, and the dashboard communicates directly with the official Recall API.

The Vercel proxy is used only for CORS and stores no data at all.

---

## 📦 Setup

```bash
git clone https://github.com/SZtch/recall-dashboard.git
cd recall-dashboard
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

---

by : SZtch

---
