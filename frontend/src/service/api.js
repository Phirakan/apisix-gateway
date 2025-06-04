// frontend/src/service/api.js - With API Key Authentication
import axios from "axios";

// Configuration
const getBaseURL = (port) => {
  const hostname = window.location.hostname;
  return `http://${hostname}:${port}`;
};

const APISIX_GATEWAY_URL = getBaseURL(9080);
const GOFIBER_DIRECT_URL = getBaseURL(3000);

// API Keys - In production, these should be environment variables
const API_KEYS = {
  admin: "admin-api-key-2024",
  developer: "dev-api-key-2024",
  frontend: "frontend-app-key-2024",
  mobile: "mobile-app-key-2024"
};

// Default API key for frontend
const DEFAULT_API_KEY = API_KEYS.frontend;

// Create axios instance for Gateway API with API Key authentication
const gatewayApi = axios.create({
  baseURL: APISIX_GATEWAY_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': DEFAULT_API_KEY, // Add default API key
  },
});

// Create axios instance for direct GoFiber API (no API key needed for direct access)
const directApi = axios.create({
  baseURL: GOFIBER_DIRECT_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Enhanced error handler with API Key detection
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  
  // Handle API Key errors
  if (error.response?.status === 401) {
    if (error.response.data?.message?.includes('Missing API key') || 
        error.response.data?.message?.includes('key-auth')) {
      throw new Error('API Key required or invalid. Please check your authentication credentials.');
    }
    throw new Error('Authentication failed - please check your API key');
  }
  
  if (error.response?.status === 403) {
    throw new Error('Access forbidden - your API key does not have permission for this operation');
  }
  
  // Handle CORS
  if (error.message && error.message.includes('CORS')) {
    throw new Error('CORS error - please check if APISIX container is running and routes are configured properly. Try restarting APISIX: docker-compose restart apisix_api');
  }
  
  if (error.response) {
    const message = error.response.data?.message || error.response.statusText || 'Server error';
    throw new Error(`${message} (${error.response.status})`);
  } else if (error.request) {
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      throw new Error('Cannot connect to services. Please check if Docker containers are running and APISIX routes are configured.');
    }
    throw new Error('Network error - please check if services are running');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// API Key management functions
export const apiKeys = {
  // Set API key for gateway requests
  setApiKey: (key) => {
    gatewayApi.defaults.headers['X-API-Key'] = key;
    console.log('🔑 API Key updated for gateway requests');
  },
  
  // Get current API key
  getCurrentKey: () => {
    return gatewayApi.defaults.headers['X-API-Key'];
  },
  
  // Use admin API key
  useAdminKey: () => {
    apiKeys.setApiKey(API_KEYS.admin);
    console.log('🔑 Using admin API key');
  },
  
  // Use developer API key
  useDeveloperKey: () => {
    apiKeys.setApiKey(API_KEYS.developer);
    console.log('🔑 Using developer API key');
  },
  
  // Use frontend app API key
  useFrontendKey: () => {
    apiKeys.setApiKey(API_KEYS.frontend);
    console.log('🔑 Using frontend app API key');
  },
  
  // Test API key validity
  testApiKey: async (key = null) => {
    const testKey = key || apiKeys.getCurrentKey();
    try {
      const response = await axios.get(`${APISIX_GATEWAY_URL}/api/data`, {
        headers: { 'X-API-Key': testKey },
        timeout: 5000
      });
      return { valid: true, response: response.data };
    } catch (error) {
      return { 
        valid: false, 
        error: error.response?.status === 401 ? 'Invalid API key' : error.message 
      };
    }
  },
  
  // Get available API keys (for testing/demo purposes)
  getAvailableKeys: () => {
    return Object.entries(API_KEYS).map(([name, key]) => ({
      name,
      key,
      description: `${name.charAt(0).toUpperCase() + name.slice(1)} API Key`
    }));
  }
};

// API functions with authentication support
export const api = {
  // ========== AUTHENTICATION HELPERS ==========
  
  // Test different API keys
  testAllApiKeys: async () => {
    const results = {};
    for (const [name, key] of Object.entries(API_KEYS)) {
      console.log(`🧪 Testing ${name} API key...`);
      const result = await apiKeys.testApiKey(key);
      results[name] = result;
    }
    return results;
  },

  // ========== APISIX HEALTH CHECK ==========
  
  checkAPISIXHealth: async () => {
    try {
      console.log('🔍 Testing APISIX connectivity...');
      
      const testEndpoints = [
        { url: `${APISIX_GATEWAY_URL}/`, name: 'Root endpoint (No Auth)', needsAuth: false },
        { url: `${APISIX_GATEWAY_URL}/api/health`, name: 'Health endpoint (No Auth)', needsAuth: false },
      ];
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
          
          const headers = {
            'Accept': 'application/json',
          };
          
          if (endpoint.needsAuth) {
            headers['X-API-Key'] = apiKeys.getCurrentKey();
          }
          
          const response = await axios.get(endpoint.url, { 
            timeout: 8000,
            headers,
            validateStatus: function (status) {
              return status >= 200 && status < 500;
            }
          });
          
          console.log(`✅ ${endpoint.name} responded:`, response.status);
          return { 
            status: 'healthy', 
            data: response.data,
            endpoint: endpoint.url,
            statusCode: response.status 
          };
        } catch (error) {
          console.warn(`❌ ${endpoint.name} failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All APISIX endpoints failed to respond');
      
    } catch (error) {
      console.error('❌ APISIX health check failed:', error);
      return { 
        status: 'unhealthy', 
        error: error.message,
        suggestion: 'Please restart APISIX: docker-compose restart apisix_api'
      };
    }
  },

  // ========== ROUTE MANAGEMENT WITH AUTH ==========
  
  getRoutes: async () => {
    try {
      console.log('📋 Getting routes (No Auth Required)...');
      // Use direct API for route management to avoid auth issues
      const response = await directApi.get('/api/routes');
      return {
        list: response.data.list || [],
        total: response.data.total || 0
      };
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      console.warn('Route management API failed, checking auth...');
      // Try with auth through gateway
      try {
        const response = await gatewayApi.get('/api/routes');
        return {
          list: response.data.list || [],
          total: response.data.total || 0
        };
      } catch (authError) {
        handleError(authError, 'getRoutes');
      }
    }
  },

  createRoute: async (routeConfig) => {
    if (!routeConfig || typeof routeConfig !== 'object') {
      throw new Error('Route configuration is required and must be an object');
    }

    if (!routeConfig.uri) {
      throw new Error('Route URI is required');
    }

    try {
      console.log('➕ Creating route (API Key Required):', routeConfig);
      // Route creation requires admin privileges - use direct API
      const response = await directApi.post('/api/routes', routeConfig);
      return response.data;
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      // Try through gateway with auth
      try {
        const response = await gatewayApi.post('/api/routes', routeConfig);
        return response.data;
      } catch (authError) {
        handleError(authError, 'createRoute');
      }
    }
  },

  deleteRoute: async (routeId) => {
    if (!routeId) {
      throw new Error('Route ID is required');
    }

    try {
      console.log('🗑️ Deleting route (API Key Required):', routeId);
      // Use admin key for delete operations
      const originalKey = apiKeys.getCurrentKey();
      apiKeys.useAdminKey();
      
      try {
        const response = await gatewayApi.delete(`/api/routes/${routeId}`);
        return response.data;
      } finally {
        // Restore original key
        apiKeys.setApiKey(originalKey);
      }
    } catch (error) {
      // Fallback to direct API
      try {
        const response = await directApi.delete(`/api/routes/${routeId}`);
        return response.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        handleError(error, 'deleteRoute');
      }
    }
  },

  updateRoute: async (routeId, routeConfig) => {
    if (!routeId) {
      throw new Error('Route ID is required');
    }
    if (!routeConfig || typeof routeConfig !== 'object') {
      throw new Error('Route configuration is required and must be an object');
    }

    try {
      console.log('🔄 Updating route (API Key Required):', routeId, routeConfig);
      // Use admin key for update operations
      const originalKey = apiKeys.getCurrentKey();
      apiKeys.useAdminKey();
      
      try {
        const response = await gatewayApi.put(`/api/routes/${routeId}`, routeConfig);
        return response.data;
      } finally {
        // Restore original key
        apiKeys.setApiKey(originalKey);
      }
    } catch (error) {
      // Fallback to direct API
      try {
        const response = await directApi.put(`/api/routes/${routeId}`, routeConfig);
        return response.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        handleError(error, 'updateRoute');
      }
    }
  },

  getRoute: async (routeId) => {
    if (!routeId) {
      throw new Error('Route ID is required');
    }

    try {
      console.log('🔍 Getting route by ID (API Key Required):', routeId);
      const response = await gatewayApi.get(`/api/routes/${routeId}`);
      return response.data;
    } catch (error) {
      // Fallback to direct API
      try {
        const response = await directApi.get(`/api/routes/${routeId}`);
        return response.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        handleError(error, 'getRoute');
      }
    }
  },

  createQuickRoute: async (templateData) => {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data is required and must be an object');
    }

    try {
      console.log('🚀 Creating quick route (Admin Key Required):', templateData);
      // Use admin key for quick route creation
      const originalKey = apiKeys.getCurrentKey();
      apiKeys.useAdminKey();
      
      try {
        const response = await gatewayApi.post('/api/routes/quick', templateData);
        return response.data;
      } finally {
        // Restore original key
        apiKeys.setApiKey(originalKey);
      }
    } catch (error) {
      // Fallback to direct API
      try {
        const response = await directApi.post('/api/routes/quick', templateData);
        return response.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        handleError(error, 'createQuickRoute');
      }
    }
  },

  getRouteTemplates: async () => {
    try {
      console.log('📋 Getting route templates...');
      const response = await directApi.get('/api/routes/templates');
      return response.data;
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      console.warn('Template API failed, using fallback templates');
      return {
        templates: {
          wordpress: {
            name: "WordPress API Route",
            uri: "/api/wp/*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            target: "wordpress",
            port: 80,
            type: "wordpress"
          },
          gofiber: {
            name: "GoFiber API Route", 
            uri: "/api/custom/*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            target: "gofiber-backend",
            port: 3000,
            type: "gofiber"
          }
        }
      };
    }
  },

  reloadAPISIX: async () => {
    try {
      console.log('🔄 Reloading APISIX configuration (Admin Key Required)...');
      // Use admin key for reload operations
      const originalKey = apiKeys.getCurrentKey();
      apiKeys.useAdminKey();
      
      try {
        const response = await gatewayApi.post('/api/routes/reload');
        return response.data;
      } finally {
        // Restore original key
        apiKeys.setApiKey(originalKey);
      }
    } catch (error) {
      // Fallback to direct API
      try {
        const response = await directApi.post('/api/routes/reload');
        return response.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        handleError(error, 'reloadAPISIX');
      }
    }
  },

  getUpstreams: async () => {
    try {
      console.log('📋 Getting upstreams (API Key Required)...');
      const response = await gatewayApi.get('/api/upstreams');
      return {
        list: response.data.list || [],
        total: response.data.total || 0
      };
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      console.warn('Upstreams API failed, trying direct access...');
      try {
        const response = await directApi.get('/api/upstreams');
        return {
          list: response.data.list || [],
          total: response.data.total || 0
        };
      // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        return {
          list: [],
          total: 0
        };
      }
    }
  },
  
  // ========== DATA OPERATIONS WITH API KEY ==========
  
  createData: async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Data is required and must be an object');
      }

      console.log('📊 Creating data (API Key Required)...');
      const response = await gatewayApi.post("/api/data", data);
      return response.data;
    } catch (error) {
      handleError(error, 'createData');
    }
  },

  updateData: async (id, data) => {
    try {
      if (!id) {
        throw new Error('ID is required');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Data is required and must be an object');
      }

      console.log('📊 Updating data (API Key Required)...');
      const response = await gatewayApi.put(`/api/data/${id}`, data);
      return response.data;
    } catch (error) {
      handleError(error, 'updateData');
    }
  },

  deleteData: async (id) => {
    try {
      if (!id) {
        throw new Error('ID is required');
      }

      console.log('📊 Deleting data (API Key Required)...');
      const response = await gatewayApi.delete(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteData');
    }
  },

  getData: async () => {
    try {
      console.log('📊 Getting data (API Key Required)...');
      const response = await gatewayApi.get("/api/data");
      return response.data;
    } catch (error) {
      handleError(error, 'getData');
    }
  },

  getDataById: async (id) => {
    try {
      if (!id) {
        throw new Error('ID is required');
      }

      console.log('📊 Getting data by ID (API Key Required)...');
      const response = await gatewayApi.get(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'getDataById');
    }
  },

  // ========== TESTING FUNCTIONS ==========
  
  setupInitialRoutes: async () => {
    try {
      const existingRoutes = await api.getRoutes();
      if (existingRoutes.list && existingRoutes.list.length > 0) {
        console.log('Routes already configured');
        return { 
          success: true, 
          message: `Found ${existingRoutes.list.length} existing routes. System is ready!`,
          routes: existingRoutes.list.length
        };
      }

      return {
        success: true,
        message: 'No routes found. Use the dashboard to create routes or check APISIX configuration.',
        routes: 0
      };
    } catch (error) {
      throw new Error(`Route setup check failed: ${error.message}`);
    }
  },

  testWordPressAPI: async () => {
    console.log('🧪 Testing WordPress API (No Auth Required)...');
    
    try {
      // WordPress endpoints don't require authentication
      const response = await axios.get(`${APISIX_GATEWAY_URL}/api/posts`, { 
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
        }
      });
      console.log('✅ WordPress API working through APISIX:', response.data);
      return response.data;
    } catch (error) {
      // Try direct WordPress access
      try {
        const directResponse = await axios.get(`http://${window.location.hostname}:8080/wp-json/wp/v2/posts`, { 
          timeout: 8000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log('✅ WordPress API working directly:', directResponse.data);
        return directResponse.data;
        // eslint-disable-next-line no-unused-vars
      } catch (directError) {
        throw new Error(`WordPress API test failed: ${error.message}`);
      }
    }
  },

  testGoFiberAPI: async () => {
    console.log('🧪 Testing GoFiber API (API Key Required)...');
    
    const testEndpoints = [
      { url: `${APISIX_GATEWAY_URL}/api/data`, needsAuth: true, name: 'APISIX Gateway' },
      { url: `http://${window.location.hostname}:3000/api/data`, needsAuth: false, name: 'Direct Access' },
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`🧪 Testing GoFiber at: ${endpoint.url} (Auth: ${endpoint.needsAuth})`);
        
        const headers = {
          'Accept': 'application/json',
        };
        
        if (endpoint.needsAuth) {
          headers['X-API-Key'] = apiKeys.getCurrentKey();
        }
        
        const response = await axios.get(endpoint.url, { 
          timeout: 8000,
          headers
        });
        console.log(`✅ GoFiber API working at: ${endpoint.name}`);
        return response.data;
      } catch (error) {
        console.warn(`❌ GoFiber test failed for ${endpoint.name}:`, error.message);
        if (endpoint === testEndpoints[testEndpoints.length - 1]) {
          throw new Error('GoFiber API is not accessible through any endpoint');
        }
      }
    }
  },

  testGoFiberHealth: async () => {
    console.log('🩺 Testing GoFiber Health (No Auth Required)...');
    
    const testEndpoints = [
      `${APISIX_GATEWAY_URL}/api/health`,
      `http://${window.location.hostname}:3000/api/health`,
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`🩺 Testing GoFiber health at: ${endpoint}`);
        const response = await axios.get(endpoint, { 
          timeout: 8000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log(`✅ GoFiber health check working at: ${endpoint}`);
        return response.data;
      } catch (error) {
        console.warn(`❌ Health check failed for ${endpoint}:`, error.message);
        if (endpoint === testEndpoints[testEndpoints.length - 1]) {
          throw new Error('GoFiber health endpoint is not accessible');
        }
      }
    }
  },

  // ========== COMPREHENSIVE PING WITH AUTH STATUS ==========
  
  ping: async () => {
    const results = {
      apisix: false,
      gofiber: false,
      wordpress: false,
      routeManagement: false,
      authentication: 'unknown',
      cors: 'unknown',
      timestamp: new Date().toISOString(),
      details: {},
      apiKeyStatus: {}
    };

    // Test API Keys
    try {
      console.log('🔑 Testing API Key authentication...');
      const keyResults = await api.testAllApiKeys();
      results.apiKeyStatus = keyResults;
      
      // Check if any key works
      const workingKeys = Object.values(keyResults).filter(r => r.valid).length;
      results.authentication = workingKeys > 0 ? 'working' : 'failed';
      
      console.log(`🔑 API Key test results: ${workingKeys}/${Object.keys(keyResults).length} keys working`);
    } catch (error) {
      console.log('❌ API Key test failed:', error.message);
      results.details.authentication = { error: error.message };
    }

    // Test APISIX
    try {
      const apisixHealth = await api.checkAPISIXHealth();
      results.apisix = apisixHealth.status === 'healthy';
      results.cors = results.apisix ? 'working' : 'blocked';
      results.details.apisix = apisixHealth;
    } catch (error) {
      console.log('❌ APISIX ping failed:', error.message);
      results.cors = error.message.includes('CORS') ? 'blocked' : 'unknown';
      results.details.apisix = { error: error.message };
    }

    // Test GoFiber
    try {
      await api.testGoFiberHealth();
      results.gofiber = true;
      results.details.gofiber = { status: 'healthy' };
    } catch (error) {
      console.log('❌ GoFiber ping failed:', error.message);
      results.details.gofiber = { error: error.message };
    }

    // Test WordPress
    try {
      await api.testWordPressAPI();
      results.wordpress = true;
      results.details.wordpress = { status: 'healthy' };
    } catch (error) {
      console.log('❌ WordPress ping failed:', error.message);
      results.details.wordpress = { error: error.message };
    }

    // Test Route Management
    try {
      await api.getRoutes();
      results.routeManagement = true;
      results.details.routeManagement = { status: 'healthy' };
    } catch (error) {
      console.log('❌ Route Management ping failed:', error.message);
      results.details.routeManagement = { error: error.message };
    }

    return results;
  },
};

// ========== REQUEST/RESPONSE INTERCEPTORS WITH AUTH ==========

[gatewayApi, directApi].forEach((apiInstance, index) => {
  const instanceName = index === 0 ? 'Gateway' : 'Direct';
  
  apiInstance.interceptors.request.use(
    (config) => {
      console.log(`🌐 ${instanceName} Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      
      // Log API key usage for gateway requests
      if (index === 0 && config.headers['X-API-Key']) {
        console.log(`🔑 Using API Key: ${config.headers['X-API-Key'].substring(0, 8)}...`);
      }
      
      return config;
    },
    (error) => {
      console.error(`🌐 ${instanceName} Request Error:`, error);
      return Promise.reject(error);
    }
  );

  apiInstance.interceptors.response.use(
    (response) => {
      console.log(`✅ ${instanceName} Response: ${response.status} - ${response.config.method?.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      const status = error.response?.status || 'Network Error';
      const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
      const url = error.config?.url || 'unknown';
      
      // Enhanced auth error detection
      if (error.response?.status === 401) {
        console.error(`🚫 ${instanceName} Auth Error: ${method} ${url} - API Key required or invalid`);
        error.message = `Authentication failed: API Key required or invalid for ${url}`;
      } else if (error.response?.status === 403) {
        console.error(`🚫 ${instanceName} Permission Error: ${method} ${url} - Access forbidden`);
        error.message = `Access forbidden: Your API key does not have permission for ${url}`;
      } else if (error.message && (
        error.message.includes('CORS') || 
        error.message.includes('Access-Control-Allow-Origin') ||
        (error.code === 'ERR_NETWORK' && instanceName === 'Gateway')
      )) {
        console.error(`🚫 ${instanceName} CORS Error: ${method} ${url}`, error.message);
        error.message = `CORS policy blocked request to ${url}. Please check APISIX configuration and restart container if needed.`;
      } else {
        console.error(`❌ ${instanceName} Error: ${status} - ${method} ${url}`, error.message);
      }
      
      return Promise.reject(error);
    }
  );
});

export default api;