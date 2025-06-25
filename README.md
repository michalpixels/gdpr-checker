# GDPR Checker 🛡️

Nástroj na kontrolu GDPR compliance webových stránok. Automaticky kontroluje prítomnosť kľúčových GDPR elementov a poskytuje hodnotenie compliance spolu s odporúčaniami na zlepšenie.

## Funkcie

- ✅ **Cookie Banner Detection** - Detekcia cookie bannerov a súhlasov
- ✅ **Privacy Policy Check** - Kontrola prítomnosti zásad ochrany údajov
- ✅ **Cookie Policy Verification** - Overenie cookie policy
- ✅ **Contact Information** - Kontrola dostupnosti kontaktných údajov
- ✅ **Cookie Analysis** - Analýza používaných cookies
- ✅ **Scoring System** - Bodovanie GDPR compliance (0-100%)
- ✅ **Recommendations** - Konkrétne odporúčania na zlepšenie

## Nasadenie na Railway

### 1. Príprava projektu

```bash
# Klonujte alebo vytvorte nový projekt
git clone <your-repo-url>
cd gdpr-checker

# Vytvorte súbory podľa artifacts vyššie
```

### 2. Nasadenie na Railway

1. **Cez GitHub:**
   - Pushni kód na GitHub
   - Pripoj Railway k GitHub repo
   - Railway automaticky detekuje Dockerfile

2. **Cez Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```

3. **Cez Web Dashboard:**
   - Choď na railway.app
   - "New Project" → "Deploy from GitHub repo"
   - Vyber svoj repository

### 3. Konfigurácia

Railway automaticky:
- Detekuje `Dockerfile`
- Nastaví port z `process.env.PORT`
- Spustí healthcheck na `/api/health`

## Lokálne spustenie

```bash
# Inštalácia závislostí
npm install

# Spustenie v development móde
npm run dev

# Alebo production
npm start
```

Aplikácia bude dostupná na `http://localhost:3000`

## Použitie

1. Otvor webovú aplikáciu
2. Zadaj URL webstránky, ktorú chceš skontrolovať
3. Klikni "Skontrolovať GDPR Compliance"
4. Počkaj na výsledky (môže trvať 10-30 sekúnd)
5. Prezri si skóre a odporúčania

## API Endpoints

### POST `/api/check`
Skontroluje GDPR compliance pre zadanú URL.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "timestamp": "2025-06-24T10:00:00Z",
  "score": 85,
  "checks": {
    "cookieBanner": {
      "found": true,
      "score": 100,
      "elements": [...]
    },
    "privacyPolicy": {
      "found": true,
      "score": 100,
      "links": [...]
    }
  },
  "recommendations": [
    {
      "priority": "MEDIUM",
      "message": "Zvážte zníženie počtu cookies"
    }
  ]
}
```

### GET `/api/health`
Health check endpoint pre Railway.

## Kontrolované elementy

### 1. Cookie Banner (30% váha)
- Hľadá cookie bannery pomocou selektorov
- Detekuje kľúčové slová: "cookie", "súhlas", "consent", "gdpr"
- Kontroluje viditeľnosť elementov

### 2. Privacy Policy (25% váha)
- Hľadá odkazy na zásady ochrany údajov
- Podporované názvy: "privacy", "ochrana-udajov", "gdpr"
- Kontroluje prítomnosť v navigácii a footeri

### 3. Cookie Policy (20% váha)
- Detekuje špecifické cookie policy
- Hľadá odkazy obsahujúce "cookie", "cookies"

### 4. Contact Information (15% váha)
- Kontroluje email adresy (mailto linky)
- Hľadá kontaktné sekcie
- Overuje dostupnosť kontaktu na správcu údajov

### 5. Cookies Analysis (10% váha)
- Počíta aktívne cookies
- Hodnotí bezpečnostné nastavenia
- Kontroluje HttpOnly, Secure, SameSite atribúty

## Hodnotenie

- **80-100%**: Výborné GDPR compliance
- **60-79%**: Dobré compliance, menšie zlepšenia potrebné
- **0-59%**: Potrebuje významné zlepšenie

## Technické detaily

- **Backend**: Node.js + Express
- **Web Scraping**: Puppeteer + Cheerio
- **Frontend**: Vanilla JavaScript + moderný CSS
- **Deployment**: Docker + Railway
- **Dependencies**: Minimálne, production-ready

## Bezpečnosť

- Timeouty pre dlho načítavajúce stránky
- Sandbox pre Puppeteer
- Input validácia pre URLs
- Error handling
- Memory management

## Limitácie

- Kontroluje len verejne dostupné stránky
- Nemôže analyzovať JavaScript-rendered obsah v plnej miere
- Neoveruje legálnu stránku privacy policy (len prítomnosť)
- Časový limit 30 sekúnd pre kontrolu

## Rozšírenia

Môžeš pridať:
- Kontrolu CCPA compliance
- Viac jazykov (EN, DE, FR)
- Export výsledkov do PDF
- Batch kontrolu viacerých URLs
- Integráciu s webhookmi
- Databázu histórie kontrol

## Troubleshooting

**Puppeteer nefunguje na Railway:**
- Dockerfile už obsahuje potrebné flagy
- `--no-sandbox --disable-setuid-sandbox`

**Časové limity:**
- Zvýš timeout v kóde ak potrebuješ
- Railway má limit 10 minút na request

**Memory issues:**
- Railway poskytuje 512MB RAM v free tier
- Puppeteer je optimalizovaný pre nízku spotrebu

## Podpora

Pre problémy s nasadením alebo funkčnosťou:
1. Skontroluj Railway logs
2. Otestuj lokálne
3. Overuj network connectivity

## Príklady použitia

### Základná kontrola
```bash
curl -X POST https://your-app.railway.app/api/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Batch kontrola (môžeš rozšíriť)
```javascript
const urls = [
  'https://site1.com',
  'https://site2.com',
  'https://site3.com'
];

for (const url of urls) {
  const response = await fetch('/api/check', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url})
  });
  const result = await response.json();
  console.log(`${url}: ${result.score}%`);
}
```

## Štruktúra projektu

```
gdpr-checker/
├── server.js              # Hlavný server súbor
├── package.json           # NPM dependencies
├── Dockerfile            # Docker konfigurácia
├── railway.json          # Railway nasadenie
├── .dockerignore         # Docker ignore súbory
├── README.md             # Tento súbor
└── public/
    └── index.html        # Frontend aplikácia
```

## Environment Variables

Railway automaticky nastavuje:
- `PORT` - port na ktorom beží aplikácia
- `NODE_ENV` - production/development

Môžeš pridať vlastné:
```bash
# V Railway dashboard → Variables
TIMEOUT_MS=30000          # Timeout pre kontroly
MAX_CONCURRENT_CHECKS=5   # Max súbežných kontrol
DEBUG_MODE=false          # Debug logging
```

## Monitoring a Logs

### Railway Dashboard
- Real-time logs
- CPU/Memory usage
- Request metrics
- Deployment history

### Custom Monitoring
```javascript
// Pridaj do server.js
app.get('/api/stats', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks_performed: checkCounter,
    last_check: lastCheckTime
  });
});
```

## Performance Optimizations

### Browser Pool (rozšírenie)
```javascript
// Namiesto jedného browser instance
class BrowserPool {
  constructor(size = 3) {
    this.browsers = [];
    this.size = size;
  }
  
  async getBrowser() {
    // Implementácia pool managementu
  }
}
```

### Caching (rozšírenie)
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour

app.post('/api/check', async (req, res) => {
  const cacheKey = req.body.url;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  
  // Vykonaj kontrolu...
  cache.set(cacheKey, results);
});
```

## Časté problémy a riešenia

### 1. Puppeteer timeout
```
Error: Navigation timeout of 30000 ms exceeded
```
**Riešenie:**
- Zvýš timeout v `page.goto()`
- Pridaj retry mechanizmus
- Použij `waitUntil: 'domcontentloaded'`

### 2. Memory limit na Railway
```
Error: Cannot allocate memory
```
**Riešenie:**
- Zatváraj browser pages po použití
- Použi `--max-old-space-size=400` flag
- Implementuj browser pool s limitom

### 3. CORS issues
```
Access-Control-Allow-Origin error
```
**Riešenie:**
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

### 4. SSL certificate errors
```
Error: self signed certificate
```
**Riešenie:**
```javascript
await page.goto(url, {
  waitUntil: 'networkidle2',
  timeout: 30000,
  ignoreHTTPSErrors: true
});
```

## Bezpečnostné odporúčania

### Input Sanitization
```javascript
const validator = require('validator');

app.post('/api/check', (req, res) => {
  const { url } = req.body;
  
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  })) {
    return res.status(400).json({error: 'Invalid URL'});
  }
});
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP
  message: 'Too many requests, try again later'
});

app.use('/api/', limiter);
```

## Licencia

MIT License - môžeš voľne používať, upravovať a distribuovať.

## Contributing

1. Fork repository
2. Vytvor feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Otvor Pull Request

## Changelog

### v1.0.0 (2025-06-24)
- ✨ Základná GDPR kontrola
- 🎨 Moderný web interface
- 🐳 Docker support
- 🚀 Railway deployment ready
- 📱 Responsive design
- 🇸🇰 Slovenská lokalizácia

### Plánované features
- [ ] Multi-language support (EN, DE, FR)
- [ ] PDF export výsledkov
- [ ] Webhook notifikácie
- [ ] Databáza histórie
- [ ] CCPA compliance check
- [ ] Scheduled checks
- [ ] Email reports

---

**Vytvoril:** GDPR Checker Tool  
**Posledná aktualizácia:** 24.6.2025  
**Verzia:** 1.0.0