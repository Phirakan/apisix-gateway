// frontend/src/components/RouteList.jsx (Updated)
import React from 'react';
import { api } from '../service/api';

const RouteList = ({ routes = [], onRouteDeleted = () => {}, showDeleteButton = false }) => {
  const handleDeleteRoute = async (route) => {
    const routeKey = route?.key;
    const routeValue = route?.value || {};
    const routeName = routeValue.name || `Route ${routeKey}`;
    
    if (!routeKey) {
      console.warn('Route key is required for deletion');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${routeName}"?`)) {
      try {
        if (showDeleteButton) {
          // Use dynamic route management API
          await api.deleteRoute(routeValue.id || routeKey);
          alert('✅ Route deleted successfully! Please restart APISIX container for changes to take effect.');
        } else {
          // Static mode message
          alert('Route deletion is not supported in static mode. Routes are configured in apisix.yaml file.');
        }
        
        // Call onRouteDeleted callback
        if (typeof onRouteDeleted === 'function') {
          onRouteDeleted();
        }
      } catch (error) {
        console.error('Error deleting route:', error);
        alert('❌ Error deleting route: ' + error.message);
      }
    }
  };

  const handleEditRoute = async (route) => {
    if (!showDeleteButton) {
      alert('Route editing is not supported in static mode. Please edit the apisix.yaml file directly.');
      return;
    }
    
    // This would typically open an edit modal or navigate to edit page
    console.log('Edit route:', route);
    alert('Edit functionality would be implemented here. For now, use the Route Management tab.');
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
        <p className="mt-1 text-sm text-gray-500">
          {showDeleteButton 
            ? 'Get started by creating your first route in the Route Management tab.'
            : 'Routes are configured in apisix.yaml file in static mode.'
          }
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Routes Configuration</h3>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            showDeleteButton 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {showDeleteButton ? 'Dynamic Mode' : 'Static Mode'}
          </span>
          <span className="text-sm text-gray-500">
            {routesList.length} route{routesList.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        {routesList.map((route, index) => {
          // Ensure route has proper structure
          const routeKey = route?.key || `route-${index}`;
          const routeValue = route?.value || {};
          
          return (
            <div key={routeKey} className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {routeValue.name || `Route ${routeKey}`}
                    </h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      showDeleteButton ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {showDeleteButton ? 'Dynamic' : 'Static'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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

                    <div>
                      <p className="text-sm font-medium text-gray-500">Description</p>
                      <p className="text-sm text-gray-900">
                        {routeValue.desc || routeValue.description || 'No description'}
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
                      <p className="text-sm font-medium text-gray-500">Load Balancer</p>
                      <p className="text-sm text-gray-900">{routeValue.upstream?.type || 'roundrobin'}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-500">Management</p>
                      <p className="text-sm text-gray-900">
                        {showDeleteButton ? 'API Managed' : 'File Configured'}
                      </p>
                    </div>
                  </div>

                  {/* Upstream Information */}
                  {routeValue.upstream && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Upstream Configuration</p>
                      <div className="bg-white border rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Load Balancer Type</p>
                            <p className="text-sm text-gray-900">{routeValue.upstream.type || 'roundrobin'}</p>
                          </div>
                          {routeValue.upstream.nodes && typeof routeValue.upstream.nodes === 'object' && (
                            <div>
                              <p className="text-sm font-medium text-gray-700">Backend Nodes</p>
                              <div className="space-y-1">
                                {Object.entries(routeValue.upstream.nodes).map(([node, weight], nodeIndex) => (
                                  <div key={`${routeKey}-node-${nodeIndex}`} className="flex justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                                    <span className="font-mono text-gray-900">{node}</span>
                                    <span className="text-gray-500">Weight: {weight}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {routeValue.upstream.timeout && (
                            <div className="md:col-span-2">
                              <p className="text-sm font-medium text-gray-700">Timeouts</p>
                              <div className="flex space-x-4 text-xs text-gray-600">
                                <span>Connect: {routeValue.upstream.timeout.connect}s</span>
                                <span>Send: {routeValue.upstream.timeout.send}s</span>
                                <span>Read: {routeValue.upstream.timeout.read}s</span>
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
                              <p className="text-xs font-medium text-gray-600 mb-1">{pluginName} Configuration:</p>
                              <div className="bg-gray-50 p-2 rounded text-xs">
                                {typeof config === 'object' && config !== null ? (
                                  <div className="space-y-1">
                                    {Object.entries(config).map(([key, value], entryIndex) => (
                                      <div key={`${routeKey}-entry-${entryIndex}`} className="flex justify-between">
                                        <span className="text-gray-600 font-medium">{key}:</span>
                                        <span className="text-gray-900 font-mono text-right">
                                          {Array.isArray(value) ? (
                                            <div className="space-y-1">
                                              {value.map((item, itemIndex) => (
                                                <div key={itemIndex}>{String(item)}</div>
                                              ))}
                                            </div>
                                          ) : (
                                            String(value)
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
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

                  {/* Timestamps */}
                  {(routeValue.create_time || routeValue.update_time) && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Timestamps</p>
                      <div className="bg-white border rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                          {routeValue.create_time && (
                            <div>
                              <span className="font-medium">Created: </span>
                              {new Date(routeValue.create_time * 1000).toLocaleString()}
                            </div>
                          )}
                          {routeValue.update_time && (
                            <div>
                              <span className="font-medium">Updated: </span>
                              {new Date(routeValue.update_time * 1000).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configuration Source Info */}
                  <div className={`text-xs p-3 rounded ${
                    showDeleteButton 
                      ? 'bg-orange-50 text-orange-800 border border-orange-200' 
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p><strong>Source:</strong> {showDeleteButton ? 'Dynamic API Management' : 'Static configuration (apisix.yaml)'}</p>
                        <p><strong>Management:</strong> {showDeleteButton ? 'Via Dashboard/API' : 'File-based configuration'}</p>
                        {showDeleteButton && (
                          <p><strong>Note:</strong> Changes require APISIX container restart</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4 flex-shrink-0">
                  <div className="flex flex-col space-y-2">
                    {showDeleteButton ? (
                      <>
                        <button
                          onClick={() => handleEditRoute(route)}
                          className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          title="Edit Route"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route)}
                          className="inline-flex items-center p-2 border border-red-300 rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          title="Delete Route"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleDeleteRoute(route)}
                        disabled
                        className="inline-flex items-center p-2 border border-gray-200 rounded-md shadow-sm text-gray-400 bg-gray-100 cursor-not-allowed"
                        title="Route management not available in static mode"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Raw Configuration (Collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center focus:outline-none">
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
                  💡 <strong>Tip:</strong> {showDeleteButton 
                    ? 'Use the Route Management tab to modify this route via the dashboard'
                    : 'To modify this route, edit the apisix.yaml file and restart APISIX container'
                  }
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {/* Mode Information */}
      <div className={`mt-6 border rounded-lg p-4 ${
        showDeleteButton 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className={`h-5 w-5 ${
              showDeleteButton ? 'text-green-400' : 'text-yellow-400'
            }`} viewBox="0 0 20 20" fill="currentColor">
              {showDeleteButton ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              )}
            </svg>
          </div>
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${
              showDeleteButton ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {showDeleteButton ? 'Dynamic Route Management' : 'Static Mode Information'}
            </h3>
            <div className={`mt-2 text-sm ${
              showDeleteButton ? 'text-green-700' : 'text-yellow-700'
            }`}>
              <ul className="list-disc pl-5 space-y-1">
                {showDeleteButton ? (
                  <>
                    <li>Routes can be dynamically created, edited, and deleted via the dashboard</li>
                    <li>Changes are written to <code className="bg-green-100 px-1 rounded">apisix/apisix.yaml</code> configuration file</li>
                    <li>APISIX container restart required for changes to take effect</li>
                    <li>Use the "Route Management" tab for creating and editing routes</li>
                    <li>All changes are automatically backed up before modification</li>
                  </>
                ) : (
                  <>
                    <li>Routes are statically configured in <code className="bg-yellow-100 px-1 rounded">apisix/apisix.yaml</code></li>
                    <li>Changes require editing the YAML file and restarting APISIX container</li>
                    <li>No Admin API operations available for route management</li>
                    <li>Perfect for production environments requiring stable configurations</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteList;