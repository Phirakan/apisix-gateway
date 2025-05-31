import React from 'react';
import { api } from '../service/api';

const RouteList = ({ routes, onRouteDeleted }) => {
  const handleDeleteRoute = async (routeKey) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      try {
        await api.deleteRoute(routeKey);
        onRouteDeleted();
        alert('Route deleted successfully!');
      } catch (error) {
        alert('Error deleting route: ' + error.message);
      }
    }
  };

  if (routes.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No routes</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new route.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Routes</h3>
      <div className="space-y-4">
        {routes.map((route) => (
          <div key={route.key} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {route.value.name || route.key}
                  </h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Route ID</p>
                    <p className="text-sm text-gray-900">{route.key}</p>
                  </div>
                  
                  {route.value.uri && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">URI</p>
                      <p className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">
                        {route.value.uri}
                      </p>
                    </div>
                  )}
                  
                  {route.value.uris && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">URIs</p>
                      <div className="space-y-1">
                        {route.value.uris.map((uri, index) => (
                          <p key={index} className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">
                            {uri}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {route.value.methods && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Methods</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.value.methods.map((method, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upstream Information */}
                {route.value.upstream && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Upstream</p>
                    <div className="bg-white border rounded p-3">
                      <p className="text-sm text-gray-900 mb-2">
                        <span className="font-medium">Type:</span> {route.value.upstream.type || 'roundrobin'}
                      </p>
                      {route.value.upstream.nodes && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Nodes:</p>
                          <div className="space-y-1">
                            {Object.entries(route.value.upstream.nodes).map(([node, weight]) => (
                              <div key={node} className="flex justify-between text-sm">
                                <span className="font-mono text-gray-900">{node}</span>
                                <span className="text-gray-500">Weight: {weight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Plugins */}
                {route.value.plugins && Object.keys(route.value.plugins).length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Plugins</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(route.value.plugins).map((plugin) => (
                        <span
                          key={plugin}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {plugin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created/Updated Info */}
                <div className="text-xs text-gray-500">
                  <p>Created: {new Date(route.value.create_time * 1000).toLocaleString()}</p>
                  <p>Updated: {new Date(route.value.update_time * 1000).toLocaleString()}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => handleDeleteRoute(route.key)}
                  className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  title="Delete Route"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Raw JSON (Collapsible) */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                View Raw Configuration
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-3 rounded border overflow-x-auto">
                {JSON.stringify(route.value, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteList;