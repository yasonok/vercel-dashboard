#!/bin/bash
# Dashboard Auto-Deploy Script

echo "🚀 Deploying Dashboard to Vercel..."

cd "$(dirname "$0")"

npx vercel deploy --prod --yes

echo "✅ Deployment complete!"
echo "🌐 https://vercel-dashboard-omega.vercel.app"
