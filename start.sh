#!/bin/bash
# Install dependencies
pip install -r Frontend/backend/requirements.txt
cd Frontend/frontend && npm install && cd ../..

# Start Backend on 8000 (Internal)
cd Frontend/backend && export PORT=8000 && python main.py &

# Start Frontend on 3000 (Exposed via Replit)
cd Frontend/frontend && export PORT=3000 && export BACKEND_URL=http://localhost:8000 && npm run dev
