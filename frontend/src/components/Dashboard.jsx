// frontend/src/components/Dashboard.jsx - ครบครันทุกฟีเจอร์
import React, { useState, useEffect } from 'react';
import { api } from '../service/api';

const Dashboard = () => {
  // eslint-disable-next-line no-unused-vars
  const [activeTab, setActiveTab] = useState('overview');
  const [routes, setRoutes] = useState([]);
  const [upstreams, setUpstreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({
    wordpress: 'unknown',
    gofiber: 'unknown',
    apisix: 'unknown'
  });

  // Form state for creating/editing routes
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({
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
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    await Promise.all([
      loadRoutes(),
      loadUpstreams(),
      testAPIs()
    ]);
  };

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await api.getRoutes();
      setRoutes(Array.isArray(response.list) ? response.list : []);
      setError(null);
    } catch (error) {
      console.error('Failed to load routes:', error);
      setError('Failed to load routes: ' + error.message);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUpstreams = async () => {
    try {
      const response = await api.getUpstreams();
      setUpstreams(Array.isArray(response.list) ? response.list : []);
    } catch (error) {
      console.warn('Failed to load upstreams:', error);
      setUpstreams([]);
    }
  };

  const testAPIs = async () => {
    // Test APISIX
    try {
      setApiStatus(prev => ({ ...prev, apisix: 'testing' }));
      await api.checkAPISIXHealth();
      setApiStatus(prev => ({ ...prev, apisix: 'success' }));
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setApiStatus(prev => ({ ...prev, apisix: 'error' }));
    }

    // Test WordPress
    try {
      setApiStatus(prev => ({ ...prev, wordpress: 'testing' }));
      await api.testWordPressAPI();
      setApiStatus(prev => ({ ...prev, wordpress: 'success' }));
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setApiStatus(prev => ({ ...prev, wordpress: 'error' }));
    }

    // Test GoFiber
    try {
      setApiStatus(prev => ({ ...prev, gofiber: 'testing' }));
      await api.testGoFiberAPI();
      setApiStatus(prev => ({ ...prev, gofiber: 'success' }));
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setApiStatus(prev => ({ ...prev, gofiber: 'error' }));
    }
  };

  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingRoute) {
        await api.updateRoute(editingRoute.id, {
          name: routeForm.name,
          uri: routeForm.uri,
          methods: routeForm.methods,
          upstream: {
            type: 'roundrobin',
            nodes: { [`${routeForm.target}:${routeForm.port}`]: 1 }
          },
          plugins: buildPlugins()
        });
        alert('✅ Route updated successfully! Please restart APISIX container.');
      } else {
        await api.createQuickRoute({
          type: routeForm.type,
          name: routeForm.name,
          uri: routeForm.uri,
          target: routeForm.target,
          port: parseInt(routeForm.port)
        });
        alert('✅ Route created successfully! Please restart APISIX container.');
      }

      resetRouteForm();
      await loadRoutes();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (route) => {
    const routeId = route.value?.id || route.key;
    const routeName = route.value?.name || `Route ${routeId}`;

    if (window.confirm(`Are you sure you want to delete "${routeName}"?`)) {
      try {
        setLoading(true);
        await api.deleteRoute(routeId);
        alert('✅ Route deleted successfully! Please restart APISIX container.');
        await loadRoutes();
      } catch (error) {
        alert('❌ Error deleting route: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditRoute = (route) => {
    const routeValue = route.value || {};
    setEditingRoute(routeValue);

    const firstNode = routeValue.upstream?.nodes ? Object.keys(routeValue.upstream.nodes)[0] : '';
    const [target, port] = firstNode ? firstNode.split(':') : ['', '80'];

    setRouteForm({
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
    setShowRouteForm(true);
  };

  const resetRouteForm = () => {
    setRouteForm({
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
    setShowRouteForm(false);
    setEditingRoute(null);
  };

  const buildPlugins = () => {
    const plugins = {};
    
    if (routeForm.plugins.cors) {
      plugins.cors = {
        allow_origins: "*",
        allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
        allow_headers: "Origin,Content-Type,Accept,Authorization,X-Requested-With"
      };
    }
    
    if (routeForm.plugins.auth) {
      plugins['key-auth'] = {};
    }
    
    if (routeForm.plugins.rewrite && routeForm.plugins.rewrite_uri) {
      plugins['proxy-rewrite'] = {
        regex_uri: [
          `^${routeForm.uri.replace('*', '(.*)')}`,
          routeForm.plugins.rewrite_uri
        ]
      };
    }
    
    return plugins;
  };

  const handleQuickTemplate = (template) => {
    const templates = {
      wordpress: {
        name: 'WordPress Posts API',
        uri: '/api/wp-posts/*',
        target: 'wordpress',
        port: 80,
        type: 'wordpress',
        plugins: { cors: true, rewrite: true, rewrite_uri: '/wp-json/wp/v2/posts$1' }
      },
      gofiber: {
        name: 'GoFiber Data API',
        uri: '/api/gofiber-data/*',
        target: 'gofiber-backend',
        port: 3000,
        type: 'gofiber',
        plugins: { cors: true, auth: false }
      }
    };

    const tmpl = templates[template];
    if (tmpl) {
      setRouteForm(prev => ({ ...prev, ...tmpl, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
    }
  };

  const handleReloadAPISIX = async () => {
    try {
      setLoading(true);
      await api.reloadAPISIX();
      alert('🔄 APISIX reload initiated. Please restart the APISIX container manually for changes to take effect.');
    } catch (error) {
      alert('❌ Error reloading APISIX: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'testing': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'success': return 'Connected';
      case 'error': return 'Error';
      case 'testing': return 'Testing...';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">APISIX Dynamic Route Management</h1>
          <p className="mt-2 text-gray-600">
            Complete dashboard for managing APISIX routes via GoFiber backend
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex justify-between items-start">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { name: 'APISIX Gateway', status: apiStatus.apisix, icon: '⚡', color: 'blue' },
            { name: 'WordPress API', status: apiStatus.wordpress, icon: '📝', color: 'purple' },
            { name: 'GoFiber Backend', status: apiStatus.gofiber, icon: '🚀', color: 'green' }
          ].map((service, index) => (
            <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className={`w-10 h-10 bg-${service.color}-100 rounded-lg flex items-center justify-center text-lg`}>
                    {service.icon}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">{service.name}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(service.status)}`}>
                      {getStatusText(service.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-blue-600">{routes.length}</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Routes</p>
                <p className="text-xs text-gray-400">Dynamic management</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-green-600">{upstreams.length}</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Upstreams</p>
                <p className="text-xs text-gray-400">Backend services</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-purple-600">2</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Services</p>
                <p className="text-xs text-gray-400">WordPress + GoFiber</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setShowRouteForm(true)}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Route
              </button>
              <button
                onClick={loadRoutes}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Routes
              </button>
              <button
                onClick={testAPIs}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Test APIs
              </button>
              <button
                onClick={handleReloadAPISIX}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload APISIX
              </button>
            </div>
          </div>
        </div>

        {/* Route Creation Form */}
        {showRouteForm && (
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingRoute ? 'Edit Route' : 'Create New Route'}
              </h3>
            </div>
            <div className="p-6">
              {/* Quick Templates */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleQuickTemplate('wordpress')}
                    className="px-3 py-2 border border-purple-300 rounded-md text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100"
                  >
                    WordPress API
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTemplate('gofiber')}
                    className="px-3 py-2 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
                  >
                    GoFiber API
                  </button>
                </div>
              </div>

              <form onSubmit={handleRouteSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
                    <input
                      type="text"
                      value={routeForm.name}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., My API Route"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">URI Pattern *</label>
                    <input
                      type="text"
                      value={routeForm.uri}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, uri: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., /api/my-service/*"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Host *</label>
                    <input
                      type="text"
                      value={routeForm.target}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, target: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., wordpress or gofiber-backend"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Port *</label>
                    <input
                      type="number"
                      value={routeForm.port}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, port: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="80"
                    />
                  </div>
                </div>

                {/* HTTP Methods */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HTTP Methods</label>
                  <div className="flex flex-wrap gap-3">
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].map((method) => (
                      <label key={method} className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={routeForm.methods.includes(method)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRouteForm(prev => ({
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
                  <label className="block text-sm font-medium text-gray-700 mb-4">Plugins</label>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={routeForm.plugins.cors}
                        onChange={(e) => setRouteForm(prev => ({
                          ...prev,
                          plugins: { ...prev.plugins, cors: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">Enable CORS</label>
                        <p className="text-xs text-gray-500">Allow cross-origin requests</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={routeForm.plugins.auth}
                        onChange={(e) => setRouteForm(prev => ({
                          ...prev,
                          plugins: { ...prev.plugins, auth: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">Enable API Key Auth</label>
                        <p className="text-xs text-gray-500">Require API key for access</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={routeForm.plugins.rewrite}
                          onChange={(e) => setRouteForm(prev => ({
                            ...prev,
                            plugins: { ...prev.plugins, rewrite: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <label className="text-sm font-medium text-gray-700">Enable Proxy Rewrite</label>
                          <p className="text-xs text-gray-500">Rewrite URI before forwarding</p>
                        </div>
                      </div>
                      {routeForm.plugins.rewrite && (
                        <div className="ml-8">
                          <input
                            type="text"
                            value={routeForm.plugins.rewrite_uri}
                            onChange={(e) => setRouteForm(prev => ({
                              ...prev,
                              plugins: { ...prev.plugins, rewrite_uri: e.target.value }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., /wp-json/wp/v2/posts$1"
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
                    onClick={resetRouteForm}
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
          </div>
        )}

        {/* Routes List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">
              Active Routes ({routes.length})
            </h3>
          </div>
          
          {loading && !showRouteForm ? (
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
              <p className="mt-1 text-sm text-gray-500">Create your first route to get started.</p>
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Dynamic
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
                            <p className="text-sm font-medium text-gray-500 mb-2">Active Plugins</p>
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

                        {/* Description */}
                        {routeValue.desc && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-500">Description</p>
                            <p className="text-sm text-gray-700">{routeValue.desc}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="ml-4 flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() => handleEditRoute(route)}
                          className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                          title="Edit Route"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route)}
                          className="inline-flex items-center p-2 border border-red-300 rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100"
                          title="Delete Route"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Detailed Configuration (Collapsible) */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center focus:outline-none">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        View Configuration Details
                      </summary>
                      
                      <div className="mt-3 space-y-4">
                        {/* Upstream Details */}
                        {routeValue.upstream && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Upstream Configuration</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-gray-500">Load Balancer Type</p>
                                <p className="text-sm text-gray-900">{routeValue.upstream.type || 'roundrobin'}</p>
                              </div>
                              {routeValue.upstream.timeout && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500">Timeouts (seconds)</p>
                                  <div className="text-xs text-gray-700">
                                    Connect: {routeValue.upstream.timeout.connect}, 
                                    Send: {routeValue.upstream.timeout.send}, 
                                    Read: {routeValue.upstream.timeout.read}
                                  </div>
                                </div>
                              )}
                            </div>
                            {routeValue.upstream.nodes && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">Backend Nodes</p>
                                <div className="space-y-1">
                                  {Object.entries(routeValue.upstream.nodes).map(([node, weight], nodeIndex) => (
                                    <div key={nodeIndex} className="flex justify-between text-sm bg-white px-3 py-2 rounded border">
                                      <span className="font-mono text-gray-900">{node}</span>
                                      <span className="text-gray-500">Weight: {weight}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Plugin Details */}
                        {routeValue.plugins && Object.keys(routeValue.plugins).length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Plugin Configuration</h5>
                            <div className="space-y-3">
                              {Object.entries(routeValue.plugins).map(([pluginName, config], configIndex) => (
                                <div key={configIndex} className="bg-white p-3 rounded border">
                                  <p className="text-sm font-medium text-gray-800 mb-2">{pluginName}</p>
                                  <div className="bg-gray-100 p-2 rounded">
                                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                                      {JSON.stringify(config, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Raw JSON Configuration */}
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-100 mb-2">Raw JSON Configuration</h5>
                          <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(routeValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dynamic Management Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Dynamic Route Management Active</h3>
                <div className="mt-2 text-sm text-green-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Routes can be created, edited, and deleted via dashboard</li>
                    <li>Changes are written to <code className="bg-green-100 px-1 rounded">apisix/apisix.yaml</code></li>
                    <li>APISIX container restart required for changes to take effect</li>
                    <li>All changes are automatically backed up</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* API Testing Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">API Testing Available</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Test routes through APISIX Gateway on port 9080</li>
                    <li>WordPress API: <code className="bg-blue-100 px-1 rounded">/api/posts</code></li>
                    <li>GoFiber API: <code className="bg-blue-100 px-1 rounded">/api/data</code></li>
                    <li>Health checks available for all services</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>APISIX Dynamic Route Management Dashboard</p>
          <p>Built with GoFiber Backend API • Real-time route configuration</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;