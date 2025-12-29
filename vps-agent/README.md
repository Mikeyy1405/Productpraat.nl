# 🤖 WritGo.nl AI Agent Runtime (VPS)

## Architectuur

Deze VPS agent runtime is gebaseerd op het **Manus.im CodeAct paradigma** met **Abacus multi-model features**.

```
┌─────────────────────────────────────────────────────────────────┐
│                  WRITGO AI AGENT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  WritGo.nl   │──▶│  VPS Agent   │──▶│     LLM      │         │
│  │   (Next.js)  │   │   Runtime    │   │ Claude Opus/ │         │
│  │              │   │              │   │    Haiku     │         │
│  └──────────────┘   └──────┬───────┘   └──────────────┘         │
│         ▲                  │                                      │
│         │                  │                                      │
│         │          ┌───────┴────────┐                            │
│         │          ▼                ▼                            │
│         │   ┌──────────┐     ┌──────────┐                       │
│         │   │  Docker  │     │  Memory  │                       │
│         │   │ Sandbox  │     │  System  │                       │
│         │   └────┬─────┘     └──────────┘                       │
│         │        │                                                │
│         │   ┌────┴─────────────────┐                            │
│         │   │  Tools:              │                            │
│         │   │  • Python execution  │                            │
│         │   │  • Shell commands    │                            │
│         │   │  • Browser (Playwright)                           │
│         │   │  • Web search        │                            │
│         │   │  • File operations   │                            │
│         │   └──────────────────────┘                            │
│         │                                                         │
│         └─────────────── Webhook ─────────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Kenmerken

### ✅ Manus.im Features
- **CodeAct Paradigma** - Python code als universele actie-taal
- **todo.md Pattern** - File system als extern geheugen voor planning
- **Event Stream Memory** - Append-only context behoud
- **Agent Loop** - Observe → Plan → Act → Check cyclus

### ✅ Abacus Features
- **Multi-Model Routing** - Claude Opus voor complexe, Haiku voor snelle taken
- **Layered Architecture** - Planning → Execution → Memory lagen
- **Reinforcement** - Learn from errors en successen

## Installatie

### Vereisten
- Python 3.11+
- Docker
- Node.js 20+ (voor Playwright)
- 4GB+ RAM (8GB aanbevolen)

### Setup

```bash
cd vps-agent

# Installeer dependencies
pip install -r requirements.txt

# Installeer Playwright browsers
playwright install chromium

# Build Docker sandbox image
docker build -t writgo-agent-sandbox -f Dockerfile.sandbox .

# Configureer environment
cp .env.example .env
# Edit .env met je API keys

# Start agent server
python -m src.main
```

## Usage

### Start Agent Server
```bash
python -m src.main
```

De agent luistert op `http://localhost:8000` voor task requests van WritGo.nl.

### Environment Variables

```bash
# LLM Configuration
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key  # Optional

# WritGo.nl Integration
WRITGO_API_URL=https://writgo.nl
WRITGO_WEBHOOK_SECRET=your-webhook-secret

# Agent Configuration
MAX_ITERATIONS=50
SANDBOX_TIMEOUT=300  # seconds
MODEL_ROUTING=true   # Enable multi-model routing
```

## Architectuur Details

### Agent Loop
```python
while not task_complete:
    # 1. ANALYZE - Analyseer huidige staat
    context = build_context(events, plan)

    # 2. PLAN - Selecteer volgende actie
    action = llm.get_action(context, tools)

    # 3. EXECUTE - Voer actie uit in sandbox
    observation = sandbox.execute(action)

    # 4. OBSERVE - Update event stream
    events.append(action, observation)

    # 5. UPDATE - Update todo.md progress
    update_plan(action, observation)
```

### CodeAct Execution
```python
# Agent genereert Python code als actie:
code = """
import requests
from bs4 import BeautifulSoup

# Scrape competitor pricing
response = requests.get('https://competitor.com/pricing')
soup = BeautifulSoup(response.text, 'html.parser')

prices = soup.find_all('div', class_='price')
save_to_file('competitor_prices.json', prices)
"""

# Sandbox voert code uit in geïsoleerde container
result = sandbox.execute_python(code)
```

### Tools
- `execute_python(code)` - Run Python code
- `shell_command(cmd)` - Execute shell commands
- `browser_navigate(url, action)` - Browser automation
- `web_search(query)` - Search het web
- `save_file(name, content)` - Opslaan naar workspace
- `read_file(name)` - Lezen uit workspace

## Testing

```bash
# Run tests
pytest tests/

# Test specifieke agent taak
python -m tests.test_agent "Zoek de top 5 EVa bedrijven"
```

## Deployment

### Docker Compose (Aanbevolen)
```bash
docker-compose up -d
```

### Render VPS
```bash
# Push naar git
git push origin main

# Render detecteert automatisch en deploy
# Configure environment variables in Render dashboard
```

## Security

- ✅ Docker sandbox isolatie
- ✅ Network restrictions
- ✅ Webhook authentication
- ✅ Resource limits (CPU/Memory)
- ✅ Timeout protection

## Monitoring

Logs worden gestuurd naar:
- `logs/agent.log` - Agent execution logs
- `logs/sandbox.log` - Sandbox output
- WritGo.nl webhook - Status updates

## Troubleshooting

### Agent crasht
```bash
# Check logs
tail -f logs/agent.log

# Restart service
docker-compose restart agent
```

### Sandbox timeout
```bash
# Verhoog timeout in .env
SANDBOX_TIMEOUT=600  # 10 minuten
```

### Memory issues
```bash
# Check Docker memory
docker stats

# Verhoog VPS RAM of verlaag concurrent tasks
```

## Roadmap

- [x] Basic agent loop
- [x] CodeAct execution
- [x] Planner module
- [x] Browser automation
- [ ] Vector DB memory (long-term)
- [ ] Multi-agent orchestration
- [ ] Custom model finetuning
- [ ] Reinforcement learning

---

**Built with:** Python, FastAPI, Docker, Playwright, Claude API
**Inspired by:** Manus.im, Abacus Deep Agent, OpenHands
