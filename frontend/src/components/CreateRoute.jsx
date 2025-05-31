import React, { useState } from 'react';
import { api } from '../service/api';

const CreateRoute = ({ onRouteCreated }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    uri: '',
    methods: ['GET'],
    upstream_type: 'roundrobin',
    upstream_host: '',
    upstream_port: '',
    plugins: {
      enable_cors: false,
      enable_auth: false,
      enable_proxy_rewrite: false,
      proxy_rewrite_uri: ''
    }
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('plugins.')) {
      const pluginName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        plugins: {
          ...prev.plugins,
          [pluginName]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleMethodChange = (method) => {
    setFormData(prev => ({
      ...prev,
      methods: prev.methods.includes(method)
        ? prev.methods.filter(m => m !== method)
        : [...prev.methods, method]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build route configuration
      const routeConfig = {
        id: formData.id,
        name: formData.name,
        uri: formData.uri,
        methods: formData.methods,
        upstream: {
          type: formData.upstream_type,
          nodes: {
            [`${formData.upstream_host}:${formData.upstream_port}`]: 1
          }
        }
      };

      // Add plugins if enabled
      const plugins = {};
      
      if (formData.plugins.enable_cors) {
        plugins.cors = {
          allow_origins: "*",
          allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
          allow_headers: "Origin,Content-Type,Accept,Authorization"
        };
      }

      if (formData.plugins.enable_auth) {
        plugins['key-auth'] = {};
      }

      if (formData.plugins.enable_proxy_rewrite && formData.plugins.proxy_rewrite_uri) {
        plugins['proxy-rewrite'] = {
          uri: formData.plugins.proxy_rewrite_uri
        };
      }

      if (Object.keys(plugins).length > 0) {
        routeConfig.plugins = plugins;
      }

      await api.createRoute(routeConfig);
      
      // Reset form
      setFormData({
        id: '',
        name: '',
        uri: '',
        methods: ['GET'],
        upstream_type: 'roundrobin',
        upstream_host: '',
        upstream_port: '',
        plugins: {
          enable_cors: false,
          enable_auth: false,
          enable_proxy_rewrite: false,
          proxy_rewrite_uri: ''
        }
      });

      onRouteCreated();
      alert('Route created successfully!');
    } catch (error) {
      alert('Error creating route: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFillWordPress = () => {
    setFormData(prev => ({
      ...prev,
      id: 'wordpress-posts',
      name: 'WordPress Posts API',
      uri: '/api/wp-posts',
      methods: ['GET'],
      upstream_host: 'wordpress',
      upstream_port: '80',
      plugins: {
        ...prev.plugins,
        enable_cors: true,
        enable_proxy_rewrite: true,
        proxy_rewrite_uri: '/wp-json/wp/v2/posts'
      }
    }));
  };

  const quickFillGoFiber = () => {
    setFormData(prev => ({
      ...prev,
      id: 'gofiber-api',
      name: 'GoFiber Data API',
      uri: '/api/gofiber/*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      upstream_host: 'gofiber-backend',
      upstream_port: '3000',
      plugins: {
        ...prev.plugins,
        enable_cors: true,
        enable_auth: false
      }
    }));
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-6">Create New Route</h3>

      {/* Quick Fill Buttons */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-blue-900 mb-3">Quick Fill Templates</h4>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={quickFillWordPress}
            className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            WordPress API
          </button>
          <button
            type="button"
            onClick={quickFillGoFiber}
            className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            GoFiber API
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Basic Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route ID *
              </label>
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., my-api-route"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., My API Route"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URI Pattern *
              </label>
              <input
                type="text"
                name="uri"
                value={formData.uri}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., /api/users or /api/data/*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use /* for wildcard matching (e.g., /api/data/*)
              </p>
            </div>
          </div>

          {/* HTTP Methods */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTTP Methods
            </label>
            <div className="flex flex-wrap gap-3">
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((method) => (
                <label key={method} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.methods.includes(method)}
                    onChange={() => handleMethodChange(method)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{method}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Upstream Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Upstream Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load Balancer Type
              </label>
              <select
                name="upstream_type"
                value={formData.upstream_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="roundrobin">Round Robin</option>
                <option value="chash">Consistent Hash</option>
                <option value="ewma">EWMA</option>
                <option value="least_conn">Least Connections</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upstream Host *
              </label>
              <input
                type="text"
                name="upstream_host"
                value={formData.upstream_host}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., wordpress or gofiber-backend"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upstream Port *
              </label>
              <input
                type="number"
                name="upstream_port"
                value={formData.upstream_port}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 80 or 3000"
              />
            </div>
          </div>
        </div>

        {/* Plugins Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Plugins</h4>
          
          <div className="space-y-4">
            {/* CORS Plugin */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  name="plugins.enable_cors"
                  checked={formData.plugins.enable_cors}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="ml-3">
                <label className="text-sm font-medium text-gray-700">
                  Enable CORS
                </label>
                <p className="text-xs text-gray-500">
                  Allow cross-origin requests with default settings
                </p>
              </div>
            </div>

            {/* Key Auth Plugin */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  name="plugins.enable_auth"
                  checked={formData.plugins.enable_auth}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="ml-3">
                <label className="text-sm font-medium text-gray-700">
                  Enable API Key Authentication
                </label>
                <p className="text-xs text-gray-500">
                  Require API key for access
                </p>
              </div>
            </div>

            {/* Proxy Rewrite Plugin */}
            <div className="space-y-2">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    name="plugins.enable_proxy_rewrite"
                    checked={formData.plugins.enable_proxy_rewrite}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </div>
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Proxy Rewrite
                  </label>
                  <p className="text-xs text-gray-500">
                    Rewrite the URI before sending to upstream
                  </p>
                </div>
              </div>
              
              {formData.plugins.enable_proxy_rewrite && (
                <div className="ml-8">
                  <input
                    type="text"
                    name="plugins.proxy_rewrite_uri"
                    value={formData.plugins.proxy_rewrite_uri}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., /wp-json/wp/v2/posts"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setFormData({
              id: '',
              name: '',
              uri: '',
              methods: ['GET'],
              upstream_type: 'roundrobin',
              upstream_host: '',
              upstream_port: '',
              plugins: {
                enable_cors: false,
                enable_auth: false,
                enable_proxy_rewrite: false,
                proxy_rewrite_uri: ''
              }
            })}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              'Create Route'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRoute;