/**
 * Data Source Credentials - Secure storage for data source authentication credentials
 * 
 * Provides functions to look up authentication credentials for data sources
 * based on dataSourceId. Credentials are stored server-side only.
 */

/**
 * Authentication configuration for data sources
 */
export interface DataSourceAuthConfig {
  type: 'bearer' | 'apikey' | 'basic';
  token?: string;
  headerName?: string;
  username?: string;
  password?: string;
}

/**
 * Data source credentials store
 * In production, this should be loaded from environment variables or a secure secrets manager
 */
const dataSourceCredentials: Record<string, DataSourceAuthConfig> = {
  // Example: Load from environment variables
  'states-api': {
    type: 'bearer',
    token: process.env.STATES_API_TOKEN || 'default-token',
  },
  'cities-api': {
    type: 'apikey',
    token: process.env.CITIES_API_KEY || 'default-key',
    headerName: 'X-API-Key',
  },
  // Example: Basic authentication
  'basic-auth-api': {
    type: 'basic',
    username: process.env.BASIC_AUTH_USERNAME || 'default-username',
    password: process.env.BASIC_AUTH_PASSWORD || 'default-password',
  },
  // Add more data sources as needed
};

/**
 * Get authentication credentials for a data source
 * 
 * @param dataSourceId - Unique identifier for the data source
 * @returns Authentication configuration or null if not found
 */
export async function getDataSourceCredentials(
  dataSourceId: string
): Promise<DataSourceAuthConfig | null> {
  return dataSourceCredentials[dataSourceId] || null;
}

/**
 * Set authentication credentials for a data source (for testing or configuration)
 * 
 * @param dataSourceId - Unique identifier for the data source
 * @param credentials - Authentication configuration
 */
export function setDataSourceCredentials(
  dataSourceId: string,
  credentials: DataSourceAuthConfig
): void {
  dataSourceCredentials[dataSourceId] = credentials;
}
