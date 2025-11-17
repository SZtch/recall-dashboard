// api/proxy.js - Vercel Serverless Function to proxy Recall API requests

// Disable body parsing so we can handle it manually
export const config = {
  api: {
    bodyParser: true, // Enable automatic body parsing
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('Request method:', req.method);
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Request body type:', typeof req.body);

    // Ensure we have a body
    if (!req.body || typeof req.body !== 'object') {
      console.error('Invalid request body:', req.body);
      return res.status(400).json({
        error: 'Invalid request body',
        received: typeof req.body,
        rawBody: req.body
      });
    }

    const { url, method = 'GET', headers = {}, body } = req.body;

    if (!url) {
      console.error('URL missing from request body:', req.body);
      return res.status(400).json({
        error: 'URL is required',
        receivedBody: req.body
      });
    }

    console.log('Proxying request:', { url, method });

    // Forward the request to Recall API
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { text, error: 'Non-JSON response' };
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
