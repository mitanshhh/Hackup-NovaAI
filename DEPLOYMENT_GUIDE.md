# Deployment Configuration & Guide

I have updated the codebase to remove all hardcoded local URLs and ensure it is fully configurable for deployment on **Replit**, **Render**, or any other cloud provider.

## 🚀 Deployment Instructions for Replit

To run both the **FastAPI Backend** and **Next.js Frontend** in a single Repl, I've created the necessary configuration files.

### 1. Set Environment Variables (Secrets)
In Replit, go to **Tools -> Secrets** and add the following keys:
- `GROQ_API_KEY`: Your Groq API key.
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
- `SECRET_KEY`: A random string for security (sessions/JWT).
- `FRONTEND_URL`: `https://your-repl-name.user.repl.co` (The public URL of your Repl).
- `GOOGLE_REDIRECT_URI`: `https://your-repl-name.user.repl.co/api/auth/google/callback`

### 2. Startup Config
- I have added `replit.nix` to handle the Python and Node environments.
- I have added `.replit` to point to a new `start.sh` script.
- The `start.sh` script will automatically install dependencies and launch both the backend (Port 8000) and the frontend (Port 3000).

---

## 🛠️ Key Code Changes

| File | Changes Made |
| :--- | :--- |
| **`Frontend/backend/main.py`** | Removed hardcoded CORS (`localhost:3000`). Now uses `ALLOWED_ORIGINS` env var or `*`. Uses `PORT` env var for the server. |
| **`Frontend/backend/routers/auth.py`** | Made `GOOGLE_REDIRECT_URI` proxy-aware (using `X-Forwarded-Host`). Replaced `localhost:3000` with `FRONTEND_URL` env var for post-login redirection. |
| **`Frontend/frontend/next.config.ts`** | Replaced hardcoded `localhost:8000` proxy destination with `BACKEND_URL` env var. |
| **`.env.example`** | Created a template for all required environment variables. |
| **`replit.nix` / `.replit`** | Added environment and command configurations for one-click deployment on Replit. |

## 🔗 Redirect URI Management
The "URI mismatch" you were experiencing was likely due to the Google OAuth configuration. 
1. Ensure the `GOOGLE_REDIRECT_URI` you set in Replit matches **EXACTLY** what you have in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. The `redirect_uri` should typically end with `/api/auth/google/callback`.

## 📦 Requirements & Builds
I have verified that all dependencies in `requirements.txt` and `package.json` are standard. The provided `start.sh` handles `pip install` and `npm install` automatically.
