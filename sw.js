// Service Worker para sincronización automática en background
const CACHE_NAME = 'articles-app-v1';
const SYNC_QUEUE_NAME = 'articles-sync-queue';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker instalado');
    
    // Crear cache inicial
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Cache inicial creado');
                return cache.addAll([
                    '/',
                    '/index.html',
                    '/styles.css',
                    '/script.js'
                ]);
            })
            .catch(error => {
                console.error('❌ Error creando cache inicial:', error);
            })
    );
    
    // Forzar activación inmediata
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker activado');
    
    // Limpiar caches antiguos
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName !== CACHE_NAME)
                        .map(cacheName => {
                            console.log('🧹 Eliminando cache antiguo:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('🧹 Caches antiguos limpiados');
                // Tomar control de todos los clientes
                return self.clients.claim();
            })
            .catch(error => {
                console.error('❌ Error activando Service Worker:', error);
            })
    );
});

// Interceptación de peticiones de red - Manejo robusto de errores
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Solo interceptar peticiones del mismo origen
    if (url.origin !== self.location.origin) {
        return; // Dejar que el navegador maneje peticiones externas
    }
    
    // Estrategia cache-first para archivos estáticos
    if (request.destination === 'document' || 
        request.destination === 'style' || 
        request.destination === 'script') {
        
        event.respondWith(
            caches.open(CACHE_NAME)
                .then(cache => {
                    return cache.match(request)
                        .then(response => {
                            if (response) {
                                console.log('📦 Sirviendo desde cache:', request.url);
                                return response;
                            }
                            
                            // Si no está en cache, obtener de red
                            console.log('🌐 Obteniendo de red:', request.url);
                            return fetch(request)
                                .then(networkResponse => {
                                    // Solo cachear respuestas exitosas
                                    if (networkResponse.ok) {
                                        cache.put(request, networkResponse.clone());
                                        console.log('💾 Guardado en cache:', request.url);
                                    }
                                    return networkResponse;
                                })
                                .catch(error => {
                                    console.error('❌ Error de red para:', request.url, error);
                                    
                                    // Para peticiones de documento, intentar servir una página de error offline
                                    if (request.destination === 'document') {
                                        return new Response(`
                                            <!DOCTYPE html>
                                            <html>
                                            <head>
                                                <title>Modo Offline</title>
                                                <style>
                                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                                    .offline-icon { font-size: 48px; margin-bottom: 20px; }
                                                    h1 { color: #4a90e2; }
                                                    p { color: #666; }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="offline-icon">📱</div>
                                                <h1>Modo Offline</h1>
                                                <p>Estás sin conexión a internet. Los datos se sincronizarán automáticamente cuando vuelvas a estar conectado.</p>
                                                <button onclick="location.reload()">Reintentar</button>
                                            </body>
                                            </html>
                                        `, {
                                            status: 200,
                                            statusText: 'OK',
                                            headers: new Headers({
                                                'Content-Type': 'text/html'
                                            })
                                        });
                                    }
                                    
                                    // Para otros recursos, devolver error apropiado
                                    return new Response('Recurso no disponible offline', {
                                        status: 503,
                                        statusText: 'Service Unavailable'
                                    });
                                });
                        });
                })
                .catch(error => {
                    console.error('❌ Error en cache:', error);
                    return fetch(request); // Fallback a red
                })
        );
    }
    
    return fetch(request);
});

// Background Sync - Sincronización automática
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync triggered:', event.tag);
    
    if (event.tag === 'articles-sync') {
        event.waitUntil(
            processSyncQueue()
                .then(() => {
                    console.log('✅ Background sync completado');
                    // Notificar a todos los clientes
                    notifyClients({
                        type: 'SYNC_COMPLETED',
                        data: { message: 'Sincronización completada exitosamente' }
                    });
                })
                .catch(error => {
                    console.error('❌ Error en background sync:', error);
                    // Notificar error a clientes
                    notifyClients({
                        type: 'SYNC_ERROR',
                        data: { message: 'Error en sincronización', error: error.message }
                    });
                })
        );
    }
});

// Manejar mensajes desde la aplicación
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    console.log('📨 Mensaje recibido en SW:', type, data);
    
    switch (type) {
        case 'SYNC_NOW':
            event.waitUntil(
                processSyncQueue()
                    .then(() => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'SYNC_COMPLETED',
                                data: { message: 'Sincronización completada' }
                            });
                        }
                    })
                    .catch(error => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'SYNC_ERROR',
                                data: { message: 'Error en sincronización', error: error.message }
                            });
                        }
                    })
            );
            break;
            
        case 'GET_SYNC_STATUS':
            event.waitUntil(
                getSyncQueueStatus()
                    .then(status => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'SYNC_STATUS',
                                data: status
                            });
                        }
                    })
                    .catch(error => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'SYNC_STATUS_ERROR',
                                data: { message: 'Error obteniendo estado', error: error.message }
                            });
                        }
                    })
            );
            break;
            
        case 'CLEAR_SYNC_QUEUE':
            event.waitUntil(
                clearSyncQueue()
                    .then(() => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'QUEUE_CLEARED',
                                data: { message: 'Cola de sincronización limpiada' }
                            });
                        }
                    })
                    .catch(error => {
                        if (event.ports[0]) {
                            event.ports[0].postMessage({
                                type: 'QUEUE_CLEAR_ERROR',
                                data: { message: 'Error limpiando cola', error: error.message }
                            });
                        }
                    })
            );
            break;
    }
});

// Procesar cola de sincronización
async function processSyncQueue() {
    let db = null;
    try {
        console.log('🔄 Procesando cola de sincronización en background...');
        
        // Obtener IndexedDB del service worker
        db = await openIndexedDB();
        const operations = await getPendingOperations(db);
        
        if (operations.length === 0) {
            console.log('📋 No hay operaciones pendientes');
            return;
        }
        
        console.log(`📋 Procesando ${operations.length} operaciones...`);
        
        for (const operation of operations) {
            try {
                await executeOperation(operation);
                await markOperationCompleted(db, operation.id);
                console.log(`✅ Operación completada: ${operation.type}`);
            } catch (error) {
                console.error(`❌ Error en operación ${operation.type}:`, error);
                await markOperationFailed(db, operation.id, error);
            }
        }
        
        console.log('✅ Procesamiento de cola completado');
    } catch (error) {
        console.error('❌ Error procesando cola de sincronización:', error);
        throw error;
    } finally {
        // Cerrar conexión a IndexedDB
        if (db) {
            db.close();
            console.log('🔒 Conexión IndexedDB cerrada');
        }
    }
}

// Ejecutar operación individual
async function executeOperation(operation) {
    // Simular llamada a servidor (reemplazar con API real)
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 90% de éxito para simular comportamiento real
            if (Math.random() > 0.1) {
                resolve();
            } else {
                reject(new Error('Error simulado del servidor'));
            }
        }, 500 + Math.random() * 1000); // 500-1500ms de delay
    });
}

// Abrir IndexedDB con manejo de errores y cierre de conexiones
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ArticlesDB', 1);
        
        request.onerror = () => {
            console.error('❌ Error abriendo IndexedDB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            console.log('✅ IndexedDB abierta correctamente');
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            console.log('🔄 Actualizando IndexedDB schema...');
            const db = event.target.result;
            
            // Crear object stores si no existen
            if (!db.objectStoreNames.contains('articles')) {
                db.createObjectStore('articles', { keyPath: 'id', autoIncrement: true });
                console.log('📝 Creado object store: articles');
            }
            
            if (!db.objectStoreNames.contains('syncQueue')) {
                const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                syncStore.createIndex('status', 'status', { unique: false });
                syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('📋 Creado object store: syncQueue');
            }
        };
    });
}

// Obtener operaciones pendientes
async function getPendingOperations(db) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const index = store.index('status');
            
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Marcar operación como completada
async function markOperationCompleted(db, operationId) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            
            const request = store.get(operationId);
            request.onsuccess = () => {
                const operation = request.result;
                if (operation) {
                    operation.status = 'completed';
                    operation.completedAt = Date.now();
                    const updateRequest = store.put(operation);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(); // Operación no encontrada, considerarla completada
                }
            };
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Marcar operación como fallida
async function markOperationFailed(db, operationId, error) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            
            const request = store.get(operationId);
            request.onsuccess = () => {
                const operation = request.result;
                if (operation) {
                    operation.status = 'failed';
                    operation.error = error.message || 'Error desconocido';
                    operation.failedAt = Date.now();
                    const updateRequest = store.put(operation);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(); // Operación no encontrada
                }
            };
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Obtener estado de la cola
async function getSyncQueueStatus() {
    let db = null;
    try {
        db = await openIndexedDB();
        const operations = await getPendingOperations(db);
        const failed = await getFailedOperations(db);
        
        return {
            pending: operations.length,
            failed: failed.length,
            total: operations.length + failed.length
        };
    } catch (error) {
        console.error('❌ Error obteniendo estado de cola:', error);
        return { pending: 0, failed: 0, total: 0 };
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Obtener operaciones fallidas
async function getFailedOperations(db) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const index = store.index('status');
            
            const request = index.getAll('failed');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Limpiar cola de sincronización
async function clearSyncQueue() {
    let db = null;
    try {
        db = await openIndexedDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(['syncQueue'], 'readwrite');
                const store = transaction.objectStore('syncQueue');
                
                const request = store.clear();
                request.onsuccess = () => {
                    console.log('🧹 Cola de sincronización limpiada');
                    resolve();
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    } catch (error) {
        console.error('❌ Error limpiando cola de sincronización:', error);
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Notificar a todos los clientes
function notifyClients(message) {
    return self.clients.matchAll()
        .then(clients => {
            clients.forEach(client => {
                if (client.url && client.focus) {
                    client.focus();
                }
                client.postMessage(message);
            });
        })
        .catch(error => {
            console.error('❌ Error notificando clientes:', error);
        });
}
