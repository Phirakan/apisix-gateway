import axios from "axios";

// Configuration
const APISIX_ADMIN_URL = import.meta.env.VITE_APISIX_ADMIN_URL || "http://localhost:9180";
const APISIX_GATEWAY_URL = "http://localhost:9080";
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

// Simple error handler
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  
  if (error.response) {
    const message = error.response.data?.message || error.response.statusText || 'Server error';
    throw new Error(`${message} (${error.response.status})`);
  } else if (error.request) {
    throw new Error('Network error - please check if services are running');
  } else {
    throw new Error(error.message || 'Unknown error occurred');
  }
};

// API functions
export const api = {
  // Routes management
  getRoutes: async () => {
    try {
      const response = await apisixAdminApi.get("/routes");
      return response.data;
    } catch (error) {
      handleError(error, 'getRoutes');
    }
  },

  createRoute: async (routeData) => {
    try {
      if (!routeData.id || !routeData.uri) {
        throw new Error('Route ID and URI are required');
      }
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

  // API testing - simplified version
  testWordPressAPI: async () => {
    try {
      // Try through APISIX first
      const response = await gatewayApi.get("/api/posts", { timeout: 5000 });
      return response.data;
    } catch (gatewayError) {
      try {
        // Fallback to direct WordPress access
        const response = await axios.get("http://localhost:8080/wp-json/wp/v2/posts", { timeout: 5000 });
        return response.data;
      } catch (directError) {
        console.error('Direct WordPress access also failed:', directError);
        throw gatewayError; // Throw the original gateway error
      }
    }
  },

  testGoFiberAPI: async () => {
    try {
      // Try through APISIX first
      const response = await gatewayApi.get("/api/data", { timeout: 5000 });
      return response.data;
    } catch (gatewayError) {
      try {
        // Fallback to direct GoFiber access
        const response = await axios.get("http://localhost:3000/api/data", { timeout: 5000 });
        return response.data;
      } catch (directError) {
        console.error('Direct GoFiber access also failed:', directError);
        throw gatewayError; // Throw the original gateway error
      }
    }
  },

  testGoFiberHealth: async () => {
    try {
      // Try through APISIX first
      const response = await gatewayApi.get("/api/health", { timeout: 5000 });
      return response.data;
    } catch (gatewayError) {
      try {
        // Fallback to direct access
        const response = await axios.get("http://localhost:3000/api/health", { timeout: 5000 });
        return response.data;
      } catch (directError) {
        console.error('Direct health check also failed:', directError);
        throw gatewayError; // Throw the original gateway error
      }
    }
  },

  // Setup initial routes
  setupInitialRoutes: async () => {
    try {
      console.log('Setting up WordPress route...');
      const wordPressRoute = {
        id: "wordpress-posts",
        name: "WordPress Posts API",
        uri: "/api/posts",
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
          },
        },
      };

      await api.createRoute(wordPressRoute);
      console.log('WordPress route created');

      console.log('Setting up GoFiber data route...');
      const goFiberRoute = {
        id: "gofiber-data",
        name: "GoFiber Data API",
        uri: "/api/data/*",
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
          },
        },
      };

      await api.createRoute(goFiberRoute);
      console.log('GoFiber data route created');

      console.log('Setting up GoFiber health route...');
      const healthRoute = {
        id: "gofiber-health",
        name: "GoFiber Health Check",
        uri: "/api/health",
        upstream: {
          type: "roundrobin",
          nodes: {
            "gofiber-backend:3000": 1,
          },
        },
      };

      await api.createRoute(healthRoute);
      console.log('GoFiber health route created');

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

  // Simple ping function
  ping: async () => {
    const results = {
      apisix: false,
      gofiber: false,
      wordpress: false,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.get(`${APISIX_GATEWAY_URL}/apisix/status`, { timeout: 3000 });
      results.apisix = true;
    } catch (error) {
      console.log('APISIX ping failed:', error.message);
    }

    try {
      await api.testGoFiberHealth();
      results.gofiber = true;
    } catch (error) {
      console.log('GoFiber ping failed:', error.message);
    }

    try {
      await api.testWordPressAPI();
      results.wordpress = true;
    } catch (error) {
      console.log('WordPress ping failed:', error.message);
    }

    return results;
  },
};

// Add request/response logging
apisixAdminApi.interceptors.request.use(
  (config) => {
    console.log(`Admin API: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  }
);

apisixAdminApi.interceptors.response.use(
  (response) => {
    console.log(`Admin API Response: ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`Admin API Error: ${error.response?.status}`, error.message);
    return Promise.reject(error);
  }
);

gatewayApi.interceptors.request.use(
  (config) => {
    console.log(`Gateway: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  }
);

export default api;