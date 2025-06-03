import React, { useState, useEffect } from 'react';
import RouteList from './RouteList';
import { api } from '../service/api';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [routes, setRoutes] = useState([]);
  const [upstreams, setUpstreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({
    wordpress: 'testing',
    gofiber: 'testing',
    apisix: 'testing'
  });

  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    await Promise.all([
      loadData(),
      testAPIs()
    ]);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [routesData, upstreamsData] = await Promise.all([
        api.getRoutes().catch((err) => {
          console.warn('Failed to load routes:', err.message);
          return { list: [] };
        }),
        api.getUpstreams().catch((err) => {
          console.warn('Failed to load upstreams:', err.message);
          return { list: [] };
        })
      ]);
      
      // Ensure we have arrays
      setRoutes(Array.isArray(routesData.list) ? routesData.list : []);
      setUpstreams(Array.isArray(upstreamsData.list) ? upstreamsData.list : []);
      setApiStatus(prev => ({ ...prev, apisix: 'success' }));
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load APISIX data: ' + error.message);
      setApiStatus(prev => ({ ...prev, apisix: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  const testAPIs = async () => {
    // Test WordPress API
    try {
      setApiStatus(prev => ({ ...prev, wordpress: 'testing' }));
      await api.testWordPressAPI();
      setApiStatus(prev => ({ ...prev, wordpress: 'success' }));
    } catch (error) {
      console.error('WordPress API test failed:', error);
      setApiStatus(prev => ({ ...prev, wordpress: 'error' }));
    }

    // Test GoFiber API
    try {
      setApiStatus(prev => ({ ...prev, gofiber: 'testing' }));
      await api.testGoFiberAPI();
      setApiStatus(prev => ({ ...prev, gofiber: 'success' }));
    } catch (error) {
      console.error('GoFiber API test failed:', error);
      setApiStatus(prev => ({ ...prev, gofiber: 'error' }));
    }
  };

  const setupRoutes = async () => {
    setLoading(true);
    try {
      const result = await api.setupInitialRoutes();
      await loadData();
      setError(null);
      if (result && result.success) {
        alert(`✅ ${result.message}`);
      }
    } catch (error) {
      const errorMsg = `Setup info: ${error.message}`;
      console.log(errorMsg);
      // Don't show as error in standalone mode
      alert(`ℹ️ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // This function is not currently used but kept for future implementation
  // eslint-disable-next-line no-unused-vars
  const handleRouteCreated = () => {
    // Reload data after route creation (though not possible in standalone)
    loadData();
    setActiveTab('routes');
  };

  const handleRouteDeleted = () => {
    // Reload data after route deletion (though not possible in standalone)
    loadData();
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

  // Ensure arrays have length property
  const routesLength = Array.isArray(routes) ? routes.length : 0;
  const upstreamsLength = Array.isArray(upstreams) ? upstreams.length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">APISIX Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage API routes and upstreams for WordPress and GoFiber services
          </p>
          
          {/* Standalone Mode Notice */}
          {/* <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800">
                <strong>Running in Standalone Mode:</strong> Routes are configured via apisix.yaml and cannot be modified through the dashboard.
              </p>
            </div>
          </div> */}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex text-red-400 hover:text-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500">APISIX Gateway</p>
                  <div className="flex items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.apisix)}`}>
                      {getStatusText(apiStatus.apisix)}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">(Standalone)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500">WordPress API</p>
                  <div className="flex items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.wordpress)}`}>
                      {getStatusText(apiStatus.wordpress)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v4a2 2 0 01-2 2H5z" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500">GoFiber Backend</p>
                  <div className="flex items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.gofiber)}`}>
                      {getStatusText(apiStatus.gofiber)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-blue-600">{routesLength}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Configured Routes</dt>
                    <dd className="text-sm text-gray-900">Static configuration</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-green-600">{upstreamsLength}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Upstreams</dt>
                    <dd className="text-sm text-gray-900">Backend services</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-purple-600">2</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Services</dt>
                    <dd className="text-sm text-gray-900">WordPress + GoFiber</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={setupRoutes}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking...
                  </>
                ) : (
                  'Check Routes Status'
                )}
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </button>
              <button
                onClick={testAPIs}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Test APIs
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('routes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'routes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Routes ({routesLength})
              </button>
              <button
                onClick={() => setActiveTab('upstreams')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upstreams'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upstreams ({upstreamsLength})
              </button>
              <button
                onClick={() => setActiveTab('testing')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'testing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                API Testing
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading && activeTab !== 'testing' ? (
              <div className="flex justify-center py-12">
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-600">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">System Overview (Standalone Mode)</h3>
                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">APISIX Configuration</h4>
                            <p className="text-sm text-gray-600 mb-4">
                              Running in standalone mode with static configuration from apisix.yaml file.
                            </p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Gateway Port:</span>
                                <span className="font-mono">9080</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Status Port:</span>
                                <span className="font-mono">9180</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Mode:</span>
                                <span className="font-mono text-blue-600">Standalone</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Backend Services</h4>
                            <p className="text-sm text-gray-600 mb-4">
                              WordPress provides REST API endpoints, while GoFiber handles custom business logic.
                            </p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>WordPress:</span>
                                <span className="font-mono">port 8080</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>GoFiber:</span>
                                <span className="font-mono">port 3000</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-3">Configured Routes</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded border">
                              <h5 className="font-medium text-sm text-gray-900">WordPress Posts</h5>
                              <p className="text-xs text-gray-600 mt-1">/api/posts → /wp-json/wp/v2/posts</p>
                            </div>
                            <div className="bg-white p-4 rounded border">
                              <h5 className="font-medium text-sm text-gray-900">GoFiber Data API</h5>
                              <p className="text-xs text-gray-600 mt-1">/api/data/* → gofiber:3000</p>
                            </div>
                            <div className="bg-white p-4 rounded border">
                              <h5 className="font-medium text-sm text-gray-900">Health Check</h5>
                              <p className="text-xs text-gray-600 mt-1">/api/health → gofiber:3000</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === 'routes' && (
                  <div>
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Standalone Mode:</strong> Routes are configured in the apisix.yaml file and cannot be modified through the dashboard.
                      </p>
                    </div>
                    <RouteList 
                      routes={routes} 
                      onRouteDeleted={handleRouteDeleted} 
                      showDeleteButton={false} 
                    />
                  </div>
                )}
                
                {activeTab === 'upstreams' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Upstreams</h3>
                    {upstreamsLength === 0 ? (
                      <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v4a2 2 0 01-2 2H5z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No upstreams</h3>
                        <p className="mt-1 text-sm text-gray-500">Upstreams will appear here when routes are loaded.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {upstreams.map((upstream, index) => {
                          const upstreamKey = upstream?.key || `upstream-${index}`;
                          const upstreamValue = upstream?.value || {};
                          
                          return (
                            <div key={upstreamKey} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                              <h4 className="font-medium text-gray-900 mb-2">
                                {upstreamValue.name || `Upstream ${upstreamKey}`}
                              </h4>
                              <div className="bg-white p-3 rounded border">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-gray-500">Type</p>
                                    <p className="text-sm text-gray-900">{upstreamValue.type || 'roundrobin'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-500">Nodes</p>
                                    <div className="space-y-1">
                                      {upstreamValue.nodes && typeof upstreamValue.nodes === 'object' ? 
                                        Object.entries(upstreamValue.nodes).map(([node, weight], nodeIndex) => (
                                          <div key={`${upstreamKey}-node-${nodeIndex}`} className="flex justify-between text-sm">
                                            <span className="font-mono text-gray-900">{node}</span>
                                            <span className="text-gray-500">Weight: {weight}</span>
                                          </div>
                                        )) : (
                                          <span className="text-sm text-gray-500">No nodes configured</span>
                                        )
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'testing' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">API Testing</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="font-medium text-gray-900 mb-4">WordPress API Test</h4>
                        <p className="text-sm text-gray-600 mb-4">Test WordPress REST API through APISIX</p>
                        <button
                          onClick={async () => {
                            try {
                              setApiStatus(prev => ({ ...prev, wordpress: 'testing' }));
                              await api.testWordPressAPI();
                              setApiStatus(prev => ({ ...prev, wordpress: 'success' }));
                              alert('✅ WordPress API is working!');
                            } catch (error) {
                              setApiStatus(prev => ({ ...prev, wordpress: 'error' }));
                              alert(`❌ WordPress API test failed: ${error.message}`);
                            }
                          }}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
                        >
                          Test WordPress
                        </button>
                        <div className="mt-3 text-xs text-gray-500">
                          <p>Endpoint: /api/posts</p>
                          <p>Target: /wp-json/wp/v2/posts</p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="font-medium text-gray-900 mb-4">GoFiber API Test</h4>
                        <p className="text-sm text-gray-600 mb-4">Test GoFiber backend through APISIX</p>
                        <button
                          onClick={async () => {
                            try {
                              setApiStatus(prev => ({ ...prev, gofiber: 'testing' }));
                              await api.testGoFiberAPI();
                              setApiStatus(prev => ({ ...prev, gofiber: 'success' }));
                              alert('✅ GoFiber API is working!');
                            } catch (error) {
                              setApiStatus(prev => ({ ...prev, gofiber: 'error' }));
                              alert(`❌ GoFiber API test failed: ${error.message}`);
                            }
                          }}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                        >
                          Test GoFiber
                        </button>
                        <div className="mt-3 text-xs text-gray-500">
                          <p>Endpoint: /api/data</p>
                          <p>Target: gofiber-backend:3000</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Test Results</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">APISIX Gateway:</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.apisix)}`}>
                            {getStatusText(apiStatus.apisix)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">WordPress API:</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.wordpress)}`}>
                            {getStatusText(apiStatus.wordpress)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">GoFiber Backend:</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apiStatus.gofiber)}`}>
                            {getStatusText(apiStatus.gofiber)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;