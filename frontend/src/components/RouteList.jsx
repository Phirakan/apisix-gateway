import React from 'react';

const RouteList = ({ routes = [], onRouteDeleted = () => {}, showDeleteButton = false }) => {
  const handleDeleteRoute = async (routeKey) => {
    if (!routeKey) {
      console.warn('Route key is required for deletion');
      return;
    }

    if (window.confirm('Are you sure you want to delete this route?')) {
      try {
        // Note: This won't work in standalone mode
        alert('Route deletion is not supported in standalone mode. Routes are configured in apisix.yaml file.');
        
        // Call onRouteDeleted callback if provided
        if (typeof onRouteDeleted === 'function') {
          onRouteDeleted();
        }
      } catch (error) {
        console.error('Error in handleDeleteRoute:', error);
        alert('Error: ' + error.message);
      }
    }
  };

  // Ensure routes is an array
  const routesList = Array.isArray(routes) ? routes : [];

  if (routesList.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No routes configured</h3>
        <p className="mt-1 text-sm text-gray-500">Routes are configured in apisix.yaml file in standalone mode.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Routes Configuration</h3>
      <div className="space-y-4">
        {routesList.map((route, index) => {
          // Ensure route has proper structure
          const routeKey = route?.key || `route-${index}`;
          const routeValue = route?.value || {};
          
          return (
            <div key={routeKey} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
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
                      Static
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Route ID</p>
                      <p className="text-sm text-gray-900">{routeValue.id || routeKey}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">URI Pattern</p>
                      <p className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">
                        {routeValue.uri || 'N/A'}
                      </p>
                    </div>
                    
                    {routeValue.methods && Array.isArray(routeValue.methods) && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">HTTP Methods</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {routeValue.methods.map((method, methodIndex) => (
                            <span
                              key={`${routeKey}-method-${methodIndex}`}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-500">Configuration</p>
                      <p className="text-sm text-gray-900">Standalone Mode</p>
                    </div>
                  </div>

                  {/* Upstream Information */}
                  {routeValue.upstream && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Upstream Configuration</p>
                      <div className="bg-white border rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Load Balancer</p>
                            <p className="text-sm text-gray-900">{routeValue.upstream.type || 'roundrobin'}</p>
                          </div>
                          {routeValue.upstream.nodes && typeof routeValue.upstream.nodes === 'object' && (
                            <div>
                              <p className="text-sm font-medium text-gray-700">Backend Nodes</p>
                              <div className="space-y-1">
                                {Object.entries(routeValue.upstream.nodes).map(([node, weight], nodeIndex) => (
                                  <div key={`${routeKey}-node-${nodeIndex}`} className="flex justify-between text-sm">
                                    <span className="font-mono text-gray-900">{node}</span>
                                    <span className="text-gray-500">Weight: {weight}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plugins */}
                  {routeValue.plugins && typeof routeValue.plugins === 'object' && Object.keys(routeValue.plugins).length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Enabled Plugins</p>
                      <div className="bg-white border rounded p-3">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Object.keys(routeValue.plugins).map((plugin, pluginIndex) => (
                            <span
                              key={`${routeKey}-plugin-${pluginIndex}`}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {plugin}
                            </span>
                          ))}
                        </div>
                        
                        {/* Plugin Details */}
                        <div className="space-y-2">
                          {Object.entries(routeValue.plugins).map(([pluginName, config], configIndex) => (
                            <div key={`${routeKey}-config-${configIndex}`} className="border-t pt-2 first:border-t-0 first:pt-0">
                              <p className="text-xs font-medium text-gray-600 mb-1">{pluginName}:</p>
                              <div className="bg-gray-50 p-2 rounded text-xs">
                                {typeof config === 'object' && config !== null ? (
                                  <ul className="space-y-1">
                                    {Object.entries(config).map(([key, value], entryIndex) => (
                                      <li key={`${routeKey}-entry-${entryIndex}`} className="flex justify-between">
                                        <span className="text-gray-600">{key}:</span>
                                        <span className="text-gray-900 font-mono">
                                          {Array.isArray(value) ? value.join(', ') : String(value)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-gray-900">{String(config)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configuration Info */}
                  <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p><strong>Source:</strong> Static configuration (apisix.yaml)</p>
                    </div>
                    <p className="mt-1"><strong>Mode:</strong> Standalone - No Admin API</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4 flex-shrink-0">
                  {showDeleteButton && (
                    <button
                      onClick={() => handleDeleteRoute(routeKey)}
                      disabled
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-gray-400 bg-gray-100 cursor-not-allowed"
                      title="Route management not available in standalone mode"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Raw Configuration (Collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  View Raw Configuration
                </summary>
                <div className="mt-3 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(routeValue, null, 2)}
                  </pre>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  💡 <strong>Tip:</strong> To modify this route, edit the apisix.yaml file and restart APISIX container
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {/* Standalone Mode Info */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Standalone Mode Information
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Routes are statically configured in <code className="bg-yellow-100 px-1 rounded">apisix/apisix.yaml</code></li>
                <li>Changes require editing the YAML file and restarting APISIX container</li>
                <li>No Admin API operations available for route management</li>
                <li>Perfect for development, testing, and demonstration purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteList;