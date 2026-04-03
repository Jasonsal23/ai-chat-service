require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const client = new Anthropic();

app.use('/assets', express.static('assets'));
app.use(express.json());
app.use(cors());

// Load all client configs
function loadClient(clientId) {
  const filePath = path.join(__dirname, 'clients', `${clientId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Execute tool based on client config
function executeTool(clientConfig, toolName, toolInput) {
  const handler = clientConfig.toolHandlers?.[toolName];
  if (!handler) return JSON.stringify({ error: 'Unknown tool' });

  if (handler.type === 'static') {
    return JSON.stringify(handler.response);
  }

  if (handler.type === 'log') {
    console.log(`[${clientConfig.id}] Lead collected:`, toolInput);
    return JSON.stringify(handler.response);
  }

  if (handler.type === 'cart_action') {
    return JSON.stringify({ cartAction: { type: 'GERA_ADD_TO_CART', productId: toolInput.productId, variantLabel: toolInput.variantLabel, quantity: toolInput.quantity || 1 }, message: 'Item added to cart' });
  }

  return JSON.stringify({ error: 'Unknown handler type' });
}

// Store sessions
const sessions = {};

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, clientId } = req.body;

    const clientConfig = loadClient(clientId);
    if (!clientConfig) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const sessionKey = `${clientId}-${sessionId}`;
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = [];
    }

    sessions[sessionKey].push({ role: 'user', content: message });

    let response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: clientConfig.systemPrompt,
      tools: clientConfig.tools || [],
      messages: sessions[sessionKey]
    });

    const cartActionsThisTurn = [];

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      sessions[sessionKey].push({ role: 'assistant', content: response.content });

      const toolResults = toolUseBlocks.map(toolUse => {
        console.log(`[${clientConfig.id}] Tool called: ${toolUse.name}`, toolUse.input);
        const result = executeTool(clientConfig, toolUse.name, toolUse.input);
        try { const p = JSON.parse(result); if (p.cartAction) cartActionsThisTurn.push(p.cartAction); } catch(e) {}
        return { type: 'tool_result', tool_use_id: toolUse.id, content: result };
      });

      sessions[sessionKey].push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: clientConfig.systemPrompt,
        tools: clientConfig.tools || [],
        messages: sessions[sessionKey]
      });
    }

    const assistantMessage = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    sessions[sessionKey].push({ role: 'assistant', content: response.content });

    res.json({ reply: assistantMessage, cartActions: cartActionsThisTurn });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Client config endpoint (for the widget to fetch branding)
app.get('/api/config/:clientId', (req, res) => {
  const clientConfig = loadClient(req.params.clientId);
  if (!clientConfig) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({
    id: clientConfig.id,
    name: clientConfig.name,
    brandColor: clientConfig.brandColor,
    logoUrl: clientConfig.logoUrl || null,
    headerTitle: clientConfig.headerTitle,
    headerSubtitle: clientConfig.headerSubtitle,
    welcomeMessage: clientConfig.welcomeMessage
  });
});

// Serve the embeddable widget script
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AI Chat Service running at http://localhost:${PORT}`);
});