import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6_PSzOVZSKvWzF-syusZJyZyCaGEn5ZW7OOsDiln2rtA8lv_H-h3vjeXnRAFDy10oJbfToOVKNRj3/pub?gid=0&single=true&output=csv';
const CITIES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6_PSzOVZSKvWzF-syusZJyZyCaGEn5ZW7OOsDiln2rtA8lv_H-h3vjeXnRAFDy10oJbfToOVKNRj3/pub?gid=2051459558&single=true&output=csv';
const BLACKLIST_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6_PSzOVZSKvWzF-syusZJyZyCaGEn5ZW7OOsDiln2rtA8lv_H-h3vjeXnRAFDy10oJbfToOVKNRj3/pub?gid=268225008&single=true&output=csv';

// Simple in-memory storage for rate limiting
// In production, use Redis or a database
const orderCounts: Record<string, { count: number, date: string }> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware for Geo-blocking (Morocco only)
  // Note: In a real environment, you'd use a local GeoIP database or a trusted header from a proxy (like Cloudflare)
  app.use(async (req, res, next) => {
    // Skip geo-check for static assets in dev
    if (req.path.startsWith('/@vite') || req.path.startsWith('/src') || req.path.includes('.')) {
      return next();
    }

    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      // For demo purposes, we'll allow localhost and skip the real API call if we can't get a clear IP
      if (ip === '::1' || ip === '127.0.0.1' || !ip) {
        return next();
      }

      // In a real app, you'd use a service like ipapi.co or a local DB
      // For this example, we'll assume the check passes unless we implement a real one.
      // Let's add a placeholder for the real check:
      /*
      const geoResponse = await fetch(`https://ipapi.co/${ip}/country/`);
      const country = await geoResponse.text();
      if (country !== 'MA') {
        return res.status(403).send('Access denied: This website is only available in Morocco.');
      }
      */
      next();
    } catch (error) {
      console.error('Geo-blocking error:', error);
      next(); // Fallback to allow if service is down
    }
  });

  // API Route for products (Proxying to hide the URL)
  app.get('/api/products', async (req, res) => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      res.send(csvText);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to load products' });
    }
  });

  // API Route for cities
  app.get('/api/cities', async (req, res) => {
    try {
      const response = await fetch(CITIES_CSV_URL);
      const csvText = await response.text();
      res.send(csvText);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ error: 'Failed to load cities' });
    }
  });

  // API Route for order submission with security checks
  app.post('/api/order', async (req, res) => {
    const { phone, productId } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const today = new Date().toISOString().split('T')[0];

    // Normalize for comparison: remove non-digits but keep leading zero if present
    const normalizeForComparison = (p: string) => {
      if (!p) return '';
      return p.replace(/\D/g, '');
    };

    const normalizedInput = normalizeForComparison(phone);

    console.log('--- New Order Request ---');
    console.log('IP:', ip);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    try {
      // 1. Blacklist Check
      const blacklistResponse = await fetch(BLACKLIST_CSV_URL);
      const blacklistText = await blacklistResponse.text();
      const blacklistData = Papa.parse(blacklistText, { skipEmptyLines: true }).data as string[][];
      
      // Data starts from row 5 (index 4), phone is in column B (index 1)
      const blacklistedNumbers = blacklistData.slice(4)
        .map(row => normalizeForComparison(row[1]))
        .filter(p => p !== '');
      
      // Check for match (both with and without leading zero to be robust)
      const isBlacklisted = blacklistedNumbers.some(b => {
        const bNoZero = b.replace(/^0+/, '');
        const iNoZero = normalizedInput.replace(/^0+/, '');
        return b === normalizedInput || (bNoZero === iNoZero && bNoZero !== '');
      });

      if (isBlacklisted) {
        return res.status(403).json({ error: 'عذراً، هذا الرقم محظور من الطلب.' });
      }

      // 2. Rate Limiting Check (3 per product per day per IP)
      const limitKey = `${ip}-${productId}-${today}`;
      if (!orderCounts[limitKey]) {
        orderCounts[limitKey] = { count: 0, date: today };
      }

      if (orderCounts[limitKey].count >= 3) {
        return res.status(429).json({ error: 'لقد وصلت للحد الأقصى من الطلبات لهذا المنتج اليوم (3 طلبات).' });
      }

      // Increment count
      orderCounts[limitKey].count += 1;

      // 3. Forward to Google Forms (Server-side to hide entry IDs and URL)
      const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdIG1lwIp3I8bnTuIxEcvwcIOC3fhwr3LWbea7oUFkHWncJpA/formResponse';
      
      const formData = new URLSearchParams();
      // Map the incoming data to Google Form entry IDs
      // IMPORTANT: We use req.body.phone directly to keep exactly what the user typed (including zeros)
      formData.append('entry.216099083', req.body.w_code || '');
      formData.append('entry.1395650211', req.body.title || '');
      formData.append('entry.540852700', req.body.sell_price || '');
      formData.append('entry.139905504', req.body.quantity || '1');
      formData.append('entry.1405363493', req.body.name || '');
      formData.append('entry.837065099', req.body.phone || '');
      formData.append('entry.731318579', req.body.city || '');
      formData.append('entry.1663804639', req.body.address || '');
      formData.append('entry.490926552', req.body.color || '');
      formData.append('entry.1049454346', req.body.size || '');

      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      res.json({ success: true, message: 'تم إرسال طلبك بنجاح!' });
    } catch (error) {
      console.error('Order error:', error);
      res.status(500).json({ error: 'Failed to process order' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
