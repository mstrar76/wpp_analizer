#!/bin/bash

# This script generates a config file with environment variables at runtime
# This allows the application to use environment variables that are set at container runtime

set -e

echo "Generating env-config.js..."

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}",
  VITE_API_KEY: "${VITE_API_KEY}",
  VITE_GEMINI_API_KEY: "${VITE_GEMINI_API_KEY}",
  VITE_OPENAI_API_KEY: "${VITE_OPENAI_API_KEY}",
  VITE_OPENAI_MODEL: "${VITE_OPENAI_MODEL}",
  VITE_XAI_API_KEY: "${VITE_XAI_API_KEY}",
  VITE_XAI_MODEL: "${VITE_XAI_MODEL}",
  VITE_DEEPSEEK_API_KEY: "${VITE_DEEPSEEK_API_KEY}",
  VITE_DEEPSEEK_MODEL: "${VITE_DEEPSEEK_MODEL}",
  VITE_OPENROUTER_API_KEY: "${VITE_OPENROUTER_API_KEY}",
  VITE_OPENROUTER_MODEL: "${VITE_OPENROUTER_MODEL}",
  VITE_GEMINI_APK_API_KEY: "${VITE_GEMINI_APK_API_KEY}",
};
EOF

echo "env-config.js generated successfully."

# Start nginx
exec "$@"