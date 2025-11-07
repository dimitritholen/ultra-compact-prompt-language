# Statistics Enhancement Plan - Natural Language Queries + Cost Tracking

## Phase 1: Flexible Time Filtering + Cost Tracking (PRIORITY)

### Goal

Enable natural language time queries AND track actual cost savings in dollars.

**User queries to support:**

- "What did I save this week?"
- "Last 3 days?"
- "Show me January 2025"
- "How much money did I save this month?"

---

## Part A: Flexible Time Filtering ⚡

### Current Limitation

```javascript
// Only 4 fixed periods
period: "today" | "week" | "month" | "all";
```

### Solution: Add Custom Date Range Support

```javascript
get_compression_stats({
  // EXISTING (keep for backward compatibility)
  period: 'today' | 'week' | 'month' | 'all',

  // NEW: Custom date ranges
  startDate?: string,      // ISO date "2025-01-01" OR relative "-7d"
  endDate?: string,        // ISO date "2025-01-06" OR "now"

  // NEW: Simple relative days
  relativeDays?: number,   // Last N days (e.g., 3 for "last 3 days")

  // Existing
  includeDetails: boolean,
  limit: number
})
```

### Implementation

#### 1. Add Date Parser Helper

```javascript
/**
 * Parse flexible date input to Date object
 * Supports:
 * - ISO dates: "2025-01-01"
 * - Relative: "-7d", "-2w", "-1m", "-1y"
 * - Special: "now", "today"
 * - Numbers: treated as relativeDays
 */
function parseFlexibleDate(value) {
  if (!value || value === "now") {
    return new Date();
  }

  if (value === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Relative: "-7d", "-2w", "-1m", "-1y"
  const relativeMatch = value.match(/^-(\d+)(d|w|m|y)$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const multipliers = { d: 1, w: 7, m: 30, y: 365 };
    const days = parseInt(amount) * multipliers[unit];
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // ISO date: "2025-01-01"
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Invalid date format: ${value}`);
}
```

#### 2. Update handleGetStats to Support Custom Ranges

```javascript
async handleGetStats(args) {
  const stats = await loadStats();

  // Determine date range
  let startDate, endDate;
  const now = new Date();

  if (args.startDate || args.endDate || args.relativeDays) {
    // Custom date range
    if (args.relativeDays) {
      startDate = new Date(now.getTime() - args.relativeDays * 24 * 60 * 60 * 1000);
      endDate = now;
    } else {
      startDate = args.startDate ? parseFlexibleDate(args.startDate) : new Date(0);
      endDate = args.endDate ? parseFlexibleDate(args.endDate) : now;
    }
  } else {
    // Legacy period parameter
    switch (args.period || 'all') {
      case 'today':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'all':
        startDate = new Date(0);
        endDate = now;
        break;
    }
  }

  // Filter compressions by date range
  const filteredCompressions = (stats.recent || []).filter(c => {
    const date = new Date(c.timestamp);
    return date >= startDate && date <= endDate;
  });

  // ... rest of existing logic ...
}
```

#### 3. Update Tool Schema

```javascript
{
  name: 'get_compression_stats',
  description: 'Retrieve token and cost savings statistics for code compressions. Supports flexible time queries like "last 3 days", "January 2025", etc.',
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: 'Preset time period (legacy support)',
        oneOf: [
          { const: 'all', title: 'All Time', description: 'All statistics ever recorded' },
          { const: 'today', title: 'Today', description: 'Last 24 hours' },
          { const: 'week', title: 'This Week', description: 'Last 7 days' },
          { const: 'month', title: 'This Month', description: 'Last 30 days' }
        ]
      },
      startDate: {
        type: 'string',
        description: 'Start date for custom range. Formats: "2025-01-01" (ISO), "-7d" (7 days ago), "-2w" (2 weeks ago), "-1m" (1 month ago), "today"'
      },
      endDate: {
        type: 'string',
        description: 'End date for custom range. Formats: "2025-01-31" (ISO), "-1d" (yesterday), "now" (default)'
      },
      relativeDays: {
        type: 'number',
        description: 'Simple way to query last N days. Example: 3 for "last 3 days", 7 for "last week"',
        minimum: 1,
        maximum: 365
      },
      includeDetails: { type: 'boolean', default: false },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
    }
  }
}
```

### Testing Phase 1A

```javascript
// test-flexible-dates.js
testDateParsing("-7d"); // 7 days ago
testDateParsing("-2w"); // 2 weeks ago
testDateParsing("2025-01-01"); // Specific date
testDateParsing("today"); // Today at midnight

testQuery({ relativeDays: 3 }); // Last 3 days
testQuery({ startDate: "2025-01-01", endDate: "2025-01-31" }); // January
testQuery({ startDate: "-7d", endDate: "now" }); // Last week
```

---

## Part B: LLM Detection + Cost Tracking 💰

### Goal

Track which LLM is being used and calculate actual dollar cost savings.

### Challenge: MCP Protocol Doesn't Expose Client Info

The MCP protocol doesn't directly tell us which LLM/client is calling. We need indirect detection.

### Solution: Multi-Method Detection + User Configuration

#### Method 1: Environment Variable Detection (Most Reliable)

```javascript
/**
 * Detect LLM client from environment
 */
function detectLLMClient() {
  // Claude Desktop sets specific env vars
  if (process.env.CLAUDE_DESKTOP_VERSION) {
    return {
      client: "claude-desktop",
      model: "claude-sonnet-4", // Default assumption
    };
  }

  // Claude Code (VS Code extension)
  if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === "vscode") {
    return {
      client: "claude-code",
      model: "claude-sonnet-4",
    };
  }

  // Cline extension
  if (process.env.CLINE_VERSION) {
    return {
      client: "cline",
      model: "claude-sonnet-4", // User configurable
    };
  }

  // Unknown
  return {
    client: "unknown",
    model: "claude-sonnet-4", // Safe default
  };
}
```

#### Method 2: User Configuration (Fallback)

Create config file: `~/.ucpl/compress/config.json`

```json
{
  "defaultModel": "claude-sonnet-4",
  "modelPricing": {
    "claude-sonnet-4": {
      "input": 3.0,
      "output": 15.0
    },
    "claude-opus-4": {
      "input": 15.0,
      "output": 75.0
    },
    "gpt-4o": {
      "input": 2.5,
      "output": 10.0
    }
  }
}
```

#### Method 3: User-Agent Parsing (Future-Proof)

If MCP protocol adds User-Agent headers in future versions, parse it.

### Token Price Storage & Fetching

#### Pricing File Structure

Store pricing in `~/.ucpl/providers/prices.json`:

```json
{
  "providers": {
    "anthropic": {
      "website": "https://www.anthropic.com",
      "models": [
        {
          "name": "claude-sonnet-4",
          "price_url": "https://www.anthropic.com/pricing",
          "input_price": 3.0,
          "output_price": 15.0,
          "per_unit": "1M tokens",
          "currency": "USD"
        },
        {
          "name": "claude-opus-4",
          "price_url": "https://www.anthropic.com/pricing",
          "input_price": 15.0,
          "output_price": 75.0,
          "per_unit": "1M tokens",
          "currency": "USD"
        }
      ]
    },
    "openai": {
      "website": "https://openai.com",
      "models": [
        {
          "name": "gpt-4o",
          "price_url": "https://openai.com/api/pricing/",
          "input_price": 2.5,
          "output_price": 10.0,
          "per_unit": "1M tokens",
          "currency": "USD"
        },
        {
          "name": "gpt-4o-mini",
          "price_url": "https://openai.com/api/pricing/",
          "input_price": 0.15,
          "output_price": 0.6,
          "per_unit": "1M tokens",
          "currency": "USD"
        }
      ]
    }
  },
  "lastUpdate": "2025-01-06T10:30:00Z"
}
```

#### Weekly Price Update System

```javascript
const PRICING_FILE = path.join(
  os.homedir(),
  ".ucpl",
  "providers",
  "prices.json",
);
const PRICE_UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Load pricing data with automatic update check
 */
async function loadPricing() {
  let pricing;

  try {
    const data = await fs.readFile(PRICING_FILE, "utf-8");
    pricing = JSON.parse(data);
  } catch (_error) {
    // No pricing file exists, initialize with defaults
    pricing = await initializeDefaultPricing();
  }

  // Check if prices need updating (> 7 days old)
  const lastUpdate = new Date(pricing.lastUpdate);
  const age = Date.now() - lastUpdate.getTime();

  if (age > PRICE_UPDATE_INTERVAL) {
    console.error("[INFO] Pricing data is > 7 days old, updating...");
    pricing = await updatePricing(pricing);
  }

  return pricing;
}

/**
 * Initialize pricing file with defaults
 */
async function initializeDefaultPricing() {
  const pricing = {
    providers: {
      anthropic: {
        website: "https://www.anthropic.com",
        models: [
          {
            name: "claude-sonnet-4",
            price_url: "https://www.anthropic.com/pricing",
            input_price: 3.0,
            output_price: 15.0,
            per_unit: "1M tokens",
            currency: "USD",
          },
          {
            name: "claude-opus-4",
            price_url: "https://www.anthropic.com/pricing",
            input_price: 15.0,
            output_price: 75.0,
            per_unit: "1M tokens",
            currency: "USD",
          },
        ],
      },
      openai: {
        website: "https://openai.com",
        models: [
          {
            name: "gpt-4o",
            price_url: "https://openai.com/api/pricing/",
            input_price: 2.5,
            output_price: 10.0,
            per_unit: "1M tokens",
            currency: "USD",
          },
          {
            name: "gpt-4o-mini",
            price_url: "https://openai.com/api/pricing/",
            input_price: 0.15,
            output_price: 0.6,
            per_unit: "1M tokens",
            currency: "USD",
          },
        ],
      },
    },
    lastUpdate: new Date().toISOString(),
  };

  // Save to file
  await savePricing(pricing);
  return pricing;
}

/**
 * Update pricing by fetching from URLs in pricing file
 */
async function updatePricing(pricing) {
  console.error("[INFO] Fetching updated pricing from provider websites...");

  // Track which providers we successfully updated
  const updatedProviders = [];

  for (const [providerName, provider] of Object.entries(pricing.providers)) {
    try {
      // Get unique pricing URLs for this provider
      const priceUrls = new Set(provider.models.map((m) => m.price_url));

      for (const url of priceUrls) {
        console.error(`[INFO] Fetching pricing from ${url}...`);

        try {
          const newPrices = await fetchPricingFromURL(url, providerName);

          // Update models with new prices
          for (const model of provider.models) {
            if (model.price_url === url && newPrices[model.name]) {
              const oldInput = model.input_price;
              const oldOutput = model.output_price;

              model.input_price = newPrices[model.name].input_price;
              model.output_price = newPrices[model.name].output_price;

              // Log price changes
              if (
                oldInput !== model.input_price ||
                oldOutput !== model.output_price
              ) {
                console.error(`[INFO] Price change for ${model.name}:`);
                console.error(
                  `       Input: $${oldInput} → $${model.input_price}`,
                );
                console.error(
                  `       Output: $${oldOutput} → $${model.output_price}`,
                );
              }
            }
          }

          updatedProviders.push(providerName);
        } catch (error) {
          console.error(
            `[WARN] Failed to fetch pricing from ${url}: ${error.message}`,
          );
          console.error(`[WARN] Keeping existing prices for ${providerName}`);
        }
      }
    } catch (error) {
      console.error(
        `[ERROR] Failed to update ${providerName} pricing: ${error.message}`,
      );
    }
  }

  // Update timestamp only if at least one provider was updated
  if (updatedProviders.length > 0) {
    pricing.lastUpdate = new Date().toISOString();
    await savePricing(pricing);
    console.error(
      `[INFO] Successfully updated pricing for: ${updatedProviders.join(", ")}`,
    );
  } else {
    console.error("[WARN] No providers were updated, keeping old prices");
  }

  return pricing;
}

/**
 * Fetch pricing from a provider URL
 */
async function fetchPricingFromURL(url, providerName) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // Parse pricing based on provider
  switch (providerName) {
    case "anthropic":
      return parseAnthropicPricing(html);
    case "openai":
      return parseOpenAIPricing(html);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Parse Anthropic pricing from HTML
 */
function parseAnthropicPricing(html) {
  // Parse the pricing table from Anthropic's website
  // This is a simplified example - actual implementation needs robust parsing
  const prices = {};

  // Look for pricing patterns in HTML
  // Example: "Claude Sonnet 4.0" ... "$3.00" ... "$15.00"
  const sonnetMatch = html.match(
    /Claude.*?Sonnet.*?4.*?(\d+\.?\d*).*?(\d+\.?\d*)/i,
  );
  if (sonnetMatch) {
    prices["claude-sonnet-4"] = {
      input_price: parseFloat(sonnetMatch[1]),
      output_price: parseFloat(sonnetMatch[2]),
    };
  }

  const opusMatch = html.match(
    /Claude.*?Opus.*?4.*?(\d+\.?\d*).*?(\d+\.?\d*)/i,
  );
  if (opusMatch) {
    prices["claude-opus-4"] = {
      input_price: parseFloat(opusMatch[1]),
      output_price: parseFloat(opusMatch[2]),
    };
  }

  // If parsing fails, throw error to use cached prices
  if (Object.keys(prices).length === 0) {
    throw new Error("Failed to parse pricing data from HTML");
  }

  return prices;
}

/**
 * Parse OpenAI pricing from HTML
 */
function parseOpenAIPricing(html) {
  const prices = {};

  // Parse OpenAI pricing (similar pattern)
  const gpt4oMatch = html.match(/GPT-4o.*?(\d+\.?\d*).*?(\d+\.?\d*)/i);
  if (gpt4oMatch) {
    prices["gpt-4o"] = {
      input_price: parseFloat(gpt4oMatch[1]),
      output_price: parseFloat(gpt4oMatch[2]),
    };
  }

  const gpt4oMiniMatch = html.match(
    /GPT-4o.*?mini.*?(\d+\.?\d*).*?(\d+\.?\d*)/i,
  );
  if (gpt4oMiniMatch) {
    prices["gpt-4o-mini"] = {
      input_price: parseFloat(gpt4oMiniMatch[1]),
      output_price: parseFloat(gpt4oMiniMatch[2]),
    };
  }

  if (Object.keys(prices).length === 0) {
    throw new Error("Failed to parse pricing data from HTML");
  }

  return prices;
}

/**
 * Save pricing to file
 */
async function savePricing(pricing) {
  const pricingDir = path.dirname(PRICING_FILE);
  await fs.mkdir(pricingDir, { recursive: true });
  await fs.writeFile(PRICING_FILE, JSON.stringify(pricing, null, 2), "utf-8");
}

/**
 * Get pricing for a specific model
 */
function getModelPricing(pricing, modelName) {
  for (const provider of Object.values(pricing.providers)) {
    for (const model of provider.models) {
      if (model.name === modelName) {
        return {
          input_price: model.input_price,
          output_price: model.output_price,
          per_unit: model.per_unit,
          currency: model.currency,
        };
      }
    }
  }

  // Default if model not found
  console.error(
    `[WARN] Model '${modelName}' not found in pricing, using defaults`,
  );
  return {
    input_price: 3.0,
    output_price: 15.0,
    per_unit: "1M tokens",
    currency: "USD",
  };
}
```

### Cost Calculation

```javascript
/**
 * Calculate cost savings for a compression
 */
function calculateCostSavings(compression, pricingData) {
  const tokensSaved = compression.tokensSaved;
  const model = compression.model || "claude-sonnet-4";

  // Get pricing for this model
  const pricing = getModelPricing(pricingData, model);

  // Tokens saved = input tokens saved (we didn't send them)
  // Per million tokens (MTok)
  const pricePerMillion = pricing.input_price;
  const costSavingsUSD = (tokensSaved / 1_000_000) * pricePerMillion;

  return {
    tokensSaved,
    costSavingsUSD: Math.round(costSavingsUSD * 100) / 100, // Round to cents
    model,
    pricePerMTok: pricePerMillion,
    currency: pricing.currency,
    perUnit: pricing.per_unit,
  };
}
```

### Enhanced Stats Storage

Update compression record to include cost data:

```javascript
const record = {
  timestamp: new Date().toISOString(),
  path,
  originalTokens,
  compressedTokens,
  tokensSaved,
  compressionRatio: Math.round(compressionRatio * 1000) / 1000,
  savingsPercentage: Math.round(savingsPercentage * 10) / 10,
  level,
  format,

  // NEW: LLM and cost tracking
  model: detectedModel, // 'claude-sonnet-4'
  client: detectedClient, // 'claude-desktop'
  pricePerMTok: pricing.input_price, // 3.00
  costSavingsUSD: calculatedCost, // 0.15
  currency: pricing.currency, // 'USD'
};
```

### Enhanced Stats Output

```javascript
{
  summary: {
    totalCompressions: 145,
    totalOriginalTokens: 1_234_567,
    totalCompressedTokens: 308_642,
    totalTokensSaved: 925_925,
    averageCompressionRatio: 0.25,
    averageSavingsPercentage: 75.0,

    // NEW: Cost savings
    totalCostSavingsUSD: 2.78,           // $2.78 saved
    averageCostSavingsPerCompression: 0.019,  // $0.019 per compression
    modelBreakdown: {
      'claude-sonnet-4': {
        compressions: 140,
        tokensSaved: 900_000,
        costSavingsUSD: 2.70
      },
      'claude-opus-4': {
        compressions: 5,
        tokensSaved: 25_925,
        costSavingsUSD: 0.39
      }
    }
  },

  // Storage breakdown unchanged
  storageBreakdown: { ... }
}
```

### User Experience

```
User: "How much money did I save this month?"

Claude: [calls get_compression_stats({ period: 'month' })]

Response:
## Compression Statistics (Last 30 Days)

**Token Savings:**
- Total Compressions: 145
- Tokens Saved: 925,925
- Average Compression: 75% reduction

**💰 Cost Savings:**
- Total Savings: $2.78 USD
- Average per Compression: $0.02
- Based on Claude Sonnet 4 pricing ($3/MTok input)

**Model Breakdown:**
- Claude Sonnet 4: $2.70 (140 compressions)
- Claude Opus 4: $0.39 (5 compressions)
```

---

## Implementation Steps

### Step 1: Add Date Parsing (30 min)

- [ ] Add `parseFlexibleDate()` helper
- [ ] Add tests for date parsing
- [ ] Update tool schema with new parameters

### Step 2: Update Stats Query (45 min)

- [ ] Modify `handleGetStats()` to support custom dates
- [ ] Test with various date formats
- [ ] Ensure backward compatibility with `period` param

### Step 3: LLM Detection (1 hour)

- [ ] Add `detectLLMClient()` function
- [ ] Test in Claude Desktop
- [ ] Test in Claude Code
- [ ] Add fallback configuration

### Step 4: Pricing System with Weekly Updates (2 hours)

- [ ] Create `~/.ucpl/providers/` directory structure
- [ ] Add `initializeDefaultPricing()` to create `prices.json`
- [ ] Implement `loadPricing()` with 7-day check
- [ ] Add `updatePricing()` to fetch from URLs in pricing file
- [ ] Implement `parseAnthropicPricing()` HTML parser
- [ ] Implement `parseOpenAIPricing()` HTML parser
- [ ] Add `getModelPricing()` lookup helper
- [ ] Handle fetch failures gracefully (keep old prices)
- [ ] Log price changes when detected

### Step 5: Cost Tracking (1 hour)

- [ ] Add model/client/cost fields to compression record
- [ ] Update `recordCompression()` to include cost data
- [ ] Migrate existing stats (add model: 'claude-sonnet-4' default)
- [ ] Calculate cost on compression using pricing data

### Step 6: Enhanced Output (45 min)

- [ ] Add cost summary to stats output
- [ ] Add model breakdown with costs
- [ ] Format currency (USD)
- [ ] Update output schema

### Step 7: Testing (1.5 hours)

- [ ] Test flexible date queries
- [ ] Test cost calculations with different models
- [ ] Test model detection in different clients
- [ ] Test pricing initialization and weekly updates
- [ ] Test price fetching and parsing
- [ ] Test fallback when fetch fails
- [ ] Integration tests

### Step 8: Documentation (30 min)

- [ ] Update README with cost tracking feature
- [ ] Add examples of natural language queries
- [ ] Document `prices.json` structure
- [ ] Document how to manually add models/providers
- [ ] Add troubleshooting guide

**Total Estimated Time: 7-8 hours**

---

## Testing Plan

### Unit Tests

```javascript
// test-date-parsing.js
test('Parse relative dates', () => {
  assert(parseFlexibleDate('-7d') is 7 days ago);
  assert(parseFlexibleDate('-2w') is 14 days ago);
  assert(parseFlexibleDate('today') is today at midnight);
});

// test-cost-calculation.js
test('Calculate cost savings', () => {
  const compression = { tokensSaved: 100_000 };
  const pricing = { 'claude-sonnet-4': { input: 3.00 } };
  const cost = calculateCostSavings(compression, pricing);
  assert(cost.costSavingsUSD === 0.30);
});

// test-llm-detection.js
test('Detect Claude Desktop', () => {
  process.env.CLAUDE_DESKTOP_VERSION = '1.0';
  const detected = detectLLMClient();
  assert(detected.client === 'claude-desktop');
});
```

### Integration Tests

```bash
# Test natural language queries
"What did I save in the last 3 days?"
→ Should call { relativeDays: 3 }

"Show me January 2025"
→ Should call { startDate: '2025-01-01', endDate: '2025-01-31' }

"How much money did I save this week?"
→ Should return cost savings in USD
```

---

## Configuration and Pricing Management

### Pricing File: `~/.ucpl/providers/prices.json`

This file is auto-generated on first run and auto-updated weekly:

```json
{
  "providers": {
    "anthropic": {
      "website": "https://www.anthropic.com",
      "models": [
        {
          "name": "claude-sonnet-4",
          "price_url": "https://www.anthropic.com/pricing",
          "input_price": 3.0,
          "output_price": 15.0,
          "per_unit": "1M tokens",
          "currency": "USD"
        }
      ]
    },
    "openai": {
      "website": "https://openai.com",
      "models": [
        {
          "name": "gpt-4o",
          "price_url": "https://openai.com/api/pricing/",
          "input_price": 2.5,
          "output_price": 10.0,
          "per_unit": "1M tokens",
          "currency": "USD"
        }
      ]
    }
  },
  "lastUpdate": "2025-01-06T10:30:00Z"
}
```

### Manual Price/Model Management

Users can manually edit `prices.json` to:

1. **Add custom models:**

```json
{
  "name": "my-custom-model",
  "price_url": "https://provider.com/pricing",
  "input_price": 5.0,
  "output_price": 20.0,
  "per_unit": "1M tokens",
  "currency": "USD"
}
```

2. **Override detected prices** (won't be overwritten until next weekly update)

3. **Add new providers:**

```json
"anthropic": { ... },
"openai": { ... },
"google": {
  "website": "https://ai.google.dev",
  "models": [
    {
      "name": "gemini-pro",
      "price_url": "https://ai.google.dev/pricing",
      "input_price": 0.50,
      "output_price": 1.50,
      "per_unit": "1M tokens",
      "currency": "USD"
    }
  ]
}
```

### Optional Config File: `~/.ucpl/compress/config.json`

For model detection override:

```json
{
  "version": "1.0",
  "defaultModel": "claude-sonnet-4",
  "forceModel": "claude-opus-4"
}
```

---

## Pricing Fetching Strategy

### Weekly Auto-Update System

1. **On MCP server startup**: Check `lastUpdate` in `prices.json`
2. **If > 7 days old**: Trigger automatic price update
3. **Fetch from URLs**: Use `price_url` from each model definition
4. **Parse HTML**: Extract pricing from provider websites
5. **Update prices**: Only update successfully fetched prices
6. **Log changes**: Console log any price changes detected
7. **Save timestamp**: Update `lastUpdate` to current time

### Anthropic Pricing

- **Source:** https://www.anthropic.com/pricing
- **Method:** HTML parsing (no public API)
- **Update:** Weekly (7 days)
- **Fallback:** Keep existing prices if fetch fails

### OpenAI Pricing

- **Source:** https://openai.com/api/pricing/
- **Method:** HTML parsing
- **Update:** Weekly (7 days)
- **Fallback:** Keep existing prices if fetch fails

### Pricing Update Behavior

- ✅ Logs price changes to console
- ✅ Keeps old prices if fetch fails
- ✅ Updates only successfully fetched providers
- ✅ Won't update if all fetches fail
- ✅ Respects manual edits (until next weekly update)

### Resilience Strategy

```
Fetch fails → Log warning → Keep cached prices → Try again in 7 days
Network down → Use existing prices → No crash
Parse fails → Use existing prices → No crash
New model added manually → Skip in weekly update → Keep user's price
```

---

## Future Enhancements (Post-Phase 1)

### Phase 2: Project & Path Filtering

- Track project name/path with each compression
- Filter by project: "Show me savings for myapp"
- Filter by path: "Show me savings for src/components"
- Group by project

### Phase 3: Comparisons & Trends

- Compare periods: "Compare this week vs last week"
- Show trends: "Is my usage increasing?"
- Cost projections: "At this rate, I'll save $X this year"

### Phase 4: Advanced Analytics

- Cost savings by project
- ROI calculation (compression time vs cost savings)
- Most valuable compressions (highest savings)
- Compression efficiency trends

---

## Success Criteria

✅ Users can query "last 3 days", "January 2025", etc.
✅ Cost savings are calculated and displayed in USD
✅ LLM model is detected automatically
✅ Pricing is fetched and cached
✅ Backward compatible with existing stats
✅ All tests pass
✅ Documentation is updated

---

## Open Questions

**Q: Should we support multiple currencies?**

- A: Start with USD only, add if requested

**Q: Should we track output tokens too?**

- A: No, we only save input tokens (by not sending them)

**Q: What if pricing API is down?**

- A: Use cached prices, fallback to hardcoded defaults

**Q: Should we alert users when prices change?**

- A: Yes, log to console when prices update

**Q: How to handle custom/fine-tuned models?**

- A: Allow user configuration in config.json
