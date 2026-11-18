const { randomUUID } = require('node:crypto');
const path = require('node:path');
const cors = require('cors');
const express = require('express');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const config = require('./config/config');
const logger = require('./config/logger');
const swaggerSpecification = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const AppError = require('./utils/AppError');

const app = express();

function allowOrigin(origin, callback) {
  const isAllowed = !origin
    || config.corsOrigins.includes('*')
    || config.corsOrigins.includes(origin);

  if (isAllowed) {
    callback(null, true);
    return;
  }

  callback(new AppError('Origin is not allowed by CORS policy', 403, 'CORS_ORIGIN_FORBIDDEN'));
}

app.disable('x-powered-by');
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url?.split('?')[0] === '/api/health',
  },
  genReqId: (req, res) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel: (req, res, error) => {
    if ((error || res.statusCode >= 500) && res.statusCode !== 503) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));
app.use(cors({
  origin: allowOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecification, {
  customSiteTitle: 'Chronos API documentation',
}));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
