// Módulo de formulario de artículos
//Gael Jovani Lopez Garcia 11916199
const ArticleForm = (() => {
    // Variables privadas
    let form, submitBtn, successMessage, formSection, newArticleBtn;
    let titleInput, summaryInput, authorInput, emailInput, keywordsInput, categorySelect;
    let titleError, summaryError, authorError, emailError, charCount;
    let searchInput, categoryFilter, articlesTable, articlesCount;
    let articles = [];
    let filteredArticles = [];
    let currentEditingId = null;
    let formData = {};
    
    // Variables para revisores
    let reviewers = [];
    let filteredReviewers = [];
    let currentEditingReviewerId = null;
    let reviewerFormData = {};
    
    // Variables para tabs y formularios de revisores
    let reviewerForm, submitReviewerBtn, reviewerSuccessMessage, newReviewerBtn;
    let reviewerNameInput, reviewerEmailInput, reviewerExpertiseSelect;
    let reviewerNameError, reviewerEmailError, reviewerExpertiseError;
    let reviewerSearchInput, expertiseFilter, reviewersTable, reviewersCount;
    
    // Datos del formulario de revisores
    reviewerFormData = {
        name: '',
        email: '',
        expertise: ''
    };

    // IndexedDB Storage Layer
    class ArticleStorage {
        constructor() {
            this.dbName = 'ArticlesDB';
            this.dbVersion = 3; // Incrementar versión para evitar conflictos
            this.db = null;
        }

        async initDB() {
            if (this.db) {
                return this.db;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = () => {
                    console.error('Error opening IndexedDB:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('✅ IndexedDB abierta correctamente con versión', this.dbVersion);
                    
                    // Verificar que todos los object stores necesarios existan
                    const requiredStores = ['articles', 'syncQueue', 'reviewers'];
                    const missingStores = requiredStores.filter(store => !this.db.objectStoreNames.contains(store));
                    
                    if (missingStores.length > 0) {
                        console.warn('⚠️ Object stores faltantes:', missingStores);
                        console.log('🔄 Cerrando conexión para reinicializar con versión nueva...');
                        this.db.close();
                        this.db = null;
                        
                        // Incrementar versión para forzar recreación
                        this.dbVersion++;
                        this.initDB().then(resolve).catch(reject);
                        return;
                    }
                    
                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('🔄 Actualizando IndexedDB schema a versión', event.newVersion);
                    const db = event.target.result;
                    
                    // Crear object store para artículos
                    if (!db.objectStoreNames.contains('articles')) {
                        const articleStore = db.createObjectStore('articles', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        
                        // Crear índices para búsquedas
                        articleStore.createIndex('title', 'title', { unique: false });
                        articleStore.createIndex('author', 'author', { unique: false });
                        articleStore.createIndex('category', 'category', { unique: false });
                        articleStore.createIndex('date', 'date', { unique: false });
                        articleStore.createIndex('keywords', 'keywords', { unique: false });
                    }
                    
                    // Crear object store para sync queue
                    if (!db.objectStoreNames.contains('syncQueue')) {
                        const syncStore = db.createObjectStore('syncQueue', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        
                        syncStore.createIndex('status', 'status', { unique: false });
                        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                    
                    // Crear object store para revisores
                    if (!db.objectStoreNames.contains('reviewers')) {
                        const reviewerStore = db.createObjectStore('reviewers', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        
                        reviewerStore.createIndex('name', 'name', { unique: false });
                        reviewerStore.createIndex('email', 'email', { unique: true });
                        reviewerStore.createIndex('expertise', 'expertise', { unique: false });
                    }
                };
            });
        }

        async save(article) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.add(article);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error saving article:', error);
                throw error;
            }
        }

        async getAll() {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readonly');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error getting articles:', error);
                return []; // Retornar array vacío en caso de error
            }
        }

        async update(id, changes) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.get(id);
                    request.onsuccess = () => {
                        const article = request.result;
                        if (article) {
                            Object.assign(article, changes);
                            const updateRequest = store.put(article);
                            updateRequest.onsuccess = () => resolve(updateRequest.result);
                            updateRequest.onerror = () => reject(updateRequest.error);
                        } else {
                            reject(new Error('Article not found'));
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error updating article:', error);
                throw error;
            }
        }

        async delete(id) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.delete(id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error deleting article:', error);
                throw error;
            }
        }

        async search(query) {
            try {
                await this.initDB();
                const allArticles = await this.getAll();
                
                if (!query) return allArticles;
                
                const searchTerm = query.toLowerCase();
                return allArticles.filter(article => 
                    article.title.toLowerCase().includes(searchTerm) ||
                    article.author.toLowerCase().includes(searchTerm) ||
                    (article.keywords && article.keywords.toLowerCase().includes(searchTerm))
                );
            } catch (error) {
                console.error('Error searching articles:', error);
                return [];
            }
        }

        async filterByCategory(category) {
            try {
                const allArticles = await this.getAll();
                if (!category) return allArticles;
                return allArticles.filter(article => article.category === category);
            } catch (error) {
                console.error('Error filtering articles:', error);
                return [];
            }
        }

        // Métodos para revisores
        async saveReviewer(reviewer) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    // Verificar si el object store existe antes de crear la transacción
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        console.error('❌ Object store "reviewers" no encontrado');
                        reject(new Error('Object store "reviewers" no encontrado. La base de datos necesita ser reinicializada.'));
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readwrite');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.add(reviewer);
                    request.onsuccess = () => {
                        console.log('✅ Revisor guardado exitosamente');
                        resolve(request.result);
                    };
                    request.onerror = () => {
                        console.error('❌ Error guardando revisor:', request.error);
                        reject(request.error);
                    };
                });
            } catch (error) {
                console.error('Error saving reviewer:', error);
                throw error;
            }
        }

        async getAllReviewers() {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    // Verificar si el object store existe
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        console.warn('⚠️ Object store "reviewers" no encontrado, retornando array vacío');
                        resolve([]);
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readonly');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.getAll();
                    request.onsuccess = () => {
                        console.log(`✅ Se cargaron ${request.result.length} revisores`);
                        resolve(request.result);
                    };
                    request.onerror = () => {
                        console.error('❌ Error obteniendo revisores:', request.error);
                        reject(request.error);
                    };
                });
            } catch (error) {
                console.error('Error getting reviewers:', error);
                return []; // Retornar array vacío en caso de error
            }
        }

        async updateReviewer(id, changes) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    // Verificar si el object store existe
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        reject(new Error('Object store "reviewers" no encontrado'));
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readwrite');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.get(id);
                    request.onsuccess = () => {
                        const reviewer = request.result;
                        if (reviewer) {
                            Object.assign(reviewer, changes);
                            const updateRequest = store.put(reviewer);
                            updateRequest.onsuccess = () => {
                                console.log('✅ Revisor actualizado exitosamente');
                                resolve(updateRequest.result);
                            };
                            updateRequest.onerror = () => reject(updateRequest.error);
                        } else {
                            reject(new Error('Revisor no encontrado'));
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error updating reviewer:', error);
                throw error;
            }
        }

        async deleteReviewer(id) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    // Verificar si el object store existe
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        reject(new Error('Object store "reviewers" no encontrado'));
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readwrite');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.delete(id);
                    request.onsuccess = () => {
                        console.log('✅ Revisor eliminado exitosamente');
                        resolve(request.result);
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error deleting reviewer:', error);
                throw error;
            }
        }

        async searchReviewers(query) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['reviewers'], 'readonly');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const allReviewers = request.result || [];
                        const filtered = allReviewers.filter(reviewer => 
                            reviewer.name.toLowerCase().includes(query.toLowerCase()) ||
                            reviewer.email.toLowerCase().includes(query.toLowerCase()) ||
                            reviewer.expertise.toLowerCase().includes(query.toLowerCase())
                        );
                        resolve(filtered);
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error searching reviewers:', error);
                return [];
            }
        }

        async filterReviewersByExpertise(expertise) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['reviewers'], 'readonly');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const allReviewers = request.result || [];
                        const filtered = expertise ? 
                            allReviewers.filter(reviewer => reviewer.expertise === expertise) : 
                            allReviewers;
                        resolve(filtered);
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error filtering reviewers by expertise:', error);
                return [];
            }
    }
    }

    // Instancia del storage
    const storage = new ArticleStorage();

    // Network Monitor para detección de conexión
    class NetworkMonitor {
        constructor() {
            this.isOnline = navigator.onLine;
            this.callbacks = { 
                online: [], 
                offline: [] 
            };
            
            // Configurar event listeners nativos
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
            
            console.log('Network Monitor inicializado. Estado actual:', this.isOnline ? '🟢 Online' : '🔴 Offline');
        }
        
        handleOnline() {
            this.isOnline = true;
            console.log('🟢 Conexión restaurada');
            
            // Ejecutar callbacks de online
            this.callbacks.online.forEach(callback => callback());
            
            // Actualizar UI
            this.updateStatus('online');
        }
        
        handleOffline() {
            this.isOnline = false;
            console.log('🔴 Conexión perdida');
            
            // Ejecutar callbacks de offline
            this.callbacks.offline.forEach(callback => callback());
            
            // Actualizar UI
            this.updateStatus('offline');
        }
        
        updateStatus(status) {
            const statusElement = document.getElementById('connectionStatus');
            if (!statusElement) return;
            
            switch(status) {
                case 'online':
                    statusElement.textContent = '🟢 Conectado';
                    statusElement.className = 'connection-status status-online';
                    break;
                case 'offline':
                    statusElement.textContent = '🔴 Sin Conexión';
                    statusElement.className = 'connection-status status-offline';
                    break;
                case 'syncing':
                    statusElement.textContent = '🔄 Sincronizando...';
                    statusElement.className = 'connection-status status-syncing';
                    break;
            }
        }
        
        onOnline(callback) {
            this.callbacks.online.push(callback);
        }
        
        onOffline(callback) {
            this.callbacks.offline.push(callback);
        }
    }

    // Instancia del Network Monitor
    const networkMonitor = new NetworkMonitor();

    // Sync Queue para operaciones pendientes
    class SyncQueue {
        constructor() {
            this.queue = [];
            this.isProcessing = false;
            this.maxRetries = 3;
            this.retryDelay = 1000; // 1 segundo base
        }

        async enqueue(operation) {
            const syncOperation = {
                id: Date.now().toString() + Math.random(),
                type: operation.type, // 'CREATE', 'UPDATE', 'DELETE'
                data: operation.data,
                timestamp: Date.now(),
                retries: 0,
                status: 'pending'
            };

            this.queue.push(syncOperation);
            await this.saveQueue();
            console.log('📝 Operación encolada:', syncOperation);
        }

        async saveQueue() {
            try {
                // Usar el mismo storage para consistencia
                const db = await storage.initDB();
                
                // Verificar si el object store existe antes de usarlo
                if (!db.objectStoreNames.contains('syncQueue')) {
                    console.log('📋 Creando syncQueue object store...');
                    return; // No guardar si no existe el store
                }
                
                const tx = db.transaction(['syncQueue'], 'readwrite');
                const store = tx.objectStore('syncQueue');
                
                // Limpiar queue anterior y guardar nueva
                await store.clear();
                for (const operation of this.queue) {
                    await store.add(operation);
                }
            } catch (error) {
                console.error('Error guardando sync queue:', error);
            }
        }

        async loadQueue() {
            try {
                // Usar el mismo storage para consistencia
                const db = await storage.initDB();
                
                // Verificar si el object store existe
                if (!db.objectStoreNames.contains('syncQueue')) {
                    console.log('📋 syncQueue no existe, inicializando vacía...');
                    this.queue = [];
                    return;
                }
                
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(['syncQueue'], 'readonly');
                    const store = tx.objectStore('syncQueue');
                    
                    const request = store.getAll();
                    request.onsuccess = () => {
                        this.queue = request.result || [];
                        console.log(`📋 Sync queue cargada: ${this.queue.length} operaciones`);
                        resolve(this.queue);
                    };
                    request.onerror = () => {
                        console.error('Error cargando sync queue:', request.error);
                        this.queue = [];
                        resolve(this.queue);
                    };
                });
            } catch (error) {
                console.error('Error cargando sync queue:', error);
                this.queue = [];
            }
        }

        async processQueue() {
            if (this.isProcessing || this.queue.length === 0) {
                return;
            }

            this.isProcessing = true;
            console.log('🔄 Procesando sync queue...');

            for (const operation of this.queue) {
                if (operation.status === 'completed') continue;

                try {
                    await this.executeOperation(operation);
                    operation.status = 'completed';
                    operation.completedAt = Date.now();
                    console.log('✅ Operación completada:', operation.type, operation.data.id);
                } catch (error) {
                    await this.handleOperationError(operation, error);
                }
            }

            // Limpiar operaciones completadas
            this.queue = this.queue.filter(op => op.status !== 'completed');
            await this.saveQueue();
            this.isProcessing = false;

            console.log('🏁 Sync queue procesada. Operaciones pendientes:', this.queue.length);
        }

        async executeOperation(operation) {
            switch (operation.type) {
                case 'CREATE':
                    await this.simulateServerCreate(operation.data);
                    break;
                case 'UPDATE':
                    await this.simulateServerUpdate(operation.data.id, operation.data);
                    break;
                case 'DELETE':
                    await this.simulateServerDelete(operation.data.id);
                    break;
                default:
                    throw new Error(`Operación desconocida: ${operation.type}`);
            }
        }

        async simulateServerCreate(article) {
            // Simular llamada a servidor
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Simular 90% de éxito
                    if (Math.random() > 0.1) {
                        // Actualizar artículo como sincronizado
                        article.syncStatus = 'synced';
                        storage.update(article.id, article);
                        resolve();
                    } else {
                        reject(new Error('Error simulado del servidor'));
                    }
                }, 500);
            });
        }

        async simulateServerUpdate(id, changes) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.1) {
                        const article = articles.find(a => a.id === id);
                        if (article) {
                            Object.assign(article, changes);
                            article.syncStatus = 'synced';
                            storage.update(id, article);
                        }
                        resolve();
                    } else {
                        reject(new Error('Error simulado del servidor'));
                    }
                }, 500);
            });
        }

        async simulateServerDelete(id) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.1) {
                        // Eliminar permanentemente
                        storage.delete(id);
                        resolve();
                    } else {
                        reject(new Error('Error simulado del servidor'));
                    }
                }, 500);
            });
        }

        async handleOperationError(operation, error) {
            operation.retries++;
            console.error(`❌ Error en operación ${operation.type} (intento ${operation.retries}):`, error);

            if (operation.retries >= this.maxRetries) {
                operation.status = 'failed';
                operation.error = error.message;
                console.error('💀 Operación fallida después de máximos reintentos:', operation);
            } else {
                // Exponential backoff
                const delay = this.retryDelay * Math.pow(2, operation.retries - 1);
                console.log(`⏳ Reintentando operación ${operation.type} en ${delay}ms...`);
                
                setTimeout(() => {
                    // La operación se reintentará en el próximo ciclo
                }, delay);
            }
        }

        getPendingCount() {
            return this.queue.filter(op => op.status === 'pending').length;
        }

        getFailedCount() {
            return this.queue.filter(op => op.status === 'failed').length;
        }
    }

    // Instancia del Sync Queue
    const syncQueue = new SyncQueue();

    // Inicializar elementos del DOM
    const initializeElements = () => {
        form = document.getElementById('articleForm');
        submitBtn = document.getElementById('submitBtn');
        successMessage = document.getElementById('successMessage');
        formSection = document.querySelector('.form-section');
        newArticleBtn = document.getElementById('newArticleBtn');
        
        titleInput = document.getElementById('title');
        summaryInput = document.getElementById('summary');
        authorInput = document.getElementById('author');
        emailInput = document.getElementById('email');
        keywordsInput = document.getElementById('keywords');
        categorySelect = document.getElementById('category');
        
        titleError = document.getElementById('titleError');
        summaryError = document.getElementById('summaryError');
        authorError = document.getElementById('authorError');
        emailError = document.getElementById('emailError');
        charCount = document.getElementById('charCount');
        
        // Elementos de la tabla de artículos
        searchInput = document.getElementById('searchInput');
        categoryFilter = document.getElementById('categoryFilter');
        articlesTable = document.getElementById('articlesTable');
        articlesCount = document.getElementById('articlesCount');
    };

    // Configurar event listeners
    const initializeEventListeners = () => {
        // Validación en tiempo real
        titleInput.addEventListener('input', validateTitle);
        summaryInput.addEventListener('input', validateSummary);
        authorInput.addEventListener('input', validateAuthor);
        emailInput.addEventListener('input', validateEmail);
        
        // Contador de caracteres
        summaryInput.addEventListener('input', updateCharCount);
        
        // Envío del formulario
        form.addEventListener('submit', handleSubmit);
        
        // Reset del formulario
        form.addEventListener('reset', handleReset);
        
        // Botón para nuevo artículo
        newArticleBtn.addEventListener('click', resetForm);
        
        // Event listeners para actualización en tiempo real del botón
        titleInput.addEventListener('input', updateSubmitButton);
        summaryInput.addEventListener('input', updateSubmitButton);
        authorInput.addEventListener('input', updateSubmitButton);
        emailInput.addEventListener('input', updateSubmitButton);
        
        // Event listeners para búsqueda y filtro
        searchInput.addEventListener('input', filterArticles);
        categoryFilter.addEventListener('change', filterArticles);
        
        // Prevenir envío con Enter en campos específicos
        titleInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                summaryInput.focus();
            }
        });
        
        authorInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                emailInput.focus();
            }
        });
        
        emailInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                keywordsInput.focus();
            }
        });
        
        keywordsInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                categorySelect.focus();
            }
        });
    };

    // Validación del título
    const validateTitle = () => {
    const value = titleInput.value.trim();
    formData.title = value;
    
    if (value.length === 0) {
        showError(titleInput, titleError);
        return false;
    } else if (value.length < 5) {
        titleError.textContent = 'El título debe tener al menos 5 caracteres';
        showError(titleInput, titleError);
        return false;
    } else {
        hideError(titleInput, titleError);
        return true;
    }
}

    // Validación del resumen
    const validateSummary = () => {
    const value = summaryInput.value.trim();
    formData.summary = value;
    
    if (value.length === 0) {
        showError(summaryInput, summaryError);
        updateCharCount();
        return false;
    } else if (value.length < 50) {
        showError(summaryInput, summaryError);
        updateCharCount();
        return false;
    } else {
        hideError(summaryInput, summaryError);
        updateCharCount();
        return true;
    }
}

    // Validación del autor
    const validateAuthor = () => {
    const value = authorInput.value.trim();
    formData.author = value;
    
    if (value.length === 0) {
        showError(authorInput, authorError);
        return false;
    } else if (value.length < 3) {
        authorError.textContent = 'El nombre del autor debe tener al menos 3 caracteres';
        showError(authorInput, authorError);
        return false;
    } else {
        hideError(authorInput, authorError);
        return true;
    }
}

    // Validación del email
    const validateEmail = () => {
    const value = emailInput.value.trim();
    formData.email = value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (value.length === 0) {
        showError(emailInput, emailError);
        return false;
    } else if (!emailRegex.test(value)) {
        showError(emailInput, emailError);
        return false;
    } else {
        hideError(emailInput, emailError);
        return true;
    }
}

    // Actualizar contador de caracteres
    const updateCharCount = () => {
    const count = summaryInput.value.length;
    charCount.textContent = count;
    
    if (count >= 50) {
        charCount.parentElement.classList.add('valid');
        charCount.parentElement.classList.remove('invalid');
    } else {
        charCount.parentElement.classList.add('invalid');
        charCount.parentElement.classList.remove('valid');
    }
}

    // Mostrar error
    const showError = (input, errorElement) => {
    input.classList.add('error');
    input.classList.remove('valid');
    errorElement.classList.add('show');
}

    // Ocultar error
    const hideError = (input, errorElement) => {
    input.classList.remove('error');
    input.classList.add('valid');
    errorElement.classList.remove('show');
}

    // Actualizar estado del botón de envío
    const updateSubmitButton = () => {
    const isValid = validateTitle() && 
                   validateSummary() && 
                   validateAuthor() && 
                   validateEmail();
    
    submitBtn.disabled = !isValid;
}

    // Manejar envío del formulario
    const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validar todos los campos antes de enviar
    const isTitleValid = validateTitle();
    const isSummaryValid = validateSummary();
    const isAuthorValid = validateAuthor();
    const isEmailValid = validateEmail();
    
    if (!isTitleValid || !isSummaryValid || !isAuthorValid || !isEmailValid) {
        updateSubmitButton();
        return;
    }
    
    // Actualizar datos adicionales
    formData.keywords = keywordsInput.value.trim();
    formData.category = categorySelect.value;
    
    // Mostrar estado de carga
    showLoadingState();
    
    try {
        // Simular envío al servidor
        const result = await submitArticle(formData);
        
        // Mostrar mensaje de éxito con el mensaje específico
        showSuccessMessage(result.message);
        
        // Limpiar formulario
        clearForm();
        
    } catch (error) {
        console.error('Error al enviar el artículo:', error);
        showErrorMessage('Ocurrió un error al registrar el artículo. Por favor, inténtelo nuevamente.');
    } finally {
        hideLoadingState();
    }
}

    // Simular envío del artículo
    const submitArticle = (data) => {
        return new Promise(async (resolve, reject) => {
            // Crear nuevo artículo con ID y timestamp
            const newArticle = {
                id: currentEditingId || Date.now().toString(),
                ...data,
                date: new Date().toLocaleDateString('es-ES'),
                timestamp: new Date().toISOString(),
                syncStatus: networkMonitor.isOnline ? 'synced' : 'pending'
            };
            
            if (currentEditingId) {
                // Actualizar artículo existente
                if (networkMonitor.isOnline) {
                    await storage.update(currentEditingId, newArticle);
                    const index = articles.findIndex(a => a.id === currentEditingId);
                    if (index !== -1) {
                        articles[index] = newArticle;
                    }
                    currentEditingId = null;
                } else {
                    // Encolar actualización para sincronización
                    await syncQueue.enqueue({ type: 'UPDATE', data: newArticle });
                    await storage.update(currentEditingId, newArticle);
                    const index = articles.findIndex(a => a.id === currentEditingId);
                    if (index !== -1) {
                        articles[index] = newArticle;
                    }
                    currentEditingId = null;
                }
            } else {
                // Crear nuevo artículo
                if (networkMonitor.isOnline) {
                    // Guardar directamente si hay conexión
                    await storage.save(newArticle);
                    articles.unshift(newArticle);
                } else {
                    // Guardar localmente y encolar para sincronización
                    await storage.save(newArticle);
                    await syncQueue.enqueue({ type: 'CREATE', data: newArticle });
                    articles.unshift(newArticle);
                }
            }
            
            console.log('Artículo guardado:', newArticle);
            filterArticles();
            
            const message = networkMonitor.isOnline 
                ? 'Artículo registrado exitosamente' 
                : 'Artículo guardado localmente. Se sincronizará cuando haya conexión.';
            
            resolve({ success: true, message });
        });
    };

    // Cargar artículos desde IndexedDB (solo una vez al inicio)
    const loadArticlesFromStorage = async () => {
        try {
            console.log('Cargando artículos desde IndexedDB...');
            
            // Asegurar que la base de datos esté inicializada
            await storage.initDB();
            
            // Esperar un poco más para asegurar que IndexedDB esté lista
            await new Promise(resolve => setTimeout(resolve, 300));
            
            articles = await storage.getAll();
            console.log(`Se cargaron ${articles.length} artículos desde IndexedDB`);
            console.log('Artículos cargados:', articles);
            
            // Forzar múltiples actualizaciones para asegurar visibilidad
            setTimeout(() => {
                console.log('🔄 Primera actualización de UI...');
                filterArticles();
            }, 100);
            
            setTimeout(() => {
                console.log('🔄 Segunda actualización de UI...');
                filterArticles();
                
                // Forzar actualización del contador
                const articlesCount = document.getElementById('articlesCount');
                if (articlesCount) {
                    articlesCount.textContent = articles.length;
                    console.log(`📊 Contador actualizado: ${articles.length} artículos`);
                }
            }, 300);
            
            setTimeout(() => {
                console.log('🔄 Tercera actualización de UI (final)...');
                filterArticles();
            }, 600);
            
        } catch (error) {
            console.error('Error al cargar artículos:', error);
            articles = [];
            filterArticles();
        }
    };

    // Mostrar estado de carga
    const showLoadingState = () => {
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';
}

    // Ocultar estado de carga
    const hideLoadingState = () => {
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loading').style.display = 'none';
    updateSubmitButton();
}

    // Mostrar mensaje de éxito
    const showSuccessMessage = (customMessage = null) => {
        formSection.style.display = 'none';
        successMessage.style.display = 'block';
        
        // Si hay un mensaje personalizado, actualizarlo
        if (customMessage) {
            const messageElement = successMessage.querySelector('p');
            if (messageElement) {
                messageElement.textContent = customMessage;
            }
        }
    }

    // Mostrar mensaje de error
    const showErrorMessage = (message) => {
    // Crear elemento de error si no existe
    let errorDiv = document.querySelector('.error-alert');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-alert';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h4>Error</h4>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">Cerrar</button>
            </div>
        `;
        formSection.insertBefore(errorDiv, form);
        
        // Añadir estilos para la alerta de error
        const style = document.createElement('style');
        style.textContent = `
            .error-alert {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                animation: slideIn 0.3s ease;
            }
            .error-content h4 {
                color: #721c24;
                margin-bottom: 10px;
            }
            .error-content p {
                color: #721c24;
                margin-bottom: 15px;
            }
        `;
        document.head.appendChild(style);
    }
}

    // Limpiar formulario
    const clearForm = () => {
        // Resetear formulario usando el método nativo
        form.reset();
        
        // Forzar limpieza de valores residuales
        titleInput.value = '';
        summaryInput.value = '';
        authorInput.value = '';
        emailInput.value = '';
        keywordsInput.value = '';
        categorySelect.value = '';
        
        // Resetear estado de validación
        document.querySelectorAll('.form-control').forEach(input => {
            input.classList.remove('error', 'valid');
        });
        
        document.querySelectorAll('.error-message').forEach(error => {
            error.classList.remove('show');
        });
        
        // Resetear contador de caracteres
        charCount.textContent = '0';
        charCount.parentElement.classList.remove('valid', 'invalid');
        
        // Resetear datos del formulario
        formData = {
            title: '',
            summary: '',
            author: '',
            email: '',
            keywords: '',
            category: ''
        };
        
        // Resetear estado de edición
        currentEditingId = null;
        submitBtn.querySelector('.btn-text').textContent = 'Registrar Artículo';
        
        // Forzar actualización del botón
        updateSubmitButton();
        
        console.log('Formulario limpiado completamente');
    };

    // Manejar reset del formulario
    const handleReset = (event) => {
    event.preventDefault();
    clearForm();
}

    // Función para registrar nuevo artículo (desde el mensaje de éxito)
    const resetForm = () => {
        successMessage.style.display = 'none';
        formSection.style.display = 'block';
        clearForm();
        
        // Restaurar mensaje original del success message
        const messageElement = successMessage.querySelector('p');
        if (messageElement) {
            messageElement.textContent = 'Su artículo ha sido registrado y está listo para el proceso de revisión por pares.';
        }
        
        // Forzar recarga de artículos para asegurar que se muestren
        loadArticlesFromStorage();
        
        // Hacer scroll al inicio del formulario
        formSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Funciones para manejo de artículos
    const filterArticles = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const categoryValue = categoryFilter.value;
        
        // Filtrar el array en memoria (mucho más eficiente)
        filteredArticles = articles.filter(article => {
            const matchesSearch = !searchTerm || 
                article.title.toLowerCase().includes(searchTerm) ||
                article.author.toLowerCase().includes(searchTerm) ||
                (article.keywords && article.keywords.toLowerCase().includes(searchTerm));
            
            const matchesCategory = !categoryValue || article.category === categoryValue;
            
            return matchesSearch && matchesCategory;
        });
        
        renderArticles();
    };

    // Funciones para gestión de revisores
    const initializeReviewerElements = () => {
        reviewerForm = document.getElementById('reviewerForm');
        submitReviewerBtn = document.getElementById('submitReviewerBtn');
        reviewerSuccessMessage = document.getElementById('reviewerSuccessMessage');
        newReviewerBtn = document.getElementById('newReviewerBtn');
        
        reviewerNameInput = document.getElementById('reviewerName');
        reviewerEmailInput = document.getElementById('reviewerEmail');
        reviewerExpertiseSelect = document.getElementById('reviewerExpertise');
        
        reviewerNameError = document.getElementById('reviewerNameError');
        reviewerEmailError = document.getElementById('reviewerEmailError');
        reviewerExpertiseError = document.getElementById('reviewerExpertiseError');
        
        reviewerSearchInput = document.getElementById('reviewerSearchInput');
        expertiseFilter = document.getElementById('expertiseFilter');
        reviewersTable = document.getElementById('reviewersTable');
        reviewersCount = document.getElementById('reviewersCount');
    };

    const initializeReviewerEventListeners = () => {
        // Event listeners del formulario de revisores
        reviewerForm.addEventListener('submit', handleReviewerSubmit);
        reviewerForm.addEventListener('reset', handleReviewerReset);
        
        // Event listeners de validación en tiempo real
        reviewerNameInput.addEventListener('input', () => {
            validateReviewerName();
            updateReviewerSubmitButton();
        });
        
        reviewerEmailInput.addEventListener('input', () => {
            validateReviewerEmail();
            updateReviewerSubmitButton();
        });
        
        reviewerExpertiseSelect.addEventListener('change', () => {
            validateReviewerExpertise();
            updateReviewerSubmitButton();
        });
        
        // Event listeners de búsqueda y filtrado
        reviewerSearchInput.addEventListener('input', filterReviewers);
        expertiseFilter.addEventListener('change', filterReviewers);
        
        // Event listeners de botones
        newReviewerBtn.addEventListener('click', resetReviewerForm);
    };

    const handleReviewerReset = () => {
        clearReviewerForm();
        currentEditingReviewerId = null;
        submitReviewerBtn.querySelector('.btn-text').textContent = 'Registrar Revisor';
    };

    const handleReviewerSubmit = async (event) => {
        event.preventDefault();
        
        // Validar campos en tiempo real
        const isNameValid = validateReviewerName();
        const isEmailValid = validateReviewerEmail();
        const isExpertiseValid = validateReviewerExpertise();
        
        console.log('Validación:', { isNameValid, isEmailValid, isExpertiseValid });
        console.log('Valores:', {
            name: reviewerNameInput.value,
            email: reviewerEmailInput.value,
            expertise: reviewerExpertiseSelect.value
        });
        
        if (!isNameValid || !isEmailValid || !isExpertiseValid) {
            console.log('Validación fallida');
            return;
        }
        
        // Actualizar datos adicionales
        reviewerFormData.name = reviewerNameInput.value.trim();
        reviewerFormData.email = reviewerEmailInput.value.trim();
        reviewerFormData.expertise = reviewerExpertiseSelect.value;
        
        // Mostrar estado de carga
        showReviewerLoadingState();
        
        try {
            // Simular envío del revisor
            await submitReviewer(reviewerFormData);
            
            // Mostrar mensaje de éxito
            showReviewerSuccessMessage();
            
            // Limpiar formulario
            clearReviewerForm();
            
        } catch (error) {
            console.error('Error al enviar el revisor:', error);
            showReviewerErrorMessage('Ocurrió un error al registrar el revisor. Por favor, inténtelo nuevamente.');
        } finally {
            hideReviewerLoadingState();
        }
    };

    const submitReviewer = (data) => {
        return new Promise(async (resolve, reject) => {
            // Crear nuevo revisor con ID y timestamp
            const newReviewer = {
                id: currentEditingReviewerId || Date.now().toString(),
                ...data,
                date: new Date().toLocaleDateString('es-ES'),
                timestamp: new Date().toISOString()
            };
            
            if (currentEditingReviewerId) {
                // Actualizar revisor existente
                await storage.updateReviewer(currentEditingReviewerId, newReviewer);
                const index = reviewers.findIndex(r => r.id === currentEditingReviewerId);
                if (index !== -1) {
                    reviewers[index] = newReviewer;
                }
                currentEditingReviewerId = null;
            } else {
                // Crear nuevo revisor
                await storage.saveReviewer(newReviewer);
                reviewers.unshift(newReviewer);
            }
            
            console.log('Revisor guardado:', newReviewer);
            filterReviewers();
            
            resolve({ success: true, message: 'Revisor registrado exitosamente' });
        });
    };

    const loadReviewersFromStorage = async () => {
        try {
            console.log('Cargando revisores desde IndexedDB...');
            reviewers = await storage.getAllReviewers();
            console.log(`Se cargaron ${reviewers.length} revisores desde IndexedDB`);
            filterReviewers();
        } catch (error) {
            console.error('Error al cargar revisores:', error);
            reviewers = [];
            filterReviewers();
        }
    };

    const filterReviewers = () => {
        const searchTerm = reviewerSearchInput.value.toLowerCase();
        const expertiseValue = expertiseFilter.value;
        
        // Filtrar el array en memoria (mucho más eficiente)
        filteredReviewers = reviewers.filter(reviewer => {
            const matchesSearch = !searchTerm || 
                reviewer.name.toLowerCase().includes(searchTerm) ||
                reviewer.email.toLowerCase().includes(searchTerm) ||
                reviewer.expertise.toLowerCase().includes(searchTerm);
            
            const matchesExpertise = !expertiseValue || reviewer.expertise === expertiseValue;
            
            return matchesSearch && matchesExpertise;
        });
        
        renderReviewers();
    };

    const renderReviewers = () => {
        reviewersCount.textContent = filteredReviewers.length;
        
        if (filteredReviewers.length === 0) {
            reviewersTable.innerHTML = `
                <div class="no-reviewers">
                    <div class="no-reviewers-icon">👥</div>
                    <p>${reviewers.length === 0 ? 'No hay revisores registrados aún. Registra tu primer revisor para comenzar.' : 'No se encontraron revisores con los criterios de búsqueda.'}</p>
                </div>
            `;
            return;
        }
        
        const reviewersHTML = filteredReviewers.map(reviewer => `
            <div class="reviewer-item" data-id="${reviewer.id}">
                <div class="reviewer-header">
                    <div class="reviewer-info">
                        <h4>${escapeHtml(reviewer.name)}</h4>
                        <div class="reviewer-email">${escapeHtml(reviewer.email)}</div>
                        <div class="reviewer-expertise expertise-${reviewer.expertise}">${getExpertiseLabel(reviewer.expertise)}</div>
                    </div>
                    <div class="reviewer-actions">
                        <button class="btn btn-small btn-primary" onclick="editReviewer('${reviewer.id}')">Editar</button>
                        <button class="btn btn-small btn-danger" onclick="deleteReviewer('${reviewer.id}')">Eliminar</button>
                    </div>
                </div>
            </div>
        `).join('');
        
        reviewersTable.innerHTML = reviewersHTML;
    };

    const getExpertiseLabel = (expertise) => {
        const labels = {
            'ciencias': 'Ciencias',
            'tecnologia': 'Tecnología',
            'educacion': 'Educación',
            'medicina': 'Medicina',
            'ingenieria': 'Ingeniería',
            'sociales': 'Ciencias Sociales',
            'artes': 'Artes y Humanidades',
            'multidisciplinario': 'Multidisciplinario'
        };
        return labels[expertise] || expertise;
    };

    const editReviewer = (id) => {
        const reviewer = reviewers.find(r => r.id === id);
        if (reviewer) {
            currentEditingReviewerId = id;
            reviewerNameInput.value = reviewer.name;
            reviewerEmailInput.value = reviewer.email;
            reviewerExpertiseSelect.value = reviewer.expertise;
            
            // Cambiar texto del botón
            submitReviewerBtn.querySelector('.btn-text').textContent = 'Actualizar Revisor';
            
            // Scroll al formulario
            reviewerForm.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const deleteReviewer = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este revisor? Esta acción no se puede deshacer.')) {
            return;
        }
        
        try {
            await storage.deleteReviewer(id);
            reviewers = reviewers.filter(r => r.id !== id);
            filterReviewers();
            
            // Mostrar mensaje de éxito
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.style.display = 'block';
            successDiv.style.position = 'fixed';
            successDiv.style.top = '20px';
            successDiv.style.right = '20px';
            successDiv.style.zIndex = '1000';
            successDiv.style.maxWidth = '300px';
            successDiv.innerHTML = `
                <div class="success-content">
                    <h4>Revisor Eliminado</h4>
                    <p>El revisor ha sido eliminado exitosamente.</p>
                </div>
            `;
            
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                successDiv.remove();
            }, 3000);
        } catch (error) {
            console.error('Error al eliminar revisor:', error);
            showReviewerErrorMessage('Error al eliminar el revisor. Por favor, inténtelo nuevamente.');
        }
    };

    // Validación de campos de revisores
    const validateReviewerName = () => {
        const name = reviewerNameInput.value.trim();
        console.log('Validando nombre:', name);
        
        if (name === '') {
            showReviewerError(reviewerNameInput, reviewerNameError, 'El nombre es obligatorio');
            return false;
        }
        if (name.length < 3) {
            showReviewerError(reviewerNameInput, reviewerNameError, 'El nombre debe tener al menos 3 caracteres');
            return false;
        }
        hideReviewerError(reviewerNameInput, reviewerNameError);
        return true;
    };

    const validateReviewerEmail = () => {
        const email = reviewerEmailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email === '') {
            showReviewerError(reviewerEmailInput, reviewerEmailError, 'El correo electrónico es obligatorio');
            return false;
        }
        if (!emailRegex.test(email)) {
            showReviewerError(reviewerEmailInput, reviewerEmailError, 'Ingrese un correo electrónico válido');
            return false;
        }
        hideReviewerError(reviewerEmailInput, reviewerEmailError);
        return true;
    };

    const validateReviewerExpertise = () => {
        const expertise = reviewerExpertiseSelect.value;
        
        if (expertise === '') {
            showReviewerError(reviewerExpertiseSelect, reviewerExpertiseError, 'Seleccione un área de expertise');
            return false;
        }
        hideReviewerError(reviewerExpertiseSelect, reviewerExpertiseError);
        return true;
    };

    const showReviewerError = (input, errorElement, message) => {
        input.classList.add('error');
        input.classList.remove('valid');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    };

    const hideReviewerError = (input, errorElement) => {
        input.classList.remove('error');
        input.classList.add('valid');
        errorElement.classList.remove('show');
    };

    const updateReviewerSubmitButton = () => {
        const isValid = validateReviewerName() && 
                       validateReviewerEmail() && 
                       validateReviewerExpertise();
        
        submitReviewerBtn.disabled = !isValid;
    };

    // Estados de carga y mensajes para revisores
    const showReviewerLoadingState = () => {
        submitReviewerBtn.disabled = true;
        submitReviewerBtn.querySelector('.btn-text').style.display = 'none';
        submitReviewerBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    };

    const hideReviewerLoadingState = () => {
        submitReviewerBtn.querySelector('.btn-text').style.display = 'inline';
        submitReviewerBtn.querySelector('.btn-loading').style.display = 'none';
        updateReviewerSubmitButton();
    };

    const showReviewerSuccessMessage = () => {
        reviewerForm.style.display = 'none';
        reviewerSuccessMessage.style.display = 'block';
    };

    const showReviewerErrorMessage = (message) => {
        // Crear elemento de error si no existe
        let errorDiv = document.querySelector('.error-alert');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-alert';
            errorDiv.innerHTML = `
                <div class="error-content">
                    <h4>Error</h4>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">Cerrar</button>
                </div>
            `;
        }
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    };

    const clearReviewerForm = () => {
        reviewerForm.reset();
        reviewerFormData = {
            name: '',
            email: '',
            expertise: ''
        };
        hideReviewerError(reviewerNameInput, reviewerNameError);
        hideReviewerError(reviewerEmailInput, reviewerEmailError);
        hideReviewerError(reviewerExpertiseSelect, reviewerExpertiseError);
        updateReviewerSubmitButton();
    };

    const resetReviewerForm = () => {
        reviewerSuccessMessage.style.display = 'none';
        reviewerForm.style.display = 'block';
        clearReviewerForm();
        
        // Hacer scroll al inicio del formulario
        reviewerForm.scrollIntoView({ behavior: 'smooth' });
    };

    // Gestión de tabs
    const initializeTabs = () => {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Desactivar todos los tabs y contenidos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activar tab seleccionado
                button.classList.add('active');
                document.getElementById(`${targetTab}Tab`).classList.add('active');
            });
        });
    };

    const renderArticles = () => {
        articlesCount.textContent = filteredArticles.length;
        
        if (filteredArticles.length === 0) {
            articlesTable.innerHTML = `
                <div class="no-articles">
                    <div class="no-articles-icon">📄</div>
                    <p>${articles.length === 0 ? 'No hay artículos registrados aún. Registra tu primer artículo para comenzar.' : 'No se encontraron artículos con los criterios de búsqueda.'}</p>
                </div>
            `;
            return;
        }
        
        const articlesHTML = filteredArticles.map(article => `
            <div class="article-item" data-id="${article.id}">
                <div class="article-header">
                    <h3 class="article-title">${escapeHtml(article.title)}</h3>
                    ${article.category ? `<span class="article-category">${getCategoryLabel(article.category)}</span>` : ''}
                </div>
                <div class="article-meta">
                    <div class="article-author">
                        <strong>Autor:</strong> ${escapeHtml(article.author)}
                    </div>
                    <div class="article-email">
                        <strong>Email:</strong> ${escapeHtml(article.email)}
                    </div>
                    <div class="article-date">
                        <strong>Fecha:</strong> ${article.date}
                    </div>
                </div>
                <div class="article-summary">
                    ${escapeHtml(article.summary)}
                </div>
                ${article.keywords ? `
                    <div class="article-keywords">
                        ${article.keywords.split(',').map(keyword => 
                            `<span class="keyword-tag">${escapeHtml(keyword.trim())}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                <div class="article-actions">
                    <button class="btn-small btn-view" onclick="ArticleForm.viewArticle('${article.id}')">
                        Ver
                    </button>
                    <button class="btn-small btn-edit" onclick="ArticleForm.editArticle('${article.id}')">
                        Editar
                    </button>
                    <button class="btn-small btn-delete" onclick="ArticleForm.deleteArticle('${article.id}')">
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');
        
        articlesTable.innerHTML = articlesHTML;
    };

    const getCategoryLabel = (category) => {
        const categories = {
            'ciencias': 'Ciencias',
            'tecnologia': 'Tecnología',
            'educacion': 'Educación',
            'medicina': 'Medicina',
            'ingenieria': 'Ingeniería',
            'sociales': 'Ciencias Sociales',
            'artes': 'Artes y Humanidades',
            'otro': 'Otro'
        };
        return categories[category] || category;
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const viewArticle = (id) => {
        const article = articles.find(a => a.id === id);
        if (!article) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${escapeHtml(article.title)}</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="modal-meta">
                        <div class="modal-meta-item">
                            <strong>Autor:</strong> ${escapeHtml(article.author)}
                        </div>
                        <div class="modal-meta-item">
                            <strong>Email:</strong> ${escapeHtml(article.email)}
                        </div>
                        <div class="modal-meta-item">
                            <strong>Fecha:</strong> ${article.date}
                        </div>
                        ${article.category ? `
                            <div class="modal-meta-item">
                                <strong>Categoría:</strong> ${getCategoryLabel(article.category)}
                            </div>
                        ` : ''}
                        ${article.keywords ? `
                            <div class="modal-meta-item">
                                <strong>Palabras clave:</strong> ${escapeHtml(article.keywords)}
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-summary">
                        <h3>Resumen</h3>
                        <p>${escapeHtml(article.summary)}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cerrar modal al hacer clic fuera
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    };

    const editArticle = (id) => {
        const article = articles.find(a => a.id === id);
        if (!article) return;
        
        currentEditingId = id;
        
        // Llenar formulario con datos del artículo
        titleInput.value = article.title;
        summaryInput.value = article.summary;
        authorInput.value = article.author;
        emailInput.value = article.email;
        keywordsInput.value = article.keywords || '';
        categorySelect.value = article.category || '';
        
        // Actualizar validaciones
        validateTitle();
        validateSummary();
        validateAuthor();
        validateEmail();
        updateCharCount();
        updateSubmitButton();
        
        // Cambiar texto del botón
        submitBtn.querySelector('.btn-text').textContent = 'Actualizar Artículo';
        
        // Scroll al formulario
        formSection.scrollIntoView({ behavior: 'smooth' });
    };

    const deleteArticle = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este artículo? Esta acción no se puede deshacer.')) {
            return;
        }
        
        try {
            if (networkMonitor.isOnline) {
                // Eliminar directamente si hay conexión
                await storage.delete(id);
                articles = articles.filter(a => a.id !== id);
                filterArticles();
            } else {
                // Marcar como eliminado localmente y encolar para sincronización
                const article = articles.find(a => a.id === id);
                if (article) {
                    article.syncStatus = 'deleted_pending';
                    article.deletedAt = new Date().toISOString();
                    await storage.update(id, article);
                    await syncQueue.enqueue({ type: 'DELETE', data: { id } });
                    
                    // Remover del array en memoria
                    articles = articles.filter(a => a.id !== id);
                    filterArticles();
                }
            }
            
            // Mostrar mensaje de éxito
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.style.display = 'block';
            successDiv.style.position = 'fixed';
            successDiv.style.top = '20px';
            successDiv.style.right = '20px';
            successDiv.style.zIndex = '1000';
            successDiv.style.maxWidth = '300px';
            successDiv.innerHTML = `
                <div class="success-content">
                    <h4>Artículo Eliminado</h4>
                    <p>${networkMonitor.isOnline 
                        ? 'El artículo ha sido eliminado exitosamente.' 
                        : 'El artículo se eliminará del servidor cuando haya conexión.'}</p>
                </div>
            `;
            
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                successDiv.remove();
            }, 3000);
        } catch (error) {
            console.error('Error al eliminar artículo:', error);
            showErrorMessage('Error al eliminar el artículo. Por favor, inténtelo nuevamente.');
        }
    };

    // Inicialización
    const init = async () => {
        console.log('🚀 Inicializando aplicación...');
        
        initializeElements();
        initializeEventListeners();
        initializeReviewerElements();
        initializeReviewerEventListeners();
        initializeTabs();
        updateSubmitButton();
        updateReviewerSubmitButton();
        
        // Inicializar Network Monitor
        networkMonitor.updateStatus(navigator.onLine ? 'online' : 'offline');
        
        // Esperar a que el DOM esté completamente cargado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // PRIMERO: Inicializar IndexedDB para asegurar que todos los object stores existan
        try {
            console.log('📊 Inicializando IndexedDB...');
            await storage.initDB();
            console.log('✅ IndexedDB inicializada correctamente');
        } catch (error) {
            console.error('❌ Error inicializando IndexedDB:', error);
        }
        
        // SEGUNDO: Cargar sync queue existente (con manejo de errores)
        try {
            await syncQueue.loadQueue();
        } catch (error) {
            console.error('❌ Error cargando sync queue (inicialización vacía):', error);
            // Continuar sin sync queue
        }
        
        // Configurar callbacks para sincronización
        networkMonitor.onOnline(async () => {
            console.log('🟢 Conexión disponible - iniciando sincronización');
            networkMonitor.updateStatus('syncing');
            
            try {
                // Primero recargar artículos para asegurar UI actualizada
                await loadArticlesFromStorage();
                
                // Luego procesar sincronización
                await syncQueue.processQueue();
                
                // Recargar artículos actualizados después de sincronización
                await loadArticlesFromStorage();
                
                // Mostrar resumen de sincronización
                const pending = syncQueue.getPendingCount();
                const failed = syncQueue.getFailedCount();
                
                if (pending === 0 && failed === 0) {
                    showSuccessMessage('Todos los datos han sido sincronizados exitosamente.');
                } else if (failed > 0) {
                    showErrorMessage(`${failed} operaciones fallaron. Se reintentarán más tarde.`);
                }
            } catch (error) {
                console.error('Error en sincronización:', error);
                showErrorMessage('Error durante la sincronización. Los datos se guardarán localmente.');
            } finally {
                networkMonitor.updateStatus('online');
            }
        });
        
        networkMonitor.onOffline(async () => {
            console.log('🔴 Conexión perdida - entrando en modo offline');
            
            // Asegurar que los artículos se mantengan visibles
            await loadArticlesFromStorage();
        });
        
        // TERCERO: Cargar artículos y revisores desde IndexedDB al iniciar
        console.log('📂 Cargando datos iniciales...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
        await loadArticlesFromStorage();
        await loadReviewersFromStorage();
        
        console.log('✅ Aplicación inicializada completamente');
    };

    // Hacer públicas las funciones necesarias
    return {
        init,
        resetForm,
        viewArticle,
        editArticle,
        deleteArticle,
        filterArticles,
        loadReviewersFromStorage,
        filterReviewers,
        editReviewer,
        deleteReviewer,
        resetReviewerForm
    };
})();

// Inicialización global
document.addEventListener('DOMContentLoaded', () => {
    ArticleForm.init();
});

