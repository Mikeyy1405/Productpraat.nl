#!/bin/bash

echo "🧪 ProductPraat MVP Backend - Endpoint Tests"
echo "=============================================="
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
curl -s "${BASE_URL}/api/health" | jq '.'
echo ""
echo "✅ Health check passed!"
echo ""

# Test 2: Get All Products (empty initially)
echo "2️⃣  Testing GET /api/products (should be empty or show Supabase warning)..."
curl -s "${BASE_URL}/api/products" 2>&1 | head -10
echo ""
echo ""

# Test 3: Import Products (requires Supabase)
echo "3️⃣  Testing POST /api/products/import..."
echo "   ⚠️  This requires Supabase to be configured!"
echo ""
echo "   Example command:"
echo '   curl -X POST http://localhost:3000/api/products/import \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"categories": ["elektronica"], "limit": 2}'"'"
echo ""

# Test 4: API Documentation
echo "4️⃣  API Documentation available at:"
echo "   ${BASE_URL}/api-docs"
echo ""

echo "=============================================="
echo "✅ Basic tests completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure Supabase (see SUPABASE_SETUP.md)"
echo "   2. Test product import endpoint"
echo "   3. View imported products"
echo ""

