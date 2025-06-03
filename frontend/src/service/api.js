// frontend/src/service/api.js (Fixed Version)
import axios from "axios";

// Configuration - Use window.location.hostname to detect if running in container
const getBaseURL = (port) => {
  const hostname = window.location.hostname;
  return `http://${hostname}:${port}`;
};

const APISIX_GATEWAY_URL = getBaseURL(9080);
const GOFIBER_DIRECT_URL = getBaseURL(3000);

// Create axios instance for Gateway API
const gatewayApi = axios.create({
  baseURL: APISIX_GATEWAY_URL,
  timeout: 10000,
});

// Create axios instance for direct GoFiber API (for route management)
const directApi = axios.create({
  baseURL: GOFIBER_DIRECT_URL,
  timeout: 10000,
});

// Enhanced error handler
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  
  if (error.response) {
    const message = error.response.data?.message || error.response.statusText || 'Server error';
    throw new Error(`${message} (${error.response.status})`);
  } else if (error.request) {
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      throw new Error('Cannot connect to services. Please check if Docker containers are running.');
    }
    throw new Error('Network error - please check if services are running');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// API functions
export const api = {
  // ========== FIXED APISIX HEALTH CHECK ==========
  
  // Health check for APISIX itself - FIXED: Use proper endpoint
  checkAPISIXHealth: async () => {
    try {
      // Try basic connectivity to APISIX gateway
      const response = await axios.get(`${APISIX_GATEWAY_URL}/`, { 
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
        }
      });
      return { status: 'healthy', data: response.data };
    } catch (error) {
      console.error('APISIX health check failed:', error);
      // Try alternative endpoint
      try {
        const altResponse = await axios.get(`${APISIX_GATEWAY_URL}/api/health`, { 
          timeout: 3000,
          headers: {
            'Accept': 'application/json',
          }
        });
        return { status: 'healthy', data: altResponse.data };
      // eslint-disable-next-line no-unused-vars
      } catch (altError) {
        return { status: 'unhealthy', error: error.message };
      }
    }
  },

  // ========== ROUTE MANAGEMENT (FIXED) ==========
  
  // Routes management (NOW USES REAL API!)
  getRoutes: async () => {
    try {
      console.log('Getting routes from GoFiber route management API...');
      const response = await directApi.get('/api/routes');
      return {
        list: response.data.list || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.warn('Route management API failed, falling back to mock data');
      handleError(error, 'getRoutes');
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
      console.log('Creating route via GoFiber API:', routeConfig);
      const response = await directApi.post('/api/routes', routeConfig);
      return response.data;
    } catch (error) {
      handleError(error, 'createRoute');
    }
  },

  deleteRoute: async (routeId) => {
    if (!routeId) {
      throw new Error('Route ID is required');
    }

    try {
      console.log('Deleting route via GoFiber API:', routeId);
      const response = await directApi.delete(`/api/routes/${routeId}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteRoute');
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
      console.log('Updating route via GoFiber API:', routeId, routeConfig);
      const response = await directApi.put(`/api/routes/${routeId}`, routeConfig);
      return response.data;
    } catch (error) {
      handleError(error, 'updateRoute');
    }
  },

  getRoute: async (routeId) => {
    if (!routeId) {
      throw new Error('Route ID is required');
    }

    try {
      console.log('Getting route by ID via GoFiber API:', routeId);
      const response = await directApi.get(`/api/routes/${routeId}`);
      return response.data;
    } catch (error) {
      handleError(error, 'getRoute');
    }
  },

  // Quick route creation with templates
  createQuickRoute: async (templateData) => {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data is required and must be an object');
    }

    try {
      console.log('Creating quick route:', templateData);
      const response = await directApi.post('/api/routes/quick', templateData);
      return response.data;
    } catch (error) {
      handleError(error, 'createQuickRoute');
    }
  },

  // Get route templates
  getRouteTemplates: async () => {
    try {
      console.log('Getting route templates...');
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

  // Reload APISIX configuration
  reloadAPISIX: async () => {
    try {
      console.log('Reloading APISIX configuration...');
      const response = await directApi.post('/api/routes/reload');
      return response.data;
    } catch (error) {
      handleError(error, 'reloadAPISIX');
    }
  },

  // Upstreams management (uses real API)
  getUpstreams: async () => {
    try {
      console.log('Getting upstreams from GoFiber API...');
      const response = await directApi.get('/api/upstreams');
      return {
        list: response.data.list || [],
        total: response.data.total || 0
      };
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      console.warn('Upstreams API failed, falling back to mock data');
      return {
        list: [],
        total: 0
      };
    }
  },
  
  // ========== ENHANCED SETUP FUNCTION ==========
  
  setupInitialRoutes: async () => {
    try {
      // Check if routes already exist
      const existingRoutes = await api.getRoutes();
      if (existingRoutes.list && existingRoutes.list.length > 0) {
        console.log('Routes already configured');
        return { 
          success: true, 
          message: `Found ${existingRoutes.list.length} existing routes. System is ready!`,
          routes: existingRoutes.list.length
        };
      }

      // If no routes exist, suggest creating some
      return {
        success: true,
        message: 'No routes found. Use the dashboard to create routes or check APISIX configuration.',
        routes: 0
      };
    } catch (error) {
      throw new Error(`Route setup check failed: ${error.message}`);
    }
  },

  // ========== EXISTING FUNCTIONS (FIXED) ==========
  
  testWordPressAPI: async () => {
    console.log('Testing WordPress API...');
    
    try {
      // Test WordPress installation first
      console.log('Testing WordPress installation...');
      const wpResponse = await axios.get(`http://${window.location.hostname}:8080`, { 
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      
      if (wpResponse.status === 302 || wpResponse.request.responseURL?.includes('wp-admin/install.php')) {
        throw new Error('WordPress setup required. Please visit http://localhost:8080 to complete installation');
      }
      
      console.log('WordPress appears to be installed, testing REST API...');
      
      // Test through APISIX first
      try {
        console.log('Testing WordPress API through APISIX...');
        const apisixResponse = await axios.get(`${APISIX_GATEWAY_URL}/api/posts`, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log('WordPress API working through APISIX:', apisixResponse.data);
        return apisixResponse.data;
      } catch (apisixError) {
        console.warn('APISIX WordPress API failed:', apisixError.message);
        
        // Try direct access
        try {
          console.log('Testing WordPress API directly...');
          const directResponse = await axios.get(`http://${window.location.hostname}:8080/wp-json/wp/v2/posts`, { 
            timeout: 5000,
            headers: {
              'Accept': 'application/json',
            }
          });
          console.log('WordPress API working directly:', directResponse.data);
          return directResponse.data;
        } catch (directError) {
          console.warn('Direct WordPress API failed:', directError.message);
          
          if (directError.response?.status === 404) {
            throw new Error('WordPress REST API endpoint not found. This usually means: 1) WordPress is not fully installed, 2) Permalinks need to be reset, or 3) No posts exist yet');
          }
          
          throw new Error('WordPress REST API is not accessible. Please check WordPress installation and REST API settings');
        }
      }
    } catch (error) {
      if (error.message.includes('setup required') || error.message.includes('install')) {
        throw error;
      }
      
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        throw new Error('Cannot connect to WordPress. Please check if WordPress container is running');
      }
      
      throw new Error(`WordPress API test failed: ${error.message}`);
    }
  },

  testGoFiberAPI: async () => {
    const testEndpoints = [
      `${APISIX_GATEWAY_URL}/api/data`,
      `http://${window.location.hostname}:3000/api/data`,
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing GoFiber at: ${endpoint}`);
        const response = await axios.get(endpoint, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log(`GoFiber API working at: ${endpoint}`);
        return response.data;
      } catch (error) {
        console.warn(`GoFiber test failed for ${endpoint}:`, error.message);
        if (endpoint === testEndpoints[testEndpoints.length - 1]) {
          throw new Error('GoFiber API is not accessible through any endpoint');
        }
      }
    }
  },

  testGoFiberHealth: async () => {
    const testEndpoints = [
      `${APISIX_GATEWAY_URL}/api/health`,
      `http://${window.location.hostname}:3000/api/health`,
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing GoFiber health at: ${endpoint}`);
        const response = await axios.get(endpoint, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log(`GoFiber health check working at: ${endpoint}`);
        return response.data;
      } catch (error) {
        console.warn(`Health check failed for ${endpoint}:`, error.message);
        if (endpoint === testEndpoints[testEndpoints.length - 1]) {
          throw new Error('GoFiber health endpoint is not accessible');
        }
      }
    }
  },

  // Data operations through APISIX gateway
  createData: async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Data is required and must be an object');
      }

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

      const response = await gatewayApi.delete(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteData');
    }
  },

  getData: async () => {
    try {
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

      const response = await gatewayApi.get(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'getDataById');
    }
  },

  ping: async () => {
    const results = {
      apisix: false,
      gofiber: false,
      wordpress: false,
      routeManagement: false,
      timestamp: new Date().toISOString(),
      details: {}
    };

    // Test APISIX
    try {
      const apisixHealth = await api.checkAPISIXHealth();
      results.apisix = apisixHealth.status === 'healthy';
      results.details.apisix = apisixHealth;
    } catch (error) {
      console.log('APISIX ping failed:', error.message);
      results.details.apisix = { error: error.message };
    }

    // Test GoFiber
    try {
      await api.testGoFiberHealth();
      results.gofiber = true;
      results.details.gofiber = { status: 'healthy' };
    } catch (error) {
      console.log('GoFiber ping failed:', error.message);
      results.details.gofiber = { error: error.message };
    }

    // Test WordPress
    try {
      await api.testWordPressAPI();
      results.wordpress = true;
      results.details.wordpress = { status: 'healthy' };
    } catch (error) {
      console.log('WordPress ping failed:', error.message);
      results.details.wordpress = { error: error.message };
    }

    // Test Route Management
    try {
      await directApi.get('/api/routes');
      results.routeManagement = true;
      results.details.routeManagement = { status: 'healthy' };
    } catch (error) {
      console.log('Route Management ping failed:', error.message);
      results.details.routeManagement = { error: error.message };
    }

    return results;
  },
};

// Request/response logging
[gatewayApi, directApi].forEach((apiInstance, index) => {
  const instanceName = index === 0 ? 'Gateway' : 'Direct';
  
  apiInstance.interceptors.request.use(
    (config) => {
      console.log(`🌐 ${instanceName} Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
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
      console.error(`❌ ${instanceName} Error: ${status} - ${method} ${url}`, error.message);
      return Promise.reject(error);
    }
  );
});

export default api;