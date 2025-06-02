import axios from "axios";

// Configuration - Use window.location.hostname to detect if running in container
const getBaseURL = (port) => {
  const hostname = window.location.hostname;
  return `http://${hostname}:${port}`;
};

const APISIX_GATEWAY_URL = getBaseURL(9080);
const APISIX_STATUS_URL = `${APISIX_GATEWAY_URL}/apisix/status`;

// Create axios instance for Gateway API
const gatewayApi = axios.create({
  baseURL: APISIX_GATEWAY_URL,
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
      throw new Error('Cannot connect to APISIX services. Please check if Docker containers are running.');
    }
    throw new Error('Network error - please check if services are running');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// Mock static routes for standalone mode
const mockRoutes = [
  {
    key: "1",
    value: {
      id: "1",
      name: "WordPress Posts API",
      uri: "/api/posts",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      upstream: {
        type: "roundrobin",
        nodes: {
          "wordpress:80": 1
        }
      },
      plugins: {
        "proxy-rewrite": {
          regex_uri: ["^/api/posts(.*)", "/wp-json/wp/v2/posts$1"]
        },
        "cors": {
          allow_origins: "*",
          allow_methods: "GET,POST,PUT,DELETE,OPTIONS"
        }
      },
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    }
  },
  {
    key: "2",
    value: {
      id: "2",
      name: "GoFiber Data API",
      uri: "/api/data/*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      upstream: {
        type: "roundrobin",
        nodes: {
          "gofiber-backend:3000": 1
        }
      },
      plugins: {
        "cors": {
          allow_origins: "*",
          allow_methods: "GET,POST,PUT,DELETE,OPTIONS"
        }
      },
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    }
  },
  {
    key: "3",
    value: {
      id: "3",
      name: "GoFiber Health Check",
      uri: "/api/health",
      methods: ["GET", "OPTIONS"],
      upstream: {
        type: "roundrobin",
        nodes: {
          "gofiber-backend:3000": 1
        }
      },
      plugins: {
        "cors": {
          allow_origins: "*",
          allow_methods: "GET,OPTIONS"
        }
      },
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    }
  }
];

const mockUpstreams = [
  {
    key: "1",
    value: {
      id: "1",
      name: "WordPress Upstream",
      type: "roundrobin",
      nodes: {
        "wordpress:80": 1
      }
    }
  },
  {
    key: "2",
    value: {
      id: "2",
      name: "GoFiber Upstream", 
      type: "roundrobin",
      nodes: {
        "gofiber-backend:3000": 1
      }
    }
  }
];

// API functions
export const api = {
  // Health check for APISIX itself
  checkAPISIXHealth: async () => {
    try {
      const response = await axios.get(APISIX_STATUS_URL, { 
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
        }
      });
      return { status: 'healthy', data: response.data };
    } catch (error) {
      console.error('APISIX health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  },

  // Routes management (mock for standalone mode)
  getRoutes: async () => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Getting routes from static configuration...');
      return {
        list: mockRoutes,
        total: mockRoutes.length
      };
    } catch (error) {
      handleError(error, 'getRoutes');
    }
  },

  createRoute: async (routeConfig) => {
    // Validate input parameters
    if (!routeConfig || typeof routeConfig !== 'object') {
      throw new Error('Route configuration is required and must be an object');
    }

    if (!routeConfig.id || !routeConfig.uri) {
      throw new Error('Route ID and URI are required');
    }

    // In standalone mode, we can't create routes dynamically
    console.warn('Route creation attempted in standalone mode:', routeConfig);
    throw new Error('Route creation is not supported in standalone mode. Routes are configured in apisix.yaml file.');
  },

  deleteRoute: async (routeId) => {
    // Validate input parameter
    if (!routeId) {
      throw new Error('Route ID is required');
    }

    // In standalone mode, we can't delete routes dynamically
    console.warn('Route deletion attempted in standalone mode:', routeId);
    throw new Error('Route deletion is not supported in standalone mode. Routes are configured in apisix.yaml file.');
  },

  // Upstreams management (mock for standalone mode)
  getUpstreams: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Getting upstreams from static configuration...');
      return {
        list: mockUpstreams,
        total: mockUpstreams.length
      };
    } catch (error) {
      handleError(error, 'getUpstreams');
    }
  },

  createUpstream: async (upstreamConfig) => {
    // Validate input parameters
    if (!upstreamConfig || typeof upstreamConfig !== 'object') {
      throw new Error('Upstream configuration is required and must be an object');
    }

    console.warn('Upstream creation attempted in standalone mode:', upstreamConfig);
    throw new Error('Upstream creation is not supported in standalone mode.');
  },

  deleteUpstream: async (upstreamId) => {
    // Validate input parameter
    if (!upstreamId) {
      throw new Error('Upstream ID is required');
    }

    console.warn('Upstream deletion attempted in standalone mode:', upstreamId);
    throw new Error('Upstream deletion is not supported in standalone mode.');
  },

  // WordPress API testing with better error handling
  testWordPressAPI: async () => {
    console.log('Testing WordPress API...');
    
    try {
      // Test WordPress installation first
      console.log('Testing WordPress installation...');
      const wpResponse = await axios.get(`http://${window.location.hostname}:8080`, { 
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx
        }
      });
      
      // If WordPress redirects to install, it's not set up
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
          
          // Check if it's a 404 (no posts) vs actual error
          if (directError.response?.status === 404) {
            throw new Error('WordPress REST API endpoint not found. This usually means: 1) WordPress is not fully installed, 2) Permalinks need to be reset, or 3) No posts exist yet');
          }
          
          throw new Error('WordPress REST API is not accessible. Please check WordPress installation and REST API settings');
        }
      }
    } catch (error) {
      if (error.message.includes('setup required') || error.message.includes('install')) {
        throw error; // Re-throw setup errors as-is
      }
      
      // For network errors
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        throw new Error('Cannot connect to WordPress. Please check if WordPress container is running');
      }
      
      throw new Error(`WordPress API test failed: ${error.message}`);
    }
  },

  testGoFiberAPI: async () => {
    const testEndpoints = [
      `${APISIX_GATEWAY_URL}/api/data`,  // Through APISIX
      `http://${window.location.hostname}:3000/api/data`,  // Direct access
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
      `${APISIX_GATEWAY_URL}/api/health`,  // Through APISIX
      `http://${window.location.hostname}:3000/api/health`,  // Direct access
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

  // Setup initial routes (mock for standalone mode)
  setupInitialRoutes: async () => {
    return new Promise((resolve) => {
      // Simulate setup delay
      setTimeout(() => {
        console.log('Routes are already configured in standalone mode');
        resolve({ 
          success: true, 
          message: 'Routes are already configured in standalone mode via apisix.yaml' 
        });
      }, 1000);
    });
  },

  // Data operations through APISIX gateway
  createData: async (data) => {
    try {
      // Validate input data
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
      // Validate input parameters
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
      // Validate input parameter
      if (!id) {
        throw new Error('ID is required');
      }

      const response = await gatewayApi.delete(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteData');
    }
  },

  // Get data from GoFiber API
  getData: async () => {
    try {
      const response = await gatewayApi.get("/api/data");
      return response.data;
    } catch (error) {
      handleError(error, 'getData');
    }
  },

  // Get single data item
  getDataById: async (id) => {
    try {
      // Validate input parameter
      if (!id) {
        throw new Error('ID is required');
      }

      const response = await gatewayApi.get(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'getDataById');
    }
  },

  // Comprehensive ping function
  ping: async () => {
    const results = {
      apisix: false,
      gofiber: false,
      wordpress: false,
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

    return results;
  },
};

// Request/response logging
gatewayApi.interceptors.request.use(
  (config) => {
    console.log(`🌐 Gateway Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('🌐 Gateway Request Error:', error);
    return Promise.reject(error);
  }
);

gatewayApi.interceptors.response.use(
  (response) => {
    console.log(`✅ Gateway Response: ${response.status} - ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || 'Network Error';
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
    const url = error.config?.url || 'unknown';
    console.error(`❌ Gateway Error: ${status} - ${method} ${url}`, error.message);
    return Promise.reject(error);
  }
);

export default api;