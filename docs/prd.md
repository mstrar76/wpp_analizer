# Product Requirements Document (PRD)
## ChatInsight - WhatsApp Analytics Platform

**Version:** 1.0
**Status:** Implemented
**Date:** May 2024

---

## 1. Executive Summary
**ChatInsight** is a client-side web application designed to ingest, parse, and analyze WhatsApp customer service chat logs (`.txt` exports). Utilizing Google's **Gemini 2.5 Flash** model, the application categorizes conversations by sales channel, device type, repair category, and negotiation value. It provides a visual dashboard for business intelligence and tools to export data for model fine-tuning.

The application operates entirely in the browser (SPA), ensuring data privacy by storing analysis results locally via IndexedDB, while leveraging the Gemini API for intelligence.

---

## 2. Problem Statement
Service-based businesses (specifically Tech/Repair shops) generate high volumes of WhatsApp conversations. Manually reviewing these to determine:
1.  Where leads come from (Attribution).
2.  Which devices are most commonly repaired.
3.  How much revenue is discussed.
4.  Agent performance quality.

...is time-consuming and error-prone. ChatInsight automates this extraction.

---

## 3. Functional Requirements

### 3.1. Onboarding & Configuration
*   **API Key Management**:
    *   Users must provide a valid Google GenAI API Key.
    *   Key is stored in the browser's `localStorage` for persistence.
    *   Application supports fallback to environment variables (`VITE_API_KEY`) for development.
*   **Custom Identification Rules**:
    *   Users can define "Keyword to Channel" mapping rules to override AI inference.
    *   *Default Rules* are seeded on first load (e.g., "vim do google" -> Google Ads).
    *   **UI**: Inputs for "Phrase/Keyword" and "Channel" dropdown. Capability to Add and Delete rules.

### 3.2. Data Ingestion (Upload)
*   **File Support**: 
    *   Accepts folders containing `.txt` files (WhatsApp export format).
    *   Supports drag-and-drop or file dialog selection.
*   **Parsing Logic**:
    *   Regex-based parsing for standard WhatsApp timestamp formats: `[dd/mm/yy, hh:mm:ss] Sender: Message`.
    *   **Date Extraction**: Automatically extracts the timestamp of the first message to establish the "Chat Date" for filtering.
    *   **Duplicate Handling**: (Implicit) Files are assigned unique IDs upon upload.

### 3.3. AI Analysis Engine
*   **Model**: Google Gemini 2.5 Flash.
*   **Extraction Schema**:
    *   **Channel**: Acquisition source (Facebook, Instagram, Google Ads, Organic, etc.).
    *   **Equipment Type**: High-level category (iPhone, Mac, iPad).
    *   **Equipment Line**: Specific model (e.g., iPhone 13 Pro).
    *   **Repair Type**: Service category (Screen, Battery, Board).
    *   **Negotiation Value**: Numeric monetary value extracted from context (e.g., 250.00).
    *   **Conversion Status**: Boolean (Sold/Converted vs. Not).
    *   **Quality Score**: 1-10 rating of agent performance.
    *   **Summary**: Brief text summary of the interaction.
*   **Context Injection**:
    *   User-defined "Identification Rules" are injected into the system prompt to enforce strict channel attribution.
*   **Batch Processing & Rate Limiting**:
    *   **Batch Size**: 3 concurrent requests.
    *   **Throttle**: 1000ms delay between batches.
    *   **Goal**: Maintain ~40-50 RPM to respect Paid Tier API limits.
    *   **Queue Management**: Status tracking (`pending` -> `processing` -> `done`/`failed`).

### 3.4. Analytics Dashboard
*   **Global Date Filter**:
    *   Presets: Last 7 Days, This Month, Last Month, Last 30 Days, All Time.
    *   Custom: Start Date and End Date pickers.
*   **Interactive Filtering**:
    *   Clicking a slice on the "Device Breakdown" or "Lead Source" chart applies a global filter to the dashboard.
    *   Visual indicators show active filters with a "Clear All" option.
*   **Key Performance Indicators (KPIs)**:
    *   **Total Conversations**: Count of chats in the selected period/filter.
    *   **Conversion Rate**: Percentage of chats marked as `converted: true`.
    *   **Avg. Quality Score**: Mean score (0-10) of agent interactions.
    *   **Top Device**: Most frequent equipment category.
    *   **Est. Revenue**: Sum of all extracted `negotiationValue`.
    *   **Avg. Ticket**: Average `negotiationValue` per conversation.
*   **Visualizations**:
    *   **Device Breakdown**: Pie Chart.
    *   **Lead Source Distribution**: Pie Chart.
    *   **Common Repairs**: Horizontal Bar Chart (Dynamic based on selected Device).
    *   **Quality Distribution**: Bar Chart (Histogram of scores).
*   **Technical Constraint**: Chart animations are disabled (`isAnimationActive={false}`) to ensure compatibility with React 18 Strict Mode.

### 3.5. Chat Management (List View)
*   **Tabular View**:
    *   Columns: File Name, Date, Equipment/Repair, Value, Channel, Score.
    *   Status indicators (Processing, Failed, Done).
*   **Advanced Filtering**:
    *   **Search**: Free text search against File Name, Attendant Name, or Equipment.
    *   **Status Dropdown**: All, Converted, High Quality (>8).
    *   **Channel Dropdown**: Dynamic list based on loaded data.
    *   **Device Dropdown**: Dynamic list based on loaded data.
    *   **Repair Dropdown**: Dynamic list based on loaded data.
*   **Detail View (Slide-over)**:
    *   Full conversation history rendered in a "Chat Bubble" UI.
    *   Colors distinguish "System" messages from user messages.
    *   **AI Insight Card**: Displays extracted metadata (Channel, Device, Repair, Value, Summary) alongside the chat.
*   **Data Export**:
    *   **JSONL Export**: Download filtered dataset formatted for LLM fine-tuning (`input: transcript`, `output: analysis`).

### 3.6. Data Persistence & Management
*   **Local Database**: Uses **IndexedDB** (via `idb` library).
*   **Stores**:
    *   `chats`: Stores raw content + analysis results + timestamps.
    *   `rules`: Stores custom user settings.
*   **Behavior**: Data persists across page reloads and browser restarts.
*   **Reprocess Capability**:
    *   "Reprocess All Data" button in Settings.
    *   Logic: Resets all chats to `pending` status, clears existing analysis, and re-triggers the processing queue using currently active Rules.

---

## 4. Technical Architecture

### 4.1. Tech Stack
*   **Framework**: React 18 (TypeScript).
*   **Build Tool**: Vite.
*   **Styling**: Tailwind CSS (PostCSS).
*   **Visualization**: Recharts.
*   **AI Integration**: `@google/genai` SDK.
*   **Database**: IndexedDB (Browser Native).

### 4.2. Data Models (TypeScript Interfaces)

**RawChatFile**
```typescript
interface RawChatFile {
  id: string;
  fileName: string;
  content: string;
  messages: ChatMessage[]; // { date, sender, content }
  timestamp?: number; // Parsed from first message
}
```

**AnalysisResult**
```typescript
interface AnalysisResult {
  channel: LeadChannel; // Enum
  equipmentType: string;
  equipmentLine: string;
  repairType: string;
  negotiationValue?: number;
  converted: boolean;
  attendantName: string;
  qualityScore: number;
  qualityReason: string;
  summary: string;
}
```

**IdentifierRule**
```typescript
interface IdentifierRule {
  id: string;
  keyword: string;
  channel: LeadChannel;
}
```

---

## 5. Usage Patterns / User Flows

### 5.1. Initial Setup
1.  User opens app.
2.  Navigates to **Settings**.
3.  Enters Gemini API Key -> Clicks Save.
4.  (Optional) Adds specific marketing phrases to "Channel Identification Rules".

### 5.2. Daily Analysis
1.  User exports chats from WhatsApp Web/Desktop as `.txt`.
2.  Navigates to **Data Upload**.
3.  Selects folder containing exports.
4.  System parses files -> Shows progress bar.
5.  System processes files in batches of 3 (1s delay).
6.  User navigates to **Dashboard** to view real-time updates on Revenue and Lead Sources.

### 5.3. Deep Dive & QA
1.  User sees "Low Quality" score on Dashboard.
2.  Navigates to **Analyzed Chats**.
3.  Sorts/Filters by Quality Score.
4.  Clicks a chat to read the transcript and AI summary.
5.  Identifies coaching opportunity for agent.

### 5.4. Campaign Adjustment
1.  User launches a new ad campaign with phrase "Desconto Verão".
2.  Goes to **Settings** -> Adds Rule: "Desconto Verão" = "Instagram".
3.  Clicks **Reprocess All Data**.
4.  Dashboard updates to reflect correct attribution for historical and new chats.

---

## 6. Non-Functional Requirements
*   **Privacy**: No data is sent to any backend server owned by the app developer. Data leaves the browser ONLY to go to Google Gemini API for analysis.
*   **Performance**: Dashboard must render efficiently with 1000+ chats.
*   **Reliability**: Application must handle API errors (429, 500) gracefully by marking chats as 'failed' without crashing the queue.
*   **Responsiveness**: Layout supports Desktop usage (Sidebar navigation).

## 7. Future Roadmap (Out of Scope for v1.0)
*   Direct WhatsApp API integration (removing .txt upload requirement).
*   Multi-agent/Multi-user login support.
*   PDF Report generation.
*   Comparison view (Period over Period).
