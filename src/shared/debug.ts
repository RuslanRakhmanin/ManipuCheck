
export async function debugLog(source: string, message: string, data: unknown = null): Promise<void> {
  // Only send logs in development mode
  if (chrome.management && await new Promise(resolve => chrome.management.getSelf(info => resolve(info.installType === 'development')))) {
    try {
      await fetch('http://localhost:3000/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source, message, data }),
      });
    } catch (error) {
      // Fallback to console.log if the server is not running
      console.error('Debug server not responding:', error);
      console.log(`[${source.toUpperCase()}]:`, message, data || '');
    }
  } else {
    // You might want a production-safe logging mechanism here, or nothing at all
  }
}
