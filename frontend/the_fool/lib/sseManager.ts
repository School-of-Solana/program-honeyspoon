/**
 * SSE Manager - Shared SSE connection management
 * 
 * This module manages Server-Sent Events connections and provides
 * a way for server actions to trigger balance updates.
 */

// Store for SSE controllers
const connections = new Set<ReadableStreamDefaultController>();

/**
 * Register an SSE connection
 */
export function registerSSEConnection(controller: ReadableStreamDefaultController) {
  connections.add(controller);
  console.log('[SSE Manager] Registered connection. Total:', connections.size);
}

/**
 * Unregister an SSE connection
 */
export function unregisterSSEConnection(controller: ReadableStreamDefaultController) {
  connections.delete(controller);
  console.log('[SSE Manager] Unregistered connection. Total:', connections.size);
}

/**
 * Broadcast a balance update to all connected clients
 * This triggers each connection's sendUpdate function
 */
export function broadcastBalanceUpdate() {
  console.log('[SSE Manager] 📢 Broadcasting balance update to', connections.size, 'clients');
  
  connections.forEach((controller) => {
    try {
      // Call the stored sendUpdate function to fetch fresh balances
      const sendUpdate = (controller as any).sendUpdate;
      if (sendUpdate) {
        sendUpdate();
      }
    } catch (error) {
      console.error('[SSE Manager] Failed to send update to client:', error);
    }
  });
}

/**
 * Broadcast a custom event to all connected clients
 */
export function broadcastEvent(event: any) {
  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = encoder.encode(message);

  connections.forEach((controller) => {
    try {
      controller.enqueue(encoded);
    } catch (error) {
      console.error('[SSE Manager] Failed to send event to client:', error);
    }
  });
}

/**
 * Get the number of active connections
 */
export function getConnectionCount(): number {
  return connections.size;
}
