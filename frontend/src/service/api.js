import axios from "axios";

// Configuration - Use window.location.hostname to detect if running in container
const getBaseURL = (port) => {
  const hostname = window.location.hostname;
  // If running in Docker, use localhost, otherwise use container hostname
  return `http://${hostname}:${port}`;
};

const APISIX_ADMIN_URL = import.meta.env.VITE_APISIX_ADMIN_URL || getBaseURL(9180);
const APISIX_GATEWAY_URL = getBaseURL(9080);
const ADMIN_KEY = "edd1c9f034335f136f87ad84b625c8f1";

// Create axios instance for APISIX Admin API
const apisixAdminApi = axios.create({
  baseURL: `${APISIX_ADMIN_URL}/apisix/admin`,
  headers: {
    "X-API-KEY": ADMIN_KEY,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

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
    // Network error - provide more specific guidance
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      throw new Error('Cannot connect to APISIX services. Please check:\n1. Docker containers are running\n2. APISIX is properly configured\n3. No firewall blocking ports 9080/9180');
    }
    throw new Error('Network error - please check if services are running');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// API functions
export const api = {
  // Health check for APISIX itself
  checkAPISIXHealth: async () => {
    try {
      // Try to access APISIX status endpoint
      const response = await axios.get(`${APISIX_GATEWAY_URL}/apisix/status`, { 
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

  // Routes management with better error handling
  getRoutes: async () => {
    try {
      console.log('Attempting to get routes from:', `${APISIX_ADMIN_URL}/apisix/admin/routes`);
      const response = await apisixAdminApi.get("/routes");
      return response.data;
    } catch (error) {
      console.error('Failed to get routes. Checking APISIX health...');
      const healthCheck = await api.checkAPISIXHealth();
      if (healthCheck.status === 'unhealthy') {
        throw new Error(`APISIX is not accessible: ${healthCheck.error}`);
      }
      handleError(error, 'getRoutes');
    }
  },

  createRoute: async (routeData) => {
    try {
      if (!routeData.id || !routeData.uri) {
        throw new Error('Route ID and URI are required');
      }
      console.log('Creating route:', routeData);
      const response = await apisixAdminApi.post("/routes", routeData);
      return response.data;
    } catch (error) {
      handleError(error, 'createRoute');
    }
  },

  deleteRoute: async (routeId) => {
    try {
      if (!routeId) {
        throw new Error('Route ID is required');
      }
      const response = await apisixAdminApi.delete(`/routes/${routeId}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteRoute');
    }
  },

  // Upstreams management
  getUpstreams: async () => {
    try {
      const response = await apisixAdminApi.get("/upstreams");
      return response.data;
    } catch (error) {
      handleError(error, 'getUpstreams');
    }
  },

  createUpstream: async (upstreamData) => {
    try {
      const response = await apisixAdminApi.post("/upstreams", upstreamData);
      return response.data;
    } catch (error) {
      handleError(error, 'createUpstream');
    }
  },

  deleteUpstream: async (upstreamId) => {
    try {
      const response = await apisixAdminApi.delete(`/upstreams/${upstreamId}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteUpstream');
    }
  },

  // API testing with fallback strategies
  testWordPressAPI: async () => {
    const testEndpoints = [
      `${APISIX_GATEWAY_URL}/api/posts`,  // Through APISIX
      `http://${window.location.hostname}:8080/wp-json/wp/v2/posts`,  // Direct access
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing WordPress at: ${endpoint}`);
        const response = await axios.get(endpoint, { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        });
        console.log(`WordPress API working at: ${endpoint}`);
        return response.data;
      } catch (error) {
        console.warn(`WordPress test failed for ${endpoint}:`, error.message);
        if (endpoint === testEndpoints[testEndpoints.length - 1]) {
          throw new Error('WordPress API is not accessible through any endpoint');
        }
      }
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

  // Setup initial routes with better error handling
  setupInitialRoutes: async () => {
    try {
      console.log('Setting up initial routes...');
      
      // First check if APISIX is healthy
      const healthCheck = await api.checkAPISIXHealth();
      if (healthCheck.status === 'unhealthy') {
        throw new Error(`APISIX is not ready: ${healthCheck.error}`);
      }

      console.log('Setting up WordPress route...');
      const wordPressRoute = {
        id: "wordpress-posts",
        name: "WordPress Posts API",
        uri: "/api/posts",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        upstream: {
          type: "roundrobin",
          nodes: {
            "wordpress:80": 1,
          },
        },
        plugins: {
          "proxy-rewrite": {
            regex_uri: ["^/api/posts(.*)", "/wp-json/wp/v2/posts$1"],
          },
          cors: {
            allow_origins: "*",
            allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
            allow_headers: "Origin,Content-Type,Accept,Authorization",
            allow_credentials: false,
            max_age: 86400,
          },
        },
      };

      await api.createRoute(wordPressRoute);
      console.log('WordPress route created successfully');

      console.log('Setting up GoFiber data route...');
      const goFiberRoute = {
        id: "gofiber-data",
        name: "GoFiber Data API",
        uri: "/api/data/*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        upstream: {
          type: "roundrobin",
          nodes: {
            "gofiber-backend:3000": 1,
          },
        },
        plugins: {
          cors: {
            allow_origins: "*",
            allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
            allow_headers: "Origin,Content-Type,Accept,Authorization",
            allow_credentials: false,
            max_age: 86400,
          },
        },
      };

      await api.createRoute(goFiberRoute);
      console.log('GoFiber data route created successfully');

      console.log('Setting up GoFiber health route...');
      const healthRoute = {
        id: "gofiber-health",
        name: "GoFiber Health Check",
        uri: "/api/health",
        methods: ["GET", "OPTIONS"],
        upstream: {
          type: "roundrobin",
          nodes: {
            "gofiber-backend:3000": 1,
          },
        },
        plugins: {
          cors: {
            allow_origins: "*",
            allow_methods: "GET,OPTIONS",
            allow_headers: "Origin,Content-Type,Accept,Authorization",
            allow_credentials: false,
            max_age: 86400,
          },
        },
      };

      await api.createRoute(healthRoute);
      console.log('GoFiber health route created successfully');

      return { success: true, message: 'All routes created successfully' };
    } catch (error) {
      console.error('Error setting up routes:', error);
      throw error;
    }
  },

  // Data operations
  createData: async (data) => {
    try {
      const response = await gatewayApi.post("/api/data", data);
      return response.data;
    } catch (error) {
      handleError(error, 'createData');
    }
  },

  updateData: async (id, data) => {
    try {
      const response = await gatewayApi.put(`/api/data/${id}`, data);
      return response.data;
    } catch (error) {
      handleError(error, 'updateData');
    }
  },

  deleteData: async (id) => {
    try {
      const response = await gatewayApi.delete(`/api/data/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'deleteData');
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

// Enhanced request/response logging
apisixAdminApi.interceptors.request.use(
  (config) => {
    console.log(`🔧 Admin API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('🔧 Admin API Request Error:', error);
    return Promise.reject(error);
  }
);

apisixAdminApi.interceptors.response.use(
  (response) => {
    console.log(`✅ Admin API Response: ${response.status} - ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || 'Network Error';
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
    const url = error.config?.url || 'unknown';
    console.error(`❌ Admin API Error: ${status} - ${method} ${url}`, error.message);
    return Promise.reject(error);
  }
);

gatewayApi.interceptors.request.use(
  (config) => {
    console.log(`🌐 Gateway Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
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