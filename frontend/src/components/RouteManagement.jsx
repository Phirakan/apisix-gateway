// frontend/src/components/RouteManagement.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../service/api';

const RouteManagement = ({ onRouteCreated = () => {}, showCreateForm = true }) => {
  const [routes, setRoutes] = useState([]);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    uri: '',
    methods: ['GET'],
    target: '',
    port: 80,
    type: 'generic',
    plugins: {
      cors: true,
      auth: false,
      rewrite: false,
      rewrite_uri: ''
    }
  });

  useEffect(() => {
    loadRoutes();
    loadTemplates();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await api.getRoutes();
      setRoutes(response.list || []);
      setError(null);
    } catch (error) {
      console.error('Failed to load routes:', error);
      setError('Failed to load routes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.getRouteTemplates();
      setTemplates(response.templates || {});
    } catch (error) {
      console.warn('Failed to load templates:', error);
    }
  };

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
    } else if (name === 'methods') {
      // Handle multiple select for methods
      const selectedMethods = Array.from(e.target.selectedOptions, option => option.value);
      setFormData(prev => ({
        ...prev,
        methods: selectedMethods
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleTemplateSelect = (templateName) => {
    const template = templates[templateName];
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        uri: template.uri,
        methods: template.methods || ['GET'],
        target: template.target,
        port: template.port,
        type: templateName,
        plugins: {
          cors: true,
          auth: templateName === 'gofiber',
          rewrite: templateName === 'wordpress',
          rewrite_uri: templateName === 'wordpress' ? '/wp-json/wp/v2$1' : ''
        }
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingRoute) {
        // Update existing route
        await api.updateRoute(editingRoute.id, {
          name: formData.name,
          uri: formData.uri,
          methods: formData.methods,
          upstream: {
            type: 'roundrobin',
            nodes: {
              [`${formData.target}:${formData.port}`]: 1
            }
          },
          plugins: buildPlugins(formData.plugins)
        });
      } else {
        // Create new route using quick route API
        await api.createQuickRoute({
          type: formData.type,
          name: formData.name,
          uri: formData.uri,
          target: formData.target,
          port: parseInt(formData.port)
        });
      }

      // Reset form and reload routes
      resetForm();
      await loadRoutes();
      onRouteCreated();
      
      // Show success message
      alert(editingRoute ? 'Route updated successfully!' : 'Route created successfully!');
    } catch (error) {
      setError('Failed to save route: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (route) => {
    if (!window.confirm(`Are you sure you want to delete route "${route.value?.name || route.key}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.deleteRoute(route.value?.id || route.key);
      await loadRoutes();
      alert('Route deleted successfully!');
    } catch (error) {
      setError('Failed to delete route: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (route) => {
    const routeValue = route.value || {};
    setEditingRoute(routeValue);
    
    // Extract upstream info
    const firstNode = routeValue.upstream?.nodes ? Object.keys(routeValue.upstream.nodes)[0] : '';
    const [target, port] = firstNode ? firstNode.split(':') : ['', '80'];
    
    setFormData({
      name: routeValue.name || '',
      uri: routeValue.uri || '',
      methods: routeValue.methods || ['GET'],
      target: target || '',
      port: parseInt(port) || 80,
      type: 'generic',
      plugins: {
        cors: !!routeValue.plugins?.cors,
        auth: !!routeValue.plugins?.['key-auth'],
        rewrite: !!routeValue.plugins?.['proxy-rewrite'],
        rewrite_uri: routeValue.plugins?.['proxy-rewrite']?.regex_uri?.[1] || ''
      }
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      uri: '',
      methods: ['GET'],
      target: '',
      port: 80,
      type: 'generic',
      plugins: {
        cors: true,
        auth: false,
        rewrite: false,
        rewrite_uri: ''
      }
    });
    setShowForm(false);
    setEditingRoute(null);
  };

  const buildPlugins = (pluginConfig) => {
    const plugins = {};
    
    if (pluginConfig.cors) {
      plugins.cors = {
        allow_origins: "*",
        allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
        allow_headers: "Origin,Content-Type,Accept,Authorization,X-Requested-With"
      };
    }
    
    if (pluginConfig.auth) {
      plugins['key-auth'] = {};
    }
    
    if (pluginConfig.rewrite && pluginConfig.rewrite_uri) {
      plugins['proxy-rewrite'] = {
        regex_uri: [
          `^${formData.uri.replace('*', '(.*)')}`,
          pluginConfig.rewrite_uri
        ]
      };
    }
    
    return plugins;
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      await api.reloadAPISIX();
      alert('APISIX reload initiated. Configuration changes will take effect after container restart.');
    } catch (error) {
      setError('Failed to reload APISIX: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Route Management</h2>
          <p className="text-gray-600">Create, edit, and manage APISIX routes dynamically</p>
        </div>
        <div className="flex space-x-3">
          {showCreateForm && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? 'Cancel' : 'Create Route'}
            </button>
          )}
          <button
            onClick={loadRoutes}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleReload}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload APISIX
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {editingRoute ? 'Edit Route' : 'Create New Route'}
          </h3>

          {/* Template Selection */}
          {!editingRoute && Object.keys(templates).length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Templates
              </label>
              <div className="flex space-x-3">
                {Object.entries(templates).map(([key, template]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTemplateSelect(key)}
                    className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Route Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., My API Route"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URI Pattern *
                </label>
                <input
                  type="text"
                  name="uri"
                  value={formData.uri}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., /api/my-service/*"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Host *
                </label>
                <input
                  type="text"
                  name="target"
                  value={formData.target}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., my-service or 192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Port *
                </label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  required
                  min="1"
                  max="65535"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="80"
                />
              </div>
            </div>

            {/* HTTP Methods */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HTTP Methods
              </label>
              <div className="flex flex-wrap gap-3">
                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((method) => (
                  <label key={method} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.methods.includes(method)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          methods: checked
                            ? [...prev.methods, method]
                            : prev.methods.filter(m => m !== method)
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{method}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Plugins */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Plugins
              </label>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="plugins.cors"
                    checked={formData.plugins.cors}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <label className="text-sm font-medium text-gray-700">
                      Enable CORS
                    </label>
                    <p className="text-xs text-gray-500">Allow cross-origin requests</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="plugins.auth"
                    checked={formData.plugins.auth}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <label className="text-sm font-medium text-gray-700">
                      Enable API Key Authentication
                    </label>
                    <p className="text-xs text-gray-500">Require API key for access</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      name="plugins.rewrite"
                      checked={formData.plugins.rewrite}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700">
                        Enable Proxy Rewrite
                      </label>
                      <p className="text-xs text-gray-500">Rewrite URI before forwarding</p>
                    </div>
                  </div>
                  {formData.plugins.rewrite && (
                    <div className="ml-8">
                      <input
                        type="text"
                        name="plugins.rewrite_uri"
                        value={formData.plugins.rewrite_uri}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., /wp-json/wp/v2$1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (editingRoute ? 'Update Route' : 'Create Route')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Routes List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Current Routes ({routes.length})
          </h3>
        </div>
        
        {loading && !showForm ? (
          <div className="flex justify-center py-12">
            <div className="flex items-center">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-600">Loading routes...</span>
            </div>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No routes found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first route.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {routes.map((route, index) => {
              const routeKey = route?.key || `route-${index}`;
              const routeValue = route?.value || {};
              
              return (
                <div key={routeKey} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {routeValue.name || `Route ${routeKey}`}
                        </h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">URI Pattern</p>
                          <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                            {routeValue.uri || 'N/A'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-500">Methods</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(routeValue.methods || []).map((method, methodIndex) => (
                              <span
                                key={`${routeKey}-method-${methodIndex}`}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {method}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-500">Upstream</p>
                          <div className="text-sm text-gray-900">
                            {routeValue.upstream?.nodes && Object.keys(routeValue.upstream.nodes).map((node, nodeIndex) => (
                              <div key={`${routeKey}-node-${nodeIndex}`} className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                                {node}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Plugins */}
                      {routeValue.plugins && Object.keys(routeValue.plugins).length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-500 mb-2">Plugins</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(routeValue.plugins).map((plugin, pluginIndex) => (
                              <span
                                key={`${routeKey}-plugin-${pluginIndex}`}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                              >
                                {plugin}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex-shrink-0 flex space-x-2">
                      <button
                        onClick={() => handleEdit(route)}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        title="Edit Route"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(route)}
                        className="inline-flex items-center p-2 border border-red-300 rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100"
                        title="Delete Route"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Dynamic Route Management
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Routes are dynamically updated in the apisix.yaml configuration file</li>
                <li>Changes require APISIX container restart to take effect</li>
                <li>Use "Reload APISIX" button or restart the container manually</li>
                <li>All routes are persistent and stored in the configuration file</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteManagement;