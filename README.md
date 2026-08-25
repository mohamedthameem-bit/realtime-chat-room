# 💬 ChatRoom — Real-Time Chat Application

A production-quality real-time chat room built with **Node.js + Express**, **MongoDB + Mongoose**, **Socket.IO**, and a vanilla **HTML/CSS/JavaScript** frontend.

---

## ✨ Features

- 🚀 **Real-time messaging** via Socket.IO (WebSockets)
- 🗄️ **Persistent messages** stored in MongoDB (loads last 50 on join)
- 👥 **Live online users** panel with instant join/leave notifications
- 🎨 **Modern dark UI** — responsive, works on mobile ≥ 320px and desktop
- 🔒 **XSS-safe** — all user content is HTML-escaped before rendering
- ✅ **Validation** on both client and server (username, message length)
- 🔄 **Auto-reconnect** with visible connection status
- 🏷️ **Duplicate username handling** — auto-appends suffix (e.g. `alice-2`)
- 📱 **Collapsible sidebar** on mobile, persistent on desktop
- ⌨️ **Typing indicator** shows when others are typing

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A MongoDB instance (local **or** [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) — see below)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd chatroom
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set your values:

```env
MONGODB_URI=mongodb://localhost:27017/chatroom
PORT=3000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### 3. Run in Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🍃 MongoDB Atlas Setup

If you don't have a local MongoDB, use the free cloud tier:

1. **Create an account** at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Create a Cluster**
   - Click **"Build a Database"** → choose **M0 Free Tier**
   - Select a cloud provider and region → click **"Create"**
3. **Create a Database User**
   - Go to **Database Access** → **Add New Database User**
   - Choose **Password** authentication, set a username and strong password
   - Role: **"Read and write to any database"**
4. **Allowlist your IP**
   - Go to **Network Access** → **Add IP Address**
   - For development: click **"Allow Access From Anywhere"** (`0.0.0.0/0`)
   - For production: add only your server's IP
5. **Get the Connection String**
   - Go to **Clusters** → **Connect** → **Connect your application**
   - Copy the string, it looks like:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials
   - Add your database name before `?`:
     ```
     mongodb+srv://alice:mypass@cluster0.xxxxx.mongodb.net/chatroom?retryWrites=true&w=majority
     ```
6. **Paste into `.env`**:
   ```env
   MONGODB_URI=mongodb+srv://alice:mypass@cluster0.xxxxx.mongodb.net/chatroom?retryWrites=true&w=majority
   ```

---

## 📁 Project Structure

```
chatroom/
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
├── README.md
│
├── server/               # Node.js backend
│   ├── server.js         # Entry point — Express + Socket.IO setup
│   ├── config/
│   │   ├── db.js         # MongoDB connection with lifecycle logging
│   │   └── env.js        # Env variable loading & validation
│   ├── models/
│   │   └── Message.js    # Mongoose schema (username, message, room, createdAt)
│   ├── middleware/
│   │   ├── errorHandler.js  # Global Express error handler
│   │   └── validate.js      # Shared validation helpers
│   ├── controllers/
│   │   └── messageController.js  # REST API handlers
│   ├── routes/
│   │   └── api.js        # /api/health and /api/messages/:room
│   └── socket/
│       └── handlers.js   # All Socket.IO event logic & presence tracking
│
└── public/               # Static frontend (served by Express)
    ├── index.html        # Join / welcome page
    ├── chat.html         # Main chat room
    ├── css/
    │   └── style.css     # Full dark-theme design system
    └── js/
        ├── join.js       # Join page logic & validation
        └── chat.js       # Chat client — sockets, rendering, UI
```

---

## 🔌 API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server + DB status check |
| `GET` | `/api/messages/:room` | Last 50 messages for a room |

### Socket.IO Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ username, room }` | Join a chat room |
| `leave-room` | — | Explicitly leave the current room |
| `send-message` | `{ message }` | Send a chat message |
| `typing` | `{ username }` | Notify others that you're typing |
| `stop-typing` | `{ username }` | Notify others that you stopped typing |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `receive-message` | `{ username, message, room, createdAt }` | New chat message |
| `recent-messages` | `Message[]` | Last 50 messages on join |
| `user-joined` | `{ username, room, message, createdAt }` | System: user joined |
| `user-left` | `{ username, room, message, createdAt }` | System: user left |
| `online-users` | `{ room, users: string[] }` | Updated online users list |
| `username-changed` | `{ original, assigned, message }` | Server assigned a different username |
| `error-message` | `{ error }` | Validation or server error |
| `typing` | `{ username }` | Someone is typing |
| `stop-typing` | `{ username }` | Someone stopped typing |

---

## 🚢 Deploying

### Backend (Render / Railway)

1. **Push to GitHub**
2. Create a new **Web Service** on [Render](https://render.com) or [Railway](https://railway.app)
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add environment variables in the platform dashboard:
   - `MONGODB_URI` — your Atlas connection string
   - `PORT` — usually set automatically by the platform
   - `CORS_ORIGIN` — your frontend URL (same as backend URL if serving static files)
   - `NODE_ENV` — `production`

### Notes
- The backend serves the `public/` folder as static files, so you **don't need a separate frontend host**.
- Socket.IO works out of the box on Render and Railway (both support WebSockets).
- Make sure your MongoDB Atlas IP allowlist includes `0.0.0.0/0` for cloud deployments (or the specific egress IPs of your hosting provider).

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `npm start` | Start for production |

---

## 🛡️ Security Notes

- All user-supplied content is HTML-escaped before rendering — prevents XSS.
- `helmet` middleware sets secure HTTP headers.
- CORS is restricted to `CORS_ORIGIN` from your `.env`.
- Validation runs on **both** client and server (never trust client input alone).
- No authentication system — username is chosen freely per session.

---

## 📄 License

MIT
