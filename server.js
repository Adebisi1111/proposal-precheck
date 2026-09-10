const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xE2cEFCC1C449dBD8BBa32858a09eD72738A6976c';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Immediate health check - no heavy imports
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    contract: CONTRACT_ADDRESS,
    network: 'GenLayer Bradbury',
    has_private_key: !!PRIVATE_KEY
  });
});

app.get('/healthz', (req, res) => {
  res.send('ok');
});

// Precheck - lazy load genlayer-js only when needed
app.post('/api/precheck', async (req, res) => {
  try {
    const { proposal_id, title, description } = req.body;
    if (!proposal_id || !title || !description) {
      return res.status(400).json({ detail: 'proposal_id, title, and description required' });
    }

    if (!PRIVATE_KEY) {
      return res.status(500).json({ detail: 'PRIVATE_KEY not set. Add it in Render Environment.' });
    }

    // Lazy load to avoid startup delay
    const { createClient, chains } = require('genlayer-js');
    const client = createClient({ chain: chains.testnetBradbury, account: PRIVATE_KEY });

    await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'check_proposal',
      args: [proposal_id, title, description],
    });

    // Wait for finalization
    await new Promise(r => setTimeout(r, 10000));

    const check = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_check',
      args: [proposal_id],
    });

    const data = JSON.parse(check);
    res.json({
      proposal_id: data.proposal_id || proposal_id,
      verdict: data.verdict || 'REVIEW',
      reasoning: data.reasoning || 'No reasoning available',
      confidence: data.confidence || 0,
      status: 'success',
      contract: CONTRACT_ADDRESS
    });
  } catch (err) {
    console.error('Precheck error:', err);
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/check/:proposal_id', async (req, res) => {
  try {
    const { createClient, chains } = require('genlayer-js');
    const client = createClient({ chain: chains.testnetBradbury });
    const check = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_check',
      args: [req.params.proposal_id],
    });
    res.json(JSON.parse(check));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { createClient, chains } = require('genlayer-js');
    const client = createClient({ chain: chains.testnetBradbury });
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_checks_count',
      args: [],
    });
    res.json({ total_checks: parseInt(count), contract: CONTRACT_ADDRESS });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
