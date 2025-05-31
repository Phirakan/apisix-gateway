import axios from "axios";

// ใช้ localhost เพราะ React จะรันใน browser
const APISIX_ADMIN_URL =
  import.meta.env.VITE_APISIX_ADMIN_URL || "http://localhost:9180";
const ADMIN_KEY = "edd1c9f034335f136f87ad84b625c8f1";

// Create axios instance for APISIX Admin API
const apisixApi = axios.create({
  baseURL: `${APISIX_ADMIN_URL}/apisix/admin`,
  headers: {
    "X-API-KEY": ADMIN_KEY,
    "Content-Type": "application/json",
  },
});

// API functions
export const api = {
  // Routes
  getRoutes: async () => {
    try {
      const response = await apisixApi.get("/routes");
      return response.data;
    } catch (error) {
      console.error("Error fetching routes:", error);
      throw error;
    }
  },

  createRoute: async (routeData) => {
    try {
      const response = await apisixApi.post("/routes", routeData);
      return response.data;
    } catch (error) {
      console.error("Error creating route:", error);
      throw error;
    }
  },

  deleteRoute: async (routeId) => {
    try {
      const response = await apisixApi.delete(`/routes/${routeId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting route:", error);
      throw error;
    }
  },

  // Upstreams
  getUpstreams: async () => {
    try {
      const response = await apisixApi.get("/upstreams");
      return response.data;
    } catch (error) {
      console.error("Error fetching upstreams:", error);
      throw error;
    }
  },

  createUpstream: async (upstreamData) => {
    try {
      const response = await apisixApi.post("/upstreams", upstreamData);
      return response.data;
    } catch (error) {
      console.error("Error creating upstream:", error);
      throw error;
    }
  },

  deleteUpstream: async (upstreamId) => {
    try {
      const response = await apisixApi.delete(`/upstreams/${upstreamId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting upstream:", error);
      throw error;
    }
  },

  // Test API endpoints - ใช้ localhost
  testWordPressAPI: async () => {
    try {
      const response = await axios.get("http://localhost:9080/api/posts");
      return response.data;
    } catch (error) {
      console.error("Error testing WordPress API:", error);
      throw error;
    }
  },

  testGoFiberAPI: async () => {
    try {
      const response = await axios.get("http://localhost:9080/api/data");
      return response.data;
    } catch (error) {
      console.error("Error testing GoFiber API:", error);
      throw error;
    }
  },

  // Setup initial routes
  setupInitialRoutes: async () => {
    try {
      const wordPressRoute = {
        id: "wordpress-route",
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
        },
      };

      const goFiberRoute = {
        id: "gofiber-route",
        uri: "/api/data/*",
        upstream: {
          type: "roundrobin",
          nodes: {
            "gofiber-backend:3000": 1,
          },
        },
      };

      await api.createRoute(wordPressRoute);
      await api.createRoute(goFiberRoute);

      console.log("Initial routes created successfully");
    } catch (error) {
      console.error("Error setting up initial routes:", error);
      throw error;
    }
  },
};
