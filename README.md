# Recall Agent Dashboard

A comprehensive web dashboard for managing and monitoring Recall Network competition agents. Built with React and featuring real-time trading, multi-chain balance tracking, and AI-powered chatbot assistance.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)

## Features

### Core Functionality
- **Multi-Chain Balance Tracking** - Monitor token balances across Ethereum, Base, Arbitrum, Optimism, and Polygon
- **Real-Time Trading** - Execute buy/sell trades directly from the dashboard
- **Trade History** - View complete trading history with timestamps and details
- **PnL Monitoring** - Track unrealized profit/loss in real-time
- **Wallet Verification** - Verify wallet ownership via MetaMask or private key signing

### Advanced Features
- **AI Chatbot Assistant** - Natural language trading commands and portfolio analysis
- **Multi-Language Support** - Available in English, Indonesian, and Chinese (EN/ID/ZH)
- **Environment Switching** - Toggle between Sandbox (testing) and Production (live) modes
- **Responsive Design** - Fully optimized for desktop and mobile devices
- **Real-Time Updates** - Auto-refresh data with React Query caching

### Security
- **Secure Local Storage** - API keys stored locally, never sent to external servers
- **Private Key Safety** - Private keys only used for signing, immediately cleared from memory
- **CORS Proxy** - Vercel serverless proxy for secure production API access
- **Environment-Based Config** - Separate sandbox and production endpoints

## Tech Stack

**Frontend:**
- React 18.3
- Vite 7.2
- TailwindCSS 3.4
- React Query (TanStack Query)
- React i18next (internationalization)
- Recharts (data visualization)
- Viem (Ethereum interactions)

**Backend:**
- Vercel Serverless Functions (API proxy)
- Recall Network API

**Deployment:**
- Vercel (auto-deploy from GitHub)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Recall Network API key ([Get one here](https://recall.network))
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/SZtch/recall-dashboard.git
cd recall-dashboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Open in browser**
```
http://localhost:5173
```

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Configuration

### Environment Variables

Create a `.env` file (optional, for chatbot features):

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

### API Endpoints

The dashboard supports two environments:

- **Sandbox**: `https://api.sandbox.competitions.recall.network`
- **Production**: `https://api.competitions.recall.network`

Select your environment on the login screen.

## Usage

### 1. Login

1. Enter your agent name
2. Enter your Recall API key
3. Select environment (Sandbox or Production)
4. Click "Enter Dashboard"

### 2. View Balances

Navigate to the **Balances** tab to see:
- All token balances across supported chains
- USD values for each token
- Total portfolio value

### 3. Execute Trades

**Buy Tab:**
1. Select chain
2. Select token to buy
3. Enter amount
4. Click "Buy"

**Sell Tab:**
1. Select chain
2. Select token to sell
3. Enter amount
4. Click "Sell"

### 4. Monitor Performance

**History Tab:**
- View all past trades
- See from/to tokens and amounts
- Check trade timestamps

**PnL Tab:**
- Track unrealized profit/loss
- View performance metrics

### 5. Verify Wallet

**Method 1: MetaMask**
1. Go to Verify tab
2. Click "Connect Wallet"
3. Sign message in MetaMask

**Method 2: Private Key**
1. Go to Verify tab
2. Select "Manual Private Key"
3. Enter private key (starts with 0x)
4. Click "Verify Wallet"

### 6. AI Chatbot

Click the chat button (bottom right) and try:
- "What's my total portfolio value?"
- "Buy 0.1 ETH on Base"
- "Check BTC price"
- "Show my balances"

### 7. Language Switching

Click the language dropdown (top right) to switch between:
- 🇬🇧 English
- 🇮🇩 Indonesian
- 🇨🇳 Chinese

## Project Structure

```
recall-dashboard/
├── api/
│   └── proxy.js              # Vercel serverless CORS proxy
├── src/
│   ├── api/
│   │   └── backend.js        # Recall API integration
│   ├── components/
│   │   ├── chatbot/
│   │   │   └── ChatbotPanel.jsx
│   │   ├── ApiKeyForm.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── PnlChart.jsx
│   │   └── VerifyWalletPanel.jsx
│   ├── locales/
│   │   ├── en.json           # English translations
│   │   ├── id.json           # Indonesian translations
│   │   └── zh.json           # Chinese translations
│   ├── pages/
│   │   └── Dashboard.jsx     # Main dashboard page
│   ├── utils/
│   │   ├── secureStorage.js  # Secure localStorage wrapper
│   │   └── toast.js          # Toast notifications
│   ├── i18n.js               # i18n configuration
│   ├── App.jsx
│   └── main.jsx
├── public/
├── vercel.json               # Vercel configuration
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## API Documentation

### Recall API Endpoints

All endpoints require `Authorization: Bearer {API_KEY}` header.

**Get Balances**
```
GET /api/agent/balances
```

**Get Trade History**
```
GET /api/agent/trades
```

**Get Unrealized PnL**
```
GET /api/agent/pnl/unrealized
```

**Execute Trade**
```
POST /api/trade/execute
Body: {
  "fromToken": "USDC",
  "toToken": "ETH",
  "fromAmount": "100",
  "fromChain": "base",
  "toChain": "base"
}
```

**Get Nonce (Wallet Verification)**
```
GET /api/auth/agent/nonce
```

**Verify Wallet**
```
POST /api/auth/verify
Body: {
  "message": "VERIFY_WALLET_OWNERSHIP...",
  "signature": "0x..."
}
```

## Deployment

### Deploy to Vercel

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Click "Deploy"

3. **Configure Domain (Optional)**
- Go to Project Settings → Domains
- Add your custom domain
- Update DNS records as instructed

### Deploy to Other Platforms

The app can be deployed to any static hosting platform:
- Netlify
- Cloudflare Pages
- GitHub Pages (with GitHub Actions)

**Build command:** `npm run build`
**Output directory:** `dist`

## Security Notes

⚠️ **Important Security Information:**

1. **API Keys**
   - Stored in browser localStorage only
   - Never transmitted to any server except Recall API
   - Clear browser data to remove stored keys

2. **Private Keys**
   - Only used locally for message signing
   - Never sent over the network
   - Immediately cleared from memory after use
   - Consider using MetaMask instead for better security

3. **CORS Proxy**
   - Vercel serverless function acts as intermediary
   - Only forwards requests to Recall API
   - Does not store or log sensitive data
   - Source code available in `api/proxy.js`

4. **Environment Separation**
   - Always use Sandbox for testing
   - Production environment uses real funds
   - Double-check environment before trading

## Troubleshooting

### CORS Errors in Production

The dashboard uses a Vercel serverless proxy to handle CORS. If you encounter CORS errors:

1. Ensure `vercel.json` excludes `/api/*` from rewrites
2. Check Vercel function logs in dashboard
3. Verify proxy is deployed (check Vercel Functions tab)

### API Key Not Working

1. Verify your API key is correct
2. Check that you selected the right environment (Sandbox vs Production)
3. Ensure API key has necessary permissions

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf dist
npm run build
```

### Chatbot Not Responding

1. Check if VITE_OPENAI_API_KEY is set in environment variables
2. Verify OpenAI API key is valid
3. Check browser console for errors

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Recall Network](https://recall.network) - Trading agent API
- [Vite](https://vitejs.dev) - Build tool
- [TailwindCSS](https://tailwindcss.com) - Styling
- [Vercel](https://vercel.com) - Hosting platform

## Support

For questions or issues:
- Open an issue on [GitHub](https://github.com/SZtch/recall-dashboard/issues)

## Roadmap

- [ ] Add more chain support (Solana, BSC)
- [ ] Advanced charting with historical data
- [ ] Trading strategies automation
- [ ] Portfolio rebalancing tools
- [ ] Export data to CSV/Excel
- [ ] Dark/Light theme toggle
- [ ] Mobile app version

---

**Built with ❤️ for the Recall Network community**
