# ChatInsight - WhatsApp Analytics Platform

A privacy-first, client-side web application that analyzes WhatsApp customer service chat logs using Google's Gemini AI. Extract insights like lead sources, device types, repair categories, conversion rates, and agent performance - all processed locally in your browser.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/mstrar76/wpp_analizer)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-purple)](https://vitejs.dev/)

## ✨ Features

### 📊 Analytics Dashboard
- **6 Key Performance Indicators**: Total conversations, conversion rate, average quality score, top device, estimated revenue, and average ticket value
- **4 Interactive Charts**: Device breakdown (pie), lead source distribution (pie), common repairs (bar), quality score distribution (histogram)
- **Date Filtering**: Last 7 days, this month, last month, last 30 days, or all time
- **Real-time Updates**: Auto-refreshes as chats are analyzed

### 🤖 AI-Powered Analysis
- **Google Gemini 2.5 Flash**: Advanced AI analysis of every conversation
- **Extracts**: Lead channel, equipment type/model, repair type, negotiation value, conversion status, attendant name, quality score (1-10), and conversation summary
- **Custom Rules**: Define keyword-to-channel mapping rules for accurate attribution
- **Batch Processing**: 3 concurrent analyses with 1-second throttle, respecting API limits

### 💬 Chat Management
- **Advanced Filtering**: Search by name/equipment, filter by status/channel/device/repair
- **Detailed View**: Slide-over panel with chat bubbles and AI insights
- **Status Tracking**: Real-time status indicators (pending, processing, done, failed)
- **JSONL Export**: Download filtered datasets for LLM fine-tuning

### 📁 File Processing
- **Drag & Drop**: Upload multiple WhatsApp .txt export files
- **Smart Parsing**: Supports multiple timestamp formats
- **Multi-line Messages**: Correctly handles multi-line WhatsApp messages
- **Progress Tracking**: Real-time queue statistics and progress bar

### 🔒 Privacy & Security
- **100% Client-Side**: All data stays in your browser (IndexedDB)
- **No Backend**: No data sent to any server except Google Gemini API for analysis
- **Local Storage**: API keys stored securely in browser localStorage
- **No Secrets in Code**: Environment files properly gitignored

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/mstrar76/wpp_analizer.git
cd wpp_analizer

# Install dependencies
npm install

# Create environment file (optional - can configure in app)
cp .env.example .env
# Edit .env and add your VITE_API_KEY=your_key_here

# Start development server
npm run dev
```

The app will open at `http://localhost:5174`

### First-Time Setup

1. **Configure API Key**
   - Navigate to Settings
   - Enter your Google Gemini API key
   - Click "Save & Test" to validate

2. **Add Identification Rules** (Optional)
   - Define keywords for automatic channel attribution
   - Example: "vim do google" → Google Ads

3. **Upload WhatsApp Chats**
   - Go to Upload Data
   - Drag & drop .txt files or click to browse
   - Wait for analysis to complete

4. **View Analytics**
   - Check Dashboard for insights
   - Browse Analyzed Chats for details

## 📱 How to Export WhatsApp Chats

1. Open WhatsApp on your phone
2. Open the chat you want to analyze
3. Tap on the chat/group name at the top
4. Scroll down and tap "Export Chat"
5. Choose "Without Media"
6. Save the .txt file
7. Upload to ChatInsight

## 🏗️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: Google Generative AI (Gemini 2.5 Flash)
- **Database**: IndexedDB (via idb library)
- **Icons**: Lucide React
- **Routing**: React Router DOM

## 📂 Project Structure

```
src/
├── components/        # Reusable UI components
│   └── Layout.tsx    # Sidebar navigation layout
├── pages/            # Route pages
│   ├── Dashboard.tsx # Analytics dashboard
│   ├── Upload.tsx    # File upload interface
│   ├── Chats.tsx     # Chat management & detail view
│   └── SettingsPage.tsx # Configuration
├── services/         # Business logic
│   ├── db.ts         # IndexedDB operations
│   ├── gemini.ts     # AI analysis service
│   └── processingQueue.ts # Batch processing
├── utils/            # Helper functions
│   ├── whatsappParser.ts # Chat parsing
│   └── analytics.ts  # Dashboard calculations
├── hooks/            # Custom React hooks
│   └── useChats.ts   # Chat data management
└── types/            # TypeScript definitions
    └── index.ts      # Type definitions
```

## 🔧 Configuration

### API Key Storage
- Stored in browser's `localStorage` as `gemini_api_key`
- Fallback to `VITE_API_KEY` environment variable
- Can be updated anytime in Settings

### Rate Limiting
- **Batch Size**: 3 concurrent requests
- **Delay**: 1000ms between batches
- **Target**: ~40-50 requests per minute
- **Retries**: 2 attempts for failed analyses

### Database Schema
- **chats**: Stores raw content + analysis results
  - Indexes: by-timestamp, by-status, by-channel
- **rules**: Stores custom identification rules

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server (port 5174)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint
npm run lint
```

## 📊 Data Models

### Chat Analysis Result
```typescript
{
  channel: "Facebook" | "Instagram" | "Google Ads" | "Organic" | "WhatsApp" | "Referral" | "Other",
  equipmentType: "iPhone" | "Mac" | "iPad" | "Android" | "Other",
  equipmentLine: "iPhone 13 Pro" | "MacBook Air M2" | ...,
  repairType: "Screen" | "Battery" | "Board" | "Software" | "Water Damage" | "Other",
  negotiationValue: number | null,
  converted: boolean,
  attendantName: string,
  qualityScore: 1-10,
  qualityReason: string,
  summary: string
}
```

### JSONL Export Format
```jsonl
{"input":"[dd/mm/yy, hh:mm:ss] Sender: Message...","output":"{...analysis...}"}
```

## 🎯 Use Cases

1. **Sales Attribution**: Track which marketing channels generate the most leads
2. **Revenue Analysis**: Monitor negotiation values and average ticket sizes
3. **Agent Performance**: Evaluate service quality and identify training opportunities
4. **Device Trends**: Understand which devices customers need repaired most
5. **Model Fine-Tuning**: Export data to train custom AI models

## 🔒 Security Best Practices

- ✅ API keys never committed to Git
- ✅ `.env` files in `.gitignore`
- ✅ No hardcoded secrets
- ✅ Client-side processing only
- ✅ IndexedDB for local data persistence

## 🚧 Roadmap (Future Enhancements)

- [ ] Direct WhatsApp API integration
- [ ] Multi-user/agent support
- [ ] PDF report generation
- [ ] Period-over-period comparisons
- [ ] Custom AI prompts
- [ ] Export to CSV/Excel
- [ ] Mobile responsive design

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Powered by [Google Gemini AI](https://ai.google.dev/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- Charts by [Recharts](https://recharts.org/)

## 📞 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for tech repair shops and customer service teams**
