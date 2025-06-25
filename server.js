// Enhanced server.js with comprehensive debugging and error fixes

const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(120000, () => { // Increased timeout
    const err = new Error('Request Timeout');
    err.status = 408;
    next(err);
  });
  next();
});

// Enhanced GDPR kontrolné pravidlá
const GDPR_CHECKS = {
  cookieBanner: {
    name: 'Cookie Banner',
    selectors: [
      '[id*="cookie"]',
      '[class*="cookie"]',
      '[id*="consent"]',
      '[class*="consent"]',
      '[data-consent]',
      '.cookie-notice',
      '.cookie-banner',
      '#cookie-policy',
      '.gdpr-banner',
      '[class*="gdpr"]'
    ],
    keywords: ['cookie', 'súhlas', 'consent', 'gdpr', 'ochrana údajov', 'privacy', 'cookies policy']
  },
  privacyPolicy: {
    name: 'Privacy Policy',
    links: [
      'privacy',
      'ochrana-udajov',
      'ochrana-osobnych-udajov',
      'zasady-ochrany',
      'gdpr',
      'privacy-policy',
      'osobne-udaje'
    ],
    keywords: ['privacy policy', 'ochrana údajov', 'ochrana osobných údajov', 'zásady ochrany', 'gdpr']
  },
  cookiePolicy: {
    name: 'Cookie Policy',
    links: [
      'cookie',
      'cookies',
      'cookie-policy',
      'zasady-cookies',
      'cookies-policy'
    ],
    keywords: ['cookie policy', 'zásady cookies', 'o cookies', 'cookies information']
  },
  contactInfo: {
    name: 'Contact Information',
    selectors: [
      '[href^="mailto:"]',
      '[class*="contact"]',
      '[id*="contact"]',
      '[class*="email"]',
      '[id*="email"]'
    ],
    keywords: ['kontakt', 'contact', 'email', '@', 'tel:', 'phone']
  }
};

// Common tracking/analytics services that should require consent
const TRACKING_SERVICES = {
  'google-analytics': {
    patterns: ['google-analytics.com', 'googletagmanager.com', 'gtag', '_ga', '_gid', '_gat'],
    name: 'Google Analytics',
    category: 'analytics'
  },
  'facebook-pixel': {
    patterns: ['facebook.com/tr', 'connect.facebook.net', 'fbq', '_fbp', '_fbc'],
    name: 'Facebook Pixel',
    category: 'marketing'
  },
  'google-ads': {
    patterns: ['googleadservices.com', 'googlesyndication.com', '_gcl_'],
    name: 'Google Ads',
    category: 'advertising'
  },
  'hotjar': {
    patterns: ['hotjar.com', '_hjid', '_hjIncludedInSample'],
    name: 'Hotjar',
    category: 'analytics'
  },
  'youtube': {
    patterns: ['youtube.com/embed', 'ytimg.com', 'VISITOR_INFO1_LIVE', 'YSC'],
    name: 'YouTube Embedded',
    category: 'media'
  }
};

class GDPRChecker {
  constructor() {
    this.browser = null;
    this.maxRetries = 2; // Reduced retries
    this.debug = true; // Enable debugging
  }

  log(message, data = null) {
    if (this.debug) {
      console.log(`[GDPR-DEBUG] ${message}`, data || '');
    }
  }

  async initBrowser() {
    if (!this.browser) {
      try {
        this.log('Initializing browser...');
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-default-apps',
            '--single-process', // Important for some environments
            '--no-zygote'
          ],
          timeout: 60000, // Increased timeout
          // REMOVE THIS LINE or ensure it's undefined:
          // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });
        this.log('Browser initialized successfully');
      } catch (error) {
        this.log('Failed to launch browser:', error.message);
        throw new Error(`Browser initialization failed: ${error.message}`);
      }
    }
    return this.browser;
  }

  async waitForDelay(page, ms) {
    try {
      await new Promise(resolve => setTimeout(resolve, ms));
    } catch (error) {
      this.log('Wait delay failed:', error.message);
    }
  }

  async checkUrl(url, retryCount = 0) {
    let browser = null;
    let page = null;

    try {
      this.log(`Starting URL check: ${url} (attempt ${retryCount + 1})`);

      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }

      // 🚀 Launch fresh browser per check
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--single-process',
          '--no-zygote'
        ],
        timeout: 60000
      });

      page = await browser.newPage();

      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(30000);
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });

      const networkRequests = [];
      const cookies = [];

      page.on('request', (req) => {
        networkRequests.push({
          url: req.url(),
          type: req.resourceType(),
          timestamp: Date.now()
        });
      });

      page.on('response', async (res) => {
        try {
          const setCookieHeader = res.headers()['set-cookie'];
          if (setCookieHeader) {
            cookies.push({
              url: res.url(),
              cookies: setCookieHeader,
              timestamp: Date.now()
            });
          }
        } catch {}
      });

      const startTime = Date.now();
      this.log('Navigating to URL...');
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (!response) throw new Error('No response received from the page');

      const status = response.status();
      this.log(`Response status: ${status}`);
      if (status >= 400) throw new Error(`HTTP ${status}: ${response.statusText()}`);

      const afterLoadTime = Date.now();
      this.log(`Page loaded in ${afterLoadTime - startTime}ms`);

      this.log('Waiting for dynamic content...');
      await this.waitForDelay(page, 3000);

      const results = {
        url,
        timestamp: new Date().toISOString(),
        checks: {},
        score: 0,
        recommendations: [],
        debug: {
          loadTime: afterLoadTime - startTime,
          networkRequests: networkRequests.length,
          retryCount
        }
      };

      const content = await page.content();
      const $ = cheerio.load(content);
      const preConsentCookies = await page.cookies();

      this.log('Running cookie banner check...');
      results.checks.cookieBanner = await this.checkCookieBanner(page, $);

      this.log('Running privacy policy check...');
      results.checks.privacyPolicy = await this.checkPrivacyPolicy(page, $);

      this.log('Running cookie policy check...');
      results.checks.cookiePolicy = await this.checkCookiePolicy(page, $);

      this.log('Running contact info check...');
      results.checks.contactInfo = await this.checkContactInfo(page, $);

      this.log('Running SSL check...');
      results.checks.ssl = await this.checkSSL(url);

      this.log('Running cookies check...');
      results.checks.cookies = await this.checkCookies(page);

      this.log('Running pre-consent violations check...');
      results.checks.preConsentViolations = await this.checkPreConsentViolations(
        preConsentCookies, networkRequests, content, startTime, afterLoadTime
      );

      results.thirdPartyServices = results.checks?.preConsentViolations?.trackingServices || [];

      this.log('Calculating final score...');
      results.score = this.calculateScore(results.checks);
      results.recommendations = this.generateRecommendations(results.checks);

      this.log('Final results:', {
        score: results.score,
        recommendationsCount: results.recommendations.length
      });

      return results;
    } catch (error) {
      this.log(`Error checking URL (attempt ${retryCount + 1}):`, error.message);

      if (retryCount < this.maxRetries) {
        this.log(`Retrying... (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(3000 * (retryCount + 1));
        return this.checkUrl(url, retryCount + 1);
      }

      return {
        url,
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: {},
        score: 0,
        recommendations: [{
          priority: 'ERROR',
          message: `Chyba pri kontrole: ${error.message}`
        }],
        debug: {
          failed: true,
          retryCount,
          error: error.message
        }
      };
    } finally {
      try {
        if (page && !page.isClosed()) {
          await page.close();
          this.log('Page closed successfully');
        }
      } catch (err) {
        this.log('Error closing page:', err.message);
      }

      try {
        if (browser) {
          await browser.close();
          this.log('Browser closed successfully');
        }
      } catch (err) {
        this.log('Error closing browser:', err.message);
      }
    }
  }

  async checkPreConsentViolations(cookies, networkRequests, htmlContent, startTime, endTime) {
    const result = {
      found: false,
      violations: [],
      score: 100,
      totalCookies: cookies.length,
      trackingServices: []
    };

    try {
      this.log(`Checking pre-consent violations: ${cookies.length} cookies, ${networkRequests.length} requests`);
      
      // Check for cookies set immediately on page load
      const problematicCookies = cookies.filter(cookie => {
        const essentialPatterns = [
          'session', 'csrf', 'xsrf', 'auth', 'login', 'security',
          'lang', 'language', 'timezone', 'currency', 'theme', 'wordpress',
          'wp-', 'phpsessid'
        ];

        const cookieName = (cookie.name || '').toLowerCase();
        const isEssential = essentialPatterns.some(pattern => 
          cookieName.includes(pattern.toLowerCase())
        );

        return !isEssential;
      });

      // Check network requests for tracking services
      const trackingRequests = [];
      networkRequests.forEach(request => {
        for (const [serviceId, service] of Object.entries(TRACKING_SERVICES)) {
          if (service.patterns.some(pattern => request.url.toLowerCase().includes(pattern.toLowerCase()))) {
            trackingRequests.push({
              service: service.name,
              category: service.category,
              url: request.url,
              type: request.type
            });
            
            if (!result.trackingServices.find(s => s.name === service.name)) {
              result.trackingServices.push({
                name: service.name,
                category: service.category,
                detected: true
              });
            }
          }
        }
      });

      // Analyze violations
      if (problematicCookies.length > 0) {
        result.found = true;
        result.violations.push({
          type: 'pre-consent-cookies',
          severity: 'HIGH',
          message: `${problematicCookies.length} cookies nastavených pred súhlasom`,
          details: problematicCookies.map(c => ({
            name: c.name,
            domain: c.domain,
            secure: c.secure,
            httpOnly: c.httpOnly
          }))
        });
      }

      if (trackingRequests.length > 0) {
        result.found = true;
        result.violations.push({
          type: 'tracking-requests',
          severity: 'HIGH',
          message: `${trackingRequests.length} tracking požiadaviek pred súhlasom`,
          details: trackingRequests
        });
      }

      // Calculate score based on violations
      if (result.found) {
        let penalty = 0;
        penalty += problematicCookies.length * 15;
        penalty += trackingRequests.length * 10;
        
        result.score = Math.max(0, 100 - penalty);
      }

      this.log('Pre-consent violations result:', result);
    } catch (error) {
      this.log('Error in checkPreConsentViolations:', error.message);
      result.score = 50;
    }

    return result;
  }

  async checkCookieBanner(page, $) {
    const result = { found: false, elements: [], score: 0 };

    try {
      // Check for visible cookie banners
      for (const selector of GDPR_CHECKS.cookieBanner.selectors) {
        try {
          const elements = $(selector);
          if (elements.length > 0) {
            elements.each((i, el) => {
              const text = $(el).text().toLowerCase();
              if (text.length > 10) {
                result.found = true;
                result.elements.push({
                  selector,
                  text: text.substring(0, 100),
                  visible: true
                });
              }
            });
          }
        } catch (e) {
          this.log(`Error checking selector ${selector}:`, e.message);
        }
      }

      // Check for keywords in body text
      const bodyText = $('body').text().toLowerCase();
      for (const keyword of GDPR_CHECKS.cookieBanner.keywords) {
        if (bodyText.includes(keyword.toLowerCase())) {
          result.found = true;
          break;
        }
      }

      result.score = result.found ? 100 : 0;
    } catch (error) {
      this.log('Error in checkCookieBanner:', error.message);
      result.score = 0;
    }

    return result;
  }

  async checkPrivacyPolicy(page, $) {
    const result = { found: false, links: [], score: 0 };

    try {
      $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        
        for (const link of GDPR_CHECKS.privacyPolicy.links) {
          if (href.toLowerCase().includes(link) || text.includes(link)) {
            result.found = true;
            result.links.push({
              href,
              text: $(el).text().trim(),
              type: 'privacy-policy'
            });
            break;
          }
        }
      });

      result.score = result.found ? 100 : 0;
    } catch (error) {
      this.log('Error in checkPrivacyPolicy:', error.message);
      result.score = 0;
    }

    return result;
  }

  async checkCookiePolicy(page, $) {
    const result = { found: false, links: [], score: 0 };

    try {
      $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        
        for (const link of GDPR_CHECKS.cookiePolicy.links) {
          if (href.toLowerCase().includes(link) || text.includes(link)) {
            result.found = true;
            result.links.push({
              href,
              text: $(el).text().trim(),
              type: 'cookie-policy'
            });
            break;
          }
        }
      });

      result.score = result.found ? 80 : 0;
    } catch (error) {
      this.log('Error in checkCookiePolicy:', error.message);
      result.score = 0;
    }

    return result;
  }

  async checkContactInfo(page, $) {
    const result = { found: false, contacts: [], score: 0 };

    try {
      // Check for email addresses
      $('a[href^="mailto:"]').each((i, el) => {
        result.found = true;
        result.contacts.push({
          type: 'email',
          value: $(el).attr('href').replace('mailto:', ''),
          text: $(el).text().trim()
        });
      });

      // Check for phone numbers
      $('a[href^="tel:"]').each((i, el) => {
        result.found = true;
        result.contacts.push({
          type: 'phone',
          value: $(el).attr('href').replace('tel:', ''),
          text: $(el).text().trim()
        });
      });

      // Check for contact sections
      for (const selector of GDPR_CHECKS.contactInfo.selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          result.found = true;
        }
      }

      result.score = result.found ? 80 : 0;
    } catch (error) {
      this.log('Error in checkContactInfo:', error.message);
      result.score = 0;
    }

    return result;
  }

  async checkSSL(url) {
      const result = { valid: false, details: '' };

      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
          result.details = 'Stránka nepoužíva HTTPS protokol.';
          return result;
        }

        const tls = require('tls');
        const net = require('net');

        const host = parsedUrl.hostname;
        const port = 443;

        return new Promise((resolve) => {
          const socket = tls.connect(
            {
              host,
              port,
              servername: host,
              rejectUnauthorized: false,
            },
            () => {
              const cert = socket.getPeerCertificate();
              const valid = socket.authorized || cert.valid_to;

              if (cert && cert.valid_to) {
                const now = new Date();
                const expiry = new Date(cert.valid_to);
                result.valid = expiry > now;
                result.details = result.valid
                  ? `Platný do ${expiry.toLocaleDateString()}`
                  : `Certifikát expiroval ${expiry.toLocaleDateString()}`;
              } else {
                result.details = 'Certifikát nebol nájdený alebo je neplatný.';
              }

              socket.end();
              resolve(result);
            }
          );

          socket.on('error', (err) => {
            result.details = `Chyba pri kontrole SSL: ${err.message}`;
            resolve(result);
          });
        });
      } catch (err) {
        result.details = `Výnimka pri kontrole SSL: ${err.message}`;
        return result;
      }
    }


  async checkCookies(page) {
    const result = { count: 0, cookies: [], score: 0 };

    try {
      const cookies = await page.cookies();
      result.count = cookies.length;
      result.cookies = cookies.map(c => ({
        name: c.name,
        domain: c.domain,
        secure: c.secure || false,
        httpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'none'
      }));

      // Score based on cookie count
      if (cookies.length === 0) {
        result.score = 100;
      } else if (cookies.length <= 3) {
        result.score = 80;
      } else if (cookies.length <= 10) {
        result.score = 60;
      } else {
        result.score = 30;
      }

      result.score = Math.min(100, Math.round(result.score));
    } catch (error) {
      this.log('Error in checkCookies:', error.message);
      result.score = 50;
    }

    return result;
  }

  calculateScore(checks) {
    const weights = {
      cookieBanner: 0.2,
      privacyPolicy: 0.2,
      cookiePolicy: 0.15,
      contactInfo: 0.1,
      cookies: 0.1,
      preConsentViolations: 0.25
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (checks[key] && typeof checks[key].score === 'number') {
        totalScore += checks[key].score * weight;
      }
    }

    return Math.round(totalScore);
  }

  generateRecommendations(checks) {
    const recommendations = [];

    try {
      // Pre-consent violations (highest priority)
      if (checks.preConsentViolations?.found) {
        for (const violation of checks.preConsentViolations.violations) {
          if (violation.type === 'pre-consent-cookies') {
            recommendations.push({
              priority: 'CRITICAL',
              message: `KRITICKÉ: ${violation.details.length} cookies sa nastavuje pred súhlasom používateľa. Toto je závažné porušenie GDPR!`
            });
          }
          
          if (violation.type === 'tracking-requests') {
            recommendations.push({
              priority: 'CRITICAL',
              message: `KRITICKÉ: Tracking služby sa spúšťajú automaticky bez súhlasu!`
            });
          }
        }
      }

      if (!checks.cookieBanner?.found) {
        recommendations.push({
          priority: 'HIGH',
          message: 'Pridajte cookie banner s možnosťou súhlasu/odmietnutia cookies'
        });
      }

      if (!checks.privacyPolicy?.found) {
        recommendations.push({
          priority: 'HIGH',
          message: 'Vytvorte a zverejnite zásady ochrany osobných údajov'
        });
      }

      if (!checks.cookiePolicy?.found) {
        recommendations.push({
          priority: 'MEDIUM',
          message: 'Pridajte zásady používania cookies'
        });
      }

      if (!checks.contactInfo?.found) {
        recommendations.push({
          priority: 'MEDIUM',
          message: 'Zverejnite kontaktné údaje správcu údajov'
        });
      }

      if (checks.cookies?.count > 10) {
        recommendations.push({
          priority: 'MEDIUM',
          message: 'Zvážte zníženie počtu cookies na minimum potrebné'
        });
      }
    } catch (error) {
      this.log('Error generating recommendations:', error.message);
      recommendations.push({
        priority: 'ERROR',
        message: 'Chyba pri generovaní odporúčaní'
      });
    }

    return recommendations;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.log('Browser closed successfully');
      } catch (error) {
        this.log('Error closing browser:', error.message);
      }
      this.browser = null;
    }
  }
}

const checker = new GDPRChecker();

// API endpoints
app.post('/api/check', async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log('[API] Received check request for:', url);
    
    if (!url) {
      console.log('[API] Missing URL');
      return res.status(400).json({ 
        error: 'URL je povinná',
        code: 'MISSING_URL'
      });
    }

    // URL validation
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      console.log('[API] Invalid URL format');
      return res.status(400).json({ 
        error: 'Neplatná URL. Použite formát: https://example.com',
        code: 'INVALID_URL'
      });
    }

    console.log(`[API] Starting check for URL: ${url}`);
    const results = await checker.checkUrl(url);
    
    console.log('[API] Check completed, sending response');
    console.log('[API] Results summary:', {
      score: results.score,
      hasError: !!results.error,
      checksCount: Object.keys(results.checks).length,
      recommendationsCount: results.recommendations.length
    });
    
    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('[API] Unhandled error:', error.stack || error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      code: 'CHECK_FAILED'
    };

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      errorResponse.code = 'TIMEOUT';
      errorResponse.error = 'Časový limit pre načítanie stránky bol prekročený';
    } else if (error.message.includes('Failed to load page')) {
      errorResponse.code = 'LOAD_FAILED';
      errorResponse.error = 'Stránka sa nepodarila načítať. Skontrolujte URL a dostupnosť stránky.';
    }

    res.status(500).json(errorResponse);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled middleware error:', err);
  res.status(500).json({
    success: false,
    error: 'Interná chyba servera',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  try {
    await checker.close();
    console.log('Browser closed successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`Enhanced GDPR Checker beží na porte ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Debug mode enabled - check console for detailed logs');
});