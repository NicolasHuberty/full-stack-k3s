#!/bin/bash

# Test query to local dev server
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "message": "abus de droit",
    "collectionId": "cmhxblm5p00018001iwvrwdxq",
    "agentId": "lawyer-agent-1",
    "actionState": {
      "smart_mode": true,
      "translator_mode": true
    },
    "model": "gpt-4o-mini"
  }' | jq '.chunks | length'
