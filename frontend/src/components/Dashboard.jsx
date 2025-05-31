import React, { useState, useEffect } from 'react';
import RouteList from './RouteList';
import CreateRoute from './CreateRoute';
import { api } from '../service/api';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [upstreams, setUpstreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    wordpress: null,
    gofiber: null
  });

  useEffect(() => {
    loadData();
    testAPIs();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [routesData, upstreamsData] = await Promise.all([
        api.getRoutes(),
        api.getUpstreams()
      ]);
      
      setRoutes(routesData.list || []);
      setUpstreams(upstreamsData.list || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const testAPIs = async () => {
    try {
      await api.testWordPressAPI();
      setApiStatus(prev => ({ ...prev, wordpress: 'success' }));
    } catch (error) {
      console.error('WordPress API test failed:', error);
      setApiStatus(prev => ({ ...prev, wordpress: 'error' }));
    }

    try {
      await api.testGoFiberAPI();
      setApiStatus(prev => ({ ...prev, gofiber: 'success' }));
    } catch (error) {
      console.error('GoFiber API test failed:', error);
      setApiStatus(prev => ({ ...prev, gofiber: 'error' }));
    }
  };

  const setupRoutes = async () => {
    try {
      await api.setupInitialRoutes();
      await loadData();
      alert('Initial routes created successfully!');
    } catch (error) {
      alert('Error setting up routes: ' + error.message);
    }
  };

  const handleRouteCreated = () => {
    loadData();
  };

  const handleRouteDeleted = () => {
    loadData();
  };

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">APISIX Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage API routes and upstreams for your services
        </p>
      </div>

      {/* API Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">APISIX Status</p>
                <p className="text-lg font-semibold text-green-600">Running</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">WordPress API</p>
                <p className={`text-lg font-semibold ${
                  apiStatus.wordpress === 'success' ? 'text-green-600' : 
                  apiStatus.wordpress === 'error' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {apiStatus.wordpress === 'success' ? 'Connected' : 
                   apiStatus.wordpress === 'error' ? 'Error' : 'Testing...'}
                </p>
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
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">GoFiber API</p>
                <p className={`text-lg font-semibold ${
                  apiStatus.gofiber === 'success' ? 'text-green-600' : 
                  apiStatus.gofiber === 'error' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {apiStatus.gofiber === 'success' ? 'Connected' : 
                   apiStatus.gofiber === 'error' ? 'Error' : 'Testing...'}
                </p>
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
          <div className="flex space-x-4">
            <button
              onClick={setupRoutes}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Setup Initial Routes
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh Data
            </button>
            <button
              onClick={testAPIs}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
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
              onClick={() => setActiveTab('routes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'routes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Routes ({routes.length})
            </button>
            <button
              onClick={() => setActiveTab('upstreams')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upstreams'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upstreams ({upstreams.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Route
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'routes' && (
                <RouteList routes={routes} onRouteDeleted={handleRouteDeleted} />
              )}
              {activeTab === 'upstreams' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upstreams</h3>
                  {upstreams.length === 0 ? (
                    <p className="text-gray-500">No upstreams found.</p>
                  ) : (
                    <div className="space-y-4">
                      {upstreams.map((upstream) => (
                        <div key={upstream.key} className="border rounded-lg p-4">
                          <h4 className="font-medium">{upstream.key}</h4>
                          <pre className="mt-2 text-sm bg-gray-50 p-2 rounded">
                            {JSON.stringify(upstream.value, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'create' && (
                <CreateRoute onRouteCreated={handleRouteCreated} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;